import {
    Chart,
    ChartDataset,
    ChartOptions,
    Filler,
    LinearScale,
    LineController,
    LineElement,
    Plugin,
    PointElement,
    Tooltip,
    TooltipModel,
} from 'chart.js';
import { theme } from 'twin.macro';
import { colorWithAlpha } from '@/lib/helpers';
import type { ChartPoint } from '@/components/server/console/liveStats';

Chart.register(LineController, LineElement, PointElement, LinearScale, Filler, Tooltip);

export type LiveLineChart = Chart<'line', ChartPoint[]>;

export type ExternalTooltipHandler = (context: { chart: Chart; tooltip: TooltipModel<'line'> }) => void;

/** Canvas can't read CSS variables, so the theme colours are resolved when a chart is created. */
export interface ChartPalette {
    primary: string;
    secondary: string;
    grid: string;
    tick: string;
    surface: string;
}

const cssVariable = (name: string, fallback: string): string =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

export const readChartPalette = (): ChartPalette => ({
    primary: cssVariable('--color-primary', 'hsl(229, 100%, 64%)'),
    secondary: cssVariable('--color-secondary', 'hsl(229, 96%, 59%)'),
    grid: cssVariable('--color-neutral', 'hsl(0, 0%, 15%)'),
    tick: cssVariable('--color-muted', 'hsl(220, 16%, 45%)'),
    surface: cssVariable('--color-background-secondary', 'hsl(0, 0%, 10%)'),
});

const FILL_ALPHA = 0.5;

export interface LiveDatasetInput {
    label: string;
    color: string;
    points: readonly ChartPoint[];
}

export const liveDataset = (input: LiveDatasetInput, palette: ChartPalette): ChartDataset<'line', ChartPoint[]> => ({
    label: input.label,
    // Chart.js instruments the arrays it is given, so it gets its own copy.
    data: input.points.slice(),
    fill: true,
    borderColor: input.color,
    backgroundColor: colorWithAlpha(input.color, FILL_ALPHA),
    pointHoverBackgroundColor: input.color,
    pointHoverBorderColor: palette.surface,
});

interface LiveChartOptionsInput {
    palette: ChartPalette;
    max: number;
    formatTick: (value: number) => string;
    onTooltip: ExternalTooltipHandler;
}

/**
 * Options for a scrolling time series. The x axis holds epoch milliseconds and
 * its window is moved every frame by LiveChart, so animations stay off: the
 * motion comes from the window, not from Chart.js tweening each point.
 */
export const liveChartOptions = ({
    palette,
    max,
    formatTick,
    onTooltip,
}: LiveChartOptionsInput): ChartOptions<'line'> => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    normalized: true,
    parsing: false,
    // Hovering anywhere over the plot reads every series at the nearest moment in time.
    interaction: { mode: 'index', intersect: false },
    layout: { padding: 0 },
    plugins: {
        legend: { display: false },
        title: { display: false },
        tooltip: { enabled: false, external: onTooltip },
    },
    scales: {
        x: {
            type: 'linear',
            grid: { display: false, drawBorder: false },
            ticks: { display: false },
        },
        y: {
            type: 'linear',
            min: 0,
            // An explicit maximum makes the three ticks land on 0, half and the top instead of decimal "nice" steps.
            max,
            grid: { display: true, color: palette.grid, drawBorder: false },
            ticks: {
                display: true,
                count: 3,
                color: palette.tick,
                font: { family: theme('fontFamily.sans'), size: 11, weight: '400' },
                callback: (value) => formatTick(Number(value)),
            },
        },
    },
    elements: {
        point: { radius: 0, hitRadius: 0, hoverRadius: 4, hoverBorderWidth: 2 },
        line: { tension: 0.15, borderWidth: 2 },
    },
});

/** Re-applies the theme colours to the y axis, e.g. after switching between light and dark. */
export const applyAxisPalette = (chart: LiveLineChart, palette: ChartPalette) => {
    const y = chart.options.scales?.y;
    if (y?.grid) {
        y.grid.color = palette.grid;
    }
    if (y?.ticks) {
        y.ticks.color = palette.tick;
    }
};

/**
 * Dashed hairline at the hovered moment, drawn under the lines so the hovered point stays on top.
 * The colour is read on every draw so it follows theme switches.
 */
export const crosshairPlugin = (color: () => string): Plugin<'line'> => ({
    id: 'liveCrosshair',
    beforeDatasetsDraw: (chart) => {
        const active = chart.tooltip?.getActiveElements() ?? [];
        if (active.length === 0) {
            return;
        }

        const { ctx, chartArea } = chart;
        const x = active[0].element.x;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = color();
        ctx.stroke();
        ctx.restore();
    },
});
