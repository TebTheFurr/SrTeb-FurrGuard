import React, { useEffect, useRef, useState } from 'react';
import { Chart, TooltipModel } from 'chart.js';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { colorWithAlpha } from '@/lib/helpers';
import { prefersReducedMotion } from '@/components/elements/ui/motion';
import { subscribeFrame } from '@/components/server/console/frameTicker';
import { ChartPoint, STREAM_SPAN_MS, streamDelay, streamWindow } from '@/components/server/console/liveStats';
import {
    applyAxisPalette,
    ChartPalette,
    crosshairPlugin,
    ExternalTooltipHandler,
    liveChartOptions,
    liveDataset,
    LiveLineChart,
    readChartPalette,
} from '@/components/server/console/chart';
import ChartHoverCard, { HoverReading } from '@/components/server/console/ChartHoverCard';

/**
 * A line chart that scrolls with real time.
 *
 * Readings are plotted at the moment they arrived and the visible window
 * slides every frame, so the lines glide instead of jumping one slot per
 * update. Hovering shows the exact value of every series at the nearest moment
 * together with its time.
 */

export interface LiveSeries {
    key: string;
    label: string;
    tone: 'primary' | 'secondary';
    points: readonly ChartPoint[];
}

export interface LiveChartProps {
    /** Accessible name of the chart. */
    label: string;
    series: LiveSeries[];
    /** Smoothed milliseconds between readings; sets how far the chart trails real time. */
    cadence: number;
    locale: string;
    /** Top of the y axis, see axisMax(). */
    max: number;
    formatTick: (value: number) => string;
    formatValue: (value: number) => string;
    formatDetail?: (value: number) => string | null;
}

const Frame = styled.div`
    ${tw`relative w-full h-full`};
`;

const CROSSHAIR_ALPHA = 0.6;

const moveWindow = (chart: LiveLineChart, now: number, cadence: number) => {
    const x = chart.options.scales?.x;
    if (!x) {
        return;
    }

    const { min, max } = streamWindow(now, STREAM_SPAN_MS, streamDelay(cadence));
    x.min = min;
    x.max = max;
};

/** Writes series data and colours into the chart. Dataset objects are reused: Chart.js keys its element and hover state on them. */
const syncDatasets = (chart: LiveLineChart, series: LiveSeries[], colors: ChartPalette) => {
    chart.data.datasets = series.map((entry, index) => {
        const next = liveDataset({ label: entry.label, color: colors[entry.tone], points: entry.points }, colors);
        const existing = chart.data.datasets[index];

        return existing ? Object.assign(existing, next) : next;
    });
};

/** Next hover state, or the current one when nothing visible changed (so React can skip the render). */
const nextHover = (current: HoverReading | null, chart: Chart, tooltip: TooltipModel<'line'>): HoverReading | null => {
    const [first] = tooltip.dataPoints ?? [];
    if (tooltip.opacity === 0 || !first) {
        return null;
    }

    const time = (first.raw as ChartPoint).x;
    const left = chart.canvas.offsetLeft + tooltip.caretX;
    const top = chart.canvas.offsetTop + tooltip.caretY;
    const flip = tooltip.caretX > chart.width / 2;

    const unchanged =
        current !== null &&
        current.time === time &&
        current.flip === flip &&
        Math.abs(current.left - left) < 0.5 &&
        Math.abs(current.top - top) < 0.5;
    if (unchanged) {
        return current;
    }

    return {
        time,
        left,
        top,
        flip,
        values: tooltip.dataPoints.map((item) => ({
            key: String(item.datasetIndex),
            label: item.dataset.label ?? '',
            color: String(item.dataset.borderColor),
            value: (item.raw as ChartPoint).y,
        })),
    };
};

const LiveChart = ({
    label,
    series,
    cadence,
    locale,
    max,
    formatTick,
    formatValue,
    formatDetail,
}: LiveChartProps) => {
    const canvas = useRef<HTMLCanvasElement>(null);
    const chart = useRef<LiveLineChart | null>(null);
    const palette = useRef<ChartPalette | null>(null);
    const latest = useRef({ cadence, formatTick, series });
    const [hover, setHover] = useState<HoverReading | null>(null);
    const [onScreen, setOnScreen] = useState(true);
    const hasData = series.some((entry) => entry.points.length > 0);

    useEffect(() => {
        latest.current = { cadence, formatTick, series };
    });

    // The chart is created once; the effects below feed it data and move its window.
    useEffect(() => {
        if (!canvas.current) {
            return;
        }

        const colors = readChartPalette();
        const onTooltip: ExternalTooltipHandler = ({ chart: instance, tooltip }) =>
            setHover((current) => nextHover(current, instance, tooltip));

        const instance: LiveLineChart = new Chart(canvas.current, {
            type: 'line',
            data: { datasets: [] },
            options: liveChartOptions({
                palette: colors,
                max,
                formatTick: (value) => latest.current.formatTick(value),
                onTooltip,
            }),
            plugins: [crosshairPlugin(() => colorWithAlpha((palette.current ?? colors).tick, CROSSHAIR_ALPHA))],
        });

        palette.current = colors;
        chart.current = instance;

        return () => {
            chart.current = null;
            instance.destroy();
        };
    }, []);

    useEffect(() => {
        const instance = chart.current;
        const colors = palette.current;
        if (!instance || !colors) {
            return;
        }

        syncDatasets(instance, series, colors);

        const y = instance.options.scales?.y;
        if (y) {
            y.max = max;
        }

        moveWindow(instance, Date.now(), latest.current.cadence);
        instance.update('none');
    }, [series, max]);

    // Canvas colours don't follow CSS variables on their own: repaint when the panel switches light/dark.
    useEffect(() => {
        const observer = new MutationObserver(() => {
            const instance = chart.current;
            if (!instance) {
                return;
            }

            const colors = readChartPalette();
            palette.current = colors;
            applyAxisPalette(instance, colors);
            syncDatasets(instance, latest.current.series, colors);
            instance.update('none');
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const node = canvas.current;
        if (!node || typeof IntersectionObserver === 'undefined') {
            return;
        }

        const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
        observer.observe(node);

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        // Empty or off-screen charts (e.g. while scrolled down to the console) and reduced motion skip
        // the per-frame scroll; the window still moves whenever a reading arrives (see the effect above).
        if (!onScreen || !hasData || prefersReducedMotion()) {
            return;
        }

        return subscribeFrame((now) => {
            const instance = chart.current;
            if (!instance) {
                return;
            }

            moveWindow(instance, now, latest.current.cadence);
            instance.update('none');
        });
    }, [onScreen, hasData]);

    return (
        <Frame>
            <canvas ref={canvas} role={'img'} aria-label={label} />
            {hover && (
                <ChartHoverCard reading={hover} locale={locale} formatValue={formatValue} formatDetail={formatDetail} />
            )}
        </Frame>
    );
};

export default LiveChart;
