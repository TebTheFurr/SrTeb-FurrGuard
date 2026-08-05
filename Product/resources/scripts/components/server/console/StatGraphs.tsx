import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ServerContext } from '@/state/server';
import { SocketEvent } from '@/components/server/events';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';
import type { ChartDataset } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useChart, useChartTickLabel } from '@/components/server/console/chart';
import { colorWithAlpha } from '@/lib/helpers';
import { bytesToString } from '@/lib/formatters';
import { CloudDownloadIcon, CloudUploadIcon } from '@heroicons/react/solid';
import ChartBlock from '@/components/server/console/ChartBlock';
import Tooltip from '@/components/elements/tooltip/Tooltip';

export default () => {
    const { t } = useTranslation('server');
    const status = ServerContext.useStoreState((state) => state.status.value);
    const limits = ServerContext.useStoreState((state) => state.server.data!.limits);
    const previous = useRef<Record<'tx' | 'rx', number>>({ tx: -1, rx: -1 });

    const cpu = useChartTickLabel(t('console.stats.series_cpu'), limits.cpu, '%', 2);
    const memory = useChartTickLabel(t('console.stats.series_memory'), limits.memory, 'MiB');
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || 'hsl(229, 100%, 64%)';
    const secondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--color-secondary').trim() || 'hsl(229, 96%, 59%)';

    const network = useChart(
        t('console.stats.chart_network'),
        useMemo(
            () => ({
                sets: 2,
                options: {
                    scales: {
                        y: {
                            ticks: {
                                callback(value: string | number) {
                                    return bytesToString(typeof value === 'string' ? parseInt(value, 10) : value);
                                },
                            },
                        },
                    },
                },
                callback(dataset: ChartDataset<'line'>, index: number) {
                    return {
                        ...dataset,
                        label: !index ? t('console.stats.series_network_out') : t('console.stats.series_network_in'),
                        borderColor: !index ? secondaryColor : primaryColor,
                        backgroundColor: colorWithAlpha(!index ? secondaryColor : primaryColor, 0.5),
                    };
                },
            }),
            [t, primaryColor, secondaryColor]
        )
    );

    useEffect(() => {
        if (status === 'offline') {
            cpu.clear();
            memory.clear();
            network.clear();
        }
    }, [status]);

    useWebsocketEvent(SocketEvent.STATS, (data: string) => {
        let values: any = {};
        try {
            values = JSON.parse(data);
        } catch (e) {
            return;
        }
        cpu.push(values.cpu_absolute);
        memory.push(Math.floor(values.memory_bytes / 1024 / 1024));
        network.push([
            previous.current.tx < 0 ? 0 : Math.max(0, values.network.tx_bytes - previous.current.tx),
            previous.current.rx < 0 ? 0 : Math.max(0, values.network.rx_bytes - previous.current.rx),
        ]);

        previous.current = { tx: values.network.tx_bytes, rx: values.network.rx_bytes };
    });

    return (
        <>
            <ChartBlock title={t('console.stats.chart_cpu')}>
                <Line {...cpu.props} />
            </ChartBlock>
            <ChartBlock title={t('console.stats.chart_memory')}>
                <Line {...memory.props} />
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
                <Line {...network.props} />
            </ChartBlock>
        </>
    );
};
