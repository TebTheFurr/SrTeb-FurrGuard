import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStoreState } from 'easy-peasy';
import { faHdd, faMemory, faMicrochip, faNetworkWired } from '@fortawesome/free-solid-svg-icons';
import { ip, mbToBytes } from '@/lib/formatters';
import { ServerContext } from '@/state/server';
import { SocketEvent, SocketRequest } from '@/components/server/events';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';
import classNames from 'classnames';
import PrivacyServerHostBlur from '@/components/elements/PrivacyServerHostBlur';
import { ApplicationStore } from '@/state';
import PlayerCountWidget from '../PlayerCountWidget';
import StatTile from '@/components/elements/ui/StatTile';
import StatDetails, { StatDetailRow } from '@/components/elements/ui/StatDetails';
import AnimatedNumber from '@/components/elements/ui/AnimatedNumber';
import { percentOf } from '@/components/elements/ui/tokens';
import { isRepeat, parseStatsPayload, StatsSample } from '@/components/server/console/liveStats';
import { formatBytes, formatClock, formatExactBytes, formatPercent } from '@/components/server/console/statsFormat';
import styled from 'styled-components/macro';
import tw from 'twin.macro';

const Grid = styled.div<{ $columns: number }>`
    ${tw`grid gap-3`};
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));

    @media (min-width: 1024px) {
        grid-template-columns: repeat(${({ $columns }) => $columns}, minmax(0, 1fr));
    }
`;

const Offline = styled.span`
    color: var(--color-inverted);
`;

const ServerDetailsBlock = ({ className }: { className?: string }) => {
    const { t, i18n } = useTranslation('server');
    const locale = i18n.language;
    const [sample, setSample] = useState<StatsSample | null>(null);

    const status = ServerContext.useStoreState((state) => state.status.value);
    const connected = ServerContext.useStoreState((state) => state.socket.connected);
    const instance = ServerContext.useStoreState((state) => state.socket.instance);
    const limits = ServerContext.useStoreState((state) => state.server.data!.limits);
    const serverData = ServerContext.useStoreState((state) => state.server.data!);
    const playerCountConfig = useStoreState((state: ApplicationStore) => state.settings.data?.components?.playerCount);
    const playerCountAllowedEggs = playerCountConfig?.allowedEggs ?? [];
    const showPlayerCountStat =
        playerCountConfig?.enabled === true &&
        playerCountConfig?.placement === 'stat_block' &&
        playerCountAllowedEggs.length > 0 &&
        playerCountAllowedEggs.map((eggId) => Number(eggId)).includes(Number(serverData.eggId));

    const isOffline = status === 'offline';

    const limitBytes = useMemo(() => ({ memory: mbToBytes(limits.memory), disk: mbToBytes(limits.disk) }), [limits]);

    const textLimits = useMemo(
        () => ({
            cpu: limits.cpu ? formatPercent(limits.cpu, locale, 0, 2) : null,
            memory: limits.memory ? formatBytes(limitBytes.memory, locale, 0, 2) : null,
            disk: limits.disk ? formatBytes(limitBytes.disk, locale, 0, 2) : null,
        }),
        [limits, limitBytes, locale]
    );

    const { allocation, blurAllocationHost } = useMemo(() => {
        const data = serverData;
        const primarySubdomain = data.primarySubdomain;
        if (primarySubdomain) {
            return { allocation: primarySubdomain, blurAllocationHost: false };
        }
        const match = data.allocations.find((a) => a.isDefault);
        if (!match) {
            return { allocation: t('console.details.allocation_na'), blurAllocationHost: false };
        }
        if (match.alias) {
            return { allocation: `${match.alias}:${match.port}`, blurAllocationHost: false };
        }
        return { allocation: `${ip(match.ip)}:${match.port}`, blurAllocationHost: true };
    }, [serverData, t]);

    useEffect(() => {
        if (!connected || !instance) {
            return;
        }

        instance.send(SocketRequest.SEND_STATS);
    }, [instance, connected]);

    useWebsocketEvent(SocketEvent.STATS, (data) => {
        const next = parseStatsPayload(data, Date.now());
        if (next) {
            // Keep the original reading time when Wings merely repeats its last frame.
            setSample((current) => (isRepeat(current, next) ? current : next));
        }
    });

    const cpu = sample?.cpu ?? 0;
    const memory = sample?.memory ?? 0;
    const disk = sample?.disk ?? 0;

    // A stopped server reports no live usage, so the bars are hidden rather
    // than pinned at zero, which would read as "measured and empty".
    const cpuPercentage = isOffline ? null : percentOf(cpu, limits.cpu);
    const memoryPercentage = isOffline ? null : percentOf(memory, limitBytes.memory);
    const diskPercentage = percentOf(disk, limitBytes.disk);

    const formatCpu = useCallback((value: number) => formatPercent(value, locale, 2), [locale]);
    const formatSize = useCallback((value: number) => formatBytes(value, locale, 2), [locale]);

    /** Context rows shared by every usage tooltip: limit, share of it, headroom and when it was read. */
    const contextRows = (limitText: string | null, share: number | null, headroom: number | null): StatDetailRow[] => [
        { label: t('console.details.limit', 'Limit'), value: limitText ?? t('console.details.unlimited', 'Unlimited') },
        ...(share === null
            ? []
            : [{ label: t('console.details.of_limit', 'Of the limit'), value: formatPercent(share, locale, 2) }]),
        ...(headroom === null
            ? []
            : [{ label: t('console.details.available', 'Available'), value: formatBytes(headroom, locale, 2) }]),
        ...(sample
            ? [{ label: t('console.details.last_reading', 'Last reading'), value: formatClock(sample.time, locale) }]
            : []),
    ];

    const headroom = (limit: number, used: number): number | null => (limit > 0 ? Math.max(0, limit - used) : null);
    const hasLiveReading = sample !== null && !isOffline;

    return (
        <div className={classNames(className)}>
            <Grid $columns={showPlayerCountStat ? 5 : 4}>
                <StatTile
                    icon={faMicrochip}
                    label={t('console.details.cpu')}
                    value={
                        isOffline ? (
                            <Offline>{t('console.details.offline')}</Offline>
                        ) : (
                            <AnimatedNumber value={cpu} format={formatCpu} />
                        )
                    }
                    limit={textLimits.cpu}
                    percentage={cpuPercentage}
                    hideLimit={isOffline}
                    details={
                        hasLiveReading ? (
                            <StatDetails
                                value={formatPercent(cpu, locale, 3)}
                                caption={t('console.details.cpu_exact', 'Exact CPU usage')}
                                rows={contextRows(textLimits.cpu, cpuPercentage, null)}
                            />
                        ) : undefined
                    }
                />
                <StatTile
                    icon={faMemory}
                    label={t('console.details.memory')}
                    value={
                        isOffline ? (
                            <Offline>{t('console.details.offline')}</Offline>
                        ) : (
                            <AnimatedNumber value={memory} format={formatSize} />
                        )
                    }
                    limit={textLimits.memory}
                    percentage={memoryPercentage}
                    hideLimit={isOffline}
                    details={
                        hasLiveReading ? (
                            <StatDetails
                                value={formatExactBytes(memory, locale)}
                                caption={t('console.details.memory_exact', 'Exact memory in use')}
                                rows={contextRows(
                                    textLimits.memory,
                                    memoryPercentage,
                                    headroom(limitBytes.memory, memory)
                                )}
                            />
                        ) : undefined
                    }
                />
                <StatTile
                    icon={faHdd}
                    label={t('console.details.disk')}
                    value={<AnimatedNumber value={disk} format={formatSize} />}
                    limit={textLimits.disk}
                    percentage={diskPercentage}
                    details={
                        sample ? (
                            <StatDetails
                                value={formatExactBytes(disk, locale)}
                                caption={t('console.details.disk_exact', 'Exact disk usage')}
                                rows={contextRows(textLimits.disk, diskPercentage, headroom(limitBytes.disk, disk))}
                            />
                        ) : undefined
                    }
                />
                <StatTile
                    icon={faNetworkWired}
                    label={t('console.details.address')}
                    value={<PrivacyServerHostBlur when={blurAllocationHost}>{allocation}</PrivacyServerHostBlur>}
                    copyValue={allocation}
                    hideLimit
                />
                {showPlayerCountStat && <PlayerCountWidget server={serverData} variant='stat' />}
            </Grid>
        </div>
    );
};

export default ServerDetailsBlock;
