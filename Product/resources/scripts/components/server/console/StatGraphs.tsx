import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ServerContext } from '@/state/server';
import { SocketEvent } from '@/components/server/events';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';
import { mbToBytes } from '@/lib/formatters';
import { CloudDownloadIcon, CloudUploadIcon } from '@heroicons/react/solid';
import ChartBlock from '@/components/server/console/ChartBlock';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import LiveChart, { LiveSeries } from '@/components/server/console/LiveChart';
import { percentOf } from '@/components/elements/ui/tokens';
import { axisMax, EMPTY_HISTORY, foldSample, LiveHistory, parseStatsPayload } from '@/components/server/console/liveStats';
import { formatBytes, formatExactBytes, formatNumber, formatPercent } from '@/components/server/console/statsFormat';

export default () => {
    const { t, i18n } = useTranslation('server');
    const locale = i18n.language;
    const status = ServerContext.useStoreState((state) => state.status.value);
    const limits = ServerContext.useStoreState((state) => state.server.data!.limits);
    const [history, setHistory] = useState<LiveHistory>(EMPTY_HISTORY);
    // Readings can arrive faster than React re-renders, so the newest history is also kept here.
    const latest = useRef<LiveHistory>(EMPTY_HISTORY);

    const commit = (next: LiveHistory) => {
        latest.current = next;
        setHistory(next);
    };

    useEffect(() => {
        if (status === 'offline') {
            commit(EMPTY_HISTORY);
        }
    }, [status]);

    useWebsocketEvent(SocketEvent.STATS, (data: string) => {
        // A stopped server reports zeroes; plotting them would draw a flat line that never happened.
        if (status === 'offline') {
            return;
        }

        const sample = parseStatsPayload(data, Date.now());
        if (sample) {
            commit(foldSample(latest.current, sample));
        }
    });

    const memoryLimit = limits.memory ? mbToBytes(limits.memory) : 0;

    const cpuMax = useMemo(() => axisMax([history.cpu], limits.cpu, 'decimal'), [history.cpu, limits.cpu]);
    const memoryMax = useMemo(() => axisMax([history.memory], memoryLimit, 'binary'), [history.memory, memoryLimit]);
    const networkMax = useMemo(() => axisMax([history.tx, history.rx], 0, 'binary'), [history.tx, history.rx]);

    const cpuSeries = useMemo<LiveSeries[]>(
        () => [{ key: 'cpu', label: t('console.stats.series_cpu'), tone: 'primary', points: history.cpu }],
        [history.cpu, t]
    );
    const memorySeries = useMemo<LiveSeries[]>(
        () => [{ key: 'memory', label: t('console.stats.series_memory'), tone: 'primary', points: history.memory }],
        [history.memory, t]
    );
    const networkSeries = useMemo<LiveSeries[]>(
        () => [
            { key: 'tx', label: t('console.stats.series_network_out'), tone: 'secondary', points: history.tx },
            { key: 'rx', label: t('console.stats.series_network_in'), tone: 'primary', points: history.rx },
        ],
        [history.tx, history.rx, t]
    );

    const shareOfLimit = useCallback(
        (value: number, limit: number): string | null => {
            const share = percentOf(value, limit);

            return share === null
                ? null
                : t('console.stats.of_limit', '{{percent}} of the limit', { percent: formatPercent(share, locale, 2) });
        },
        [locale, t]
    );

    const formatCpuTick = useCallback((value: number) => formatPercent(value, locale, 0, 1), [locale]);
    const formatCpu = useCallback((value: number) => formatPercent(value, locale, 3), [locale]);
    const formatCpuDetail = useCallback((value: number) => shareOfLimit(value, limits.cpu), [shareOfLimit, limits.cpu]);

    const formatMemoryTick = useCallback((value: number) => formatBytes(value, locale, 0, 1), [locale]);
    const formatMemory = useCallback((value: number) => formatBytes(value, locale, 2), [locale]);
    const formatMemoryDetail = useCallback(
        (value: number) => [formatExactBytes(value, locale), shareOfLimit(value, memoryLimit)].filter(Boolean).join(' · '),
        [locale, shareOfLimit, memoryLimit]
    );

    const formatRateTick = useCallback((value: number) => `${formatBytes(value, locale, 0, 1)}/s`, [locale]);
    const formatRate = useCallback((value: number) => `${formatBytes(value, locale, 2)}/s`, [locale]);
    const formatRateDetail = useCallback(
        (value: number) => `${formatNumber(Math.round(value), locale, 0)} bytes/s`,
        [locale]
    );

    return (
        <>
            <ChartBlock title={t('console.stats.chart_cpu')}>
                <LiveChart
                    label={t('console.stats.chart_cpu')}
                    series={cpuSeries}
                    cadence={history.cadence}
                    locale={locale}
                    max={cpuMax}
                    formatTick={formatCpuTick}
                    formatValue={formatCpu}
                    formatDetail={formatCpuDetail}
                />
            </ChartBlock>
            <ChartBlock title={t('console.stats.chart_memory')}>
                <LiveChart
                    label={t('console.stats.chart_memory')}
                    series={memorySeries}
                    cadence={history.cadence}
                    locale={locale}
                    max={memoryMax}
                    formatTick={formatMemoryTick}
                    formatValue={formatMemory}
                    formatDetail={formatMemoryDetail}
                />
            </ChartBlock>
            <ChartBlock
                title={t('console.stats.chart_network')}
                legend={
                    <>
                        <Tooltip arrow content={t('console.stats.tooltip_network_out')}>
                            <CloudUploadIcon className={'mr-2 w-4 h-4'} style={{ color: 'var(--color-secondary)' }} />
                        </Tooltip>
                        <Tooltip arrow content={t('console.stats.tooltip_network_in')}>
                            <CloudDownloadIcon className={'w-4 h-4'} style={{ color: 'var(--color-primary)' }} />
                        </Tooltip>
                    </>
                }
            >
                <LiveChart
                    label={t('console.stats.chart_network')}
                    series={networkSeries}
                    cadence={history.cadence}
                    locale={locale}
                    max={networkMax}
                    formatTick={formatRateTick}
                    formatValue={formatRate}
                    formatDetail={formatRateDetail}
                />
            </ChartBlock>
        </>
    );
};
