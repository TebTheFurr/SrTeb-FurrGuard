import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowDown,
    faArrowUp,
    faCircle,
    faHdd,
    faMapMarkerAlt,
    faMemory,
    faMicrochip,
    faNetworkWired,
    faFolder,
    faServer,
} from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';
import { Server } from '@/api/server/getServer';
import getServerResourceUsage, { ServerPowerState, ServerStats } from '@/api/server/getServerResourceUsage';
import { bytesToString, ip, mbToBytes } from '@/lib/formatters';
import tw from 'twin.macro';
import Spinner from '@/components/elements/Spinner';
import PrivacyServerHostBlur from '@/components/elements/PrivacyServerHostBlur';
import styled, { keyframes, css } from 'styled-components/macro';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import PlayerCountWidget from '../server/PlayerCountWidget';
import StatTile from '@/components/elements/ui/StatTile';
import MetaChip from '@/components/elements/ui/MetaChip';
import DataField from '@/components/elements/ui/DataField';
import { percentOf } from '@/components/elements/ui/tokens';

declare global {
    interface Window {
        SiteConfiguration?: {
            eggImages?: Record<string, string>;
        };
    }
}

const isAlarmState = (current: number, limit: number): boolean => limit > 0 && current / (limit * 1024 * 1024) >= 0.9;


const pulse = keyframes`
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
`;

const ServerCardBase = styled(Link)<{
    $status: ServerPowerState | undefined;
    $eggImage?: string;
    $layout?: string;
    $variant?: string;
    $isDragging?: boolean;
}>`
    ${tw`block transition-all duration-150 overflow-hidden relative h-full`};
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 12px);
    opacity: ${({ $isDragging }) => ($isDragging ? 0.55 : 1)};

    &:hover {
        border-color: var(--color-primary);
    }

    ${({ $eggImage, $layout, $variant }) =>
        $eggImage &&
        $variant === 'default' &&
        ($layout === 'grid3'
            ? css`
                  &::before {
                      content: '';
                      position: absolute;
                      left: 0;
                      right: 0;
                      bottom: 0;
                      height: 60%;
                      background-image: url('${$eggImage}');
                      background-size: cover;
                      background-position: center;
                      opacity: 0.15;
                      pointer-events: none;
                      mask-image: linear-gradient(to top, black, transparent);
                      -webkit-mask-image: linear-gradient(to top, black, transparent);
                  }
              `
            : css`
                  &::before {
                      content: '';
                      position: absolute;
                      top: 0;
                      right: 0;
                      bottom: 0;
                      width: 50%;
                      background-image: url('${$eggImage}');
                      background-size: cover;
                      background-position: center;
                      opacity: 0.15;
                      pointer-events: none;
                      mask-image: linear-gradient(to right, transparent, black);
                      -webkit-mask-image: linear-gradient(to right, transparent, black);
                  }
              `)}
`;

const MoveIconButton = styled.button`
    ${tw`flex items-center justify-center w-6 h-6 rounded-full transition-colors duration-150`};
    color: var(--color-muted);

    &:hover {
        color: var(--color-base);
        background-color: var(--color-neutral);
    }
`;

const StatusBadge = styled.div<{ $status: ServerPowerState | undefined }>`
    ${tw`flex items-center gap-2 text-xs font-medium flex-shrink-0`};
    color: ${({ $status }) =>
        !$status || $status === 'offline' ? '#ef4444' : $status === 'running' ? '#22c55e' : '#eab308'};

    svg {
        font-size: 0.5rem;
        ${({ $status }) =>
            $status === 'running' &&
            css`
                animation: ${pulse} 2s ease-in-out infinite;
            `}
    }
`;

const StatusTag = styled.span<{ $type?: 'error' | 'warning' | 'info' }>`
    ${tw`rounded-full px-3 py-1 text-xs font-medium`};
    background-color: ${({ $type }) =>
        $type === 'error'
            ? 'rgba(239, 68, 68, 0.15)'
            : $type === 'warning'
            ? 'rgba(234, 179, 8, 0.15)'
            : 'var(--color-neutral)'};
    color: ${({ $type }) => ($type === 'error' ? '#ef4444' : $type === 'warning' ? '#eab308' : 'var(--color-muted)')};
`;

const DefaultCard = styled(ServerCardBase)`
    ${tw`p-4 flex flex-col`};
`;

const DefaultCardHeader = styled.div`
    ${tw`flex items-start justify-between gap-4 relative`};
    z-index: 1;
`;

const DefaultServerInfo = styled.div`
    ${tw`flex-1 min-w-0 flex flex-col justify-center`};
`;

const DefaultServerName = styled.h3`
    ${tw`text-base font-semibold truncate leading-tight`};
    color: var(--color-base);
`;

const DefaultStatsRow = styled.div`
    ${tw`flex flex-wrap items-center gap-x-6 gap-y-2 mt-3 pt-3 relative`};
    border-top: 1px solid var(--color-neutral);
    z-index: 1;
`;

const DefaultStatItem = styled.div<{ $alarm?: boolean }>`
    ${tw`flex items-center gap-2`};
`;

const DefaultStatIcon = styled.span<{ $alarm?: boolean }>`
    ${tw`text-xs`};
    color: ${(props) => (props.$alarm ? '#ef4444' : 'var(--color-muted)')};
`;

const DefaultStatValue = styled.span<{ $alarm?: boolean }>`
    ${tw`text-sm font-medium`};
    color: ${(props) => (props.$alarm ? '#ef4444' : 'var(--color-base)')};
`;

const DefaultStatLimit = styled.span`
    ${tw`text-xs`};
    color: var(--color-muted);
`;

const DefaultStatusMessage = styled.div`
    ${tw`flex items-center justify-center py-2 mt-3 pt-3 relative`};
    border-top: 1px solid var(--color-neutral);
    z-index: 1;
`;

const CompactCard = styled(ServerCardBase)`
    ${tw`p-4 flex flex-col gap-3`};
`;

const CompactHeader = styled.div`
    ${tw`flex items-center justify-between`};
`;

const CompactIcon = styled.div`
    ${tw`w-8 h-8 rounded-lg flex items-center justify-center`};
    background-color: var(--color-primary);
    opacity: 0.9;
`;

const CompactStatusDot = styled.div<{ $status: ServerPowerState | undefined }>`
    ${tw`w-2.5 h-2.5 rounded-full`};
    background-color: ${({ $status }) =>
        !$status || $status === 'offline' ? '#ef4444' : $status === 'running' ? '#22c55e' : '#eab308'};
    ${({ $status }) =>
        $status === 'running' &&
        css`
            animation: ${pulse} 2s ease-in-out infinite;
        `}
`;

const CompactTitle = styled.h3`
    ${tw`text-sm font-semibold truncate leading-tight`};
    color: var(--color-base);
`;

const CompactSubtitle = styled.p`
    ${tw`text-xs truncate`};
    color: var(--color-muted);
`;

const CompactProgressContainer = styled.div`
    ${tw`w-full h-1.5 rounded-full overflow-hidden`};
    background-color: var(--color-neutral);
`;

const CompactProgressBar = styled.div<{ $percentage: number; $alarm?: boolean }>`
    ${tw`h-full rounded-full transition-all duration-300`};
    width: ${(props) => Math.min(props.$percentage, 100)}%;
    background-color: ${(props) => (props.$alarm ? '#ef4444' : 'var(--color-primary)')};
`;

const CompactStats = styled.div`
    ${tw`flex items-center justify-between text-xs`};
    color: var(--color-muted);
`;

const MinimalCard = styled(ServerCardBase)`
    ${tw`flex items-stretch overflow-hidden`};
`;

const MinimalAccent = styled.div`
    ${tw`w-1 flex-shrink-0`};
    background-color: var(--color-primary);
`;

const MinimalBody = styled.div`
    ${tw`flex-1 min-w-0 p-3 flex flex-col gap-1`};
`;

const MinimalTopRow = styled.div`
    ${tw`flex items-center justify-between gap-2`};
`;

const MinimalTitle = styled.h3`
    ${tw`text-sm font-semibold truncate`};
    color: var(--color-base);
`;

const MinimalAddress = styled.p`
    ${tw`text-xs truncate`};
    color: var(--color-muted);
`;

const MinimalStatsRow = styled.div`
    ${tw`flex items-center gap-4 mt-1`};
`;

const MinimalStat = styled.span<{ $alarm?: boolean }>`
    ${tw`text-xs font-medium`};
    color: ${(props) => (props.$alarm ? '#ef4444' : 'var(--color-muted)')};
`;

const DetailedCard = styled(ServerCardBase)`
    ${tw`p-4 flex flex-col gap-3`};
`;

const DetailedHeader = styled.div`
    ${tw`flex items-start justify-between gap-3`};
`;

const DetailedMeta = styled.div`
    ${tw`flex-1 min-w-0`};
`;

const DetailedTitle = styled.h3`
    ${tw`text-sm font-semibold truncate leading-tight`};
    color: var(--color-base);
`;

/** Node / location / maintenance chips shown under the server name. */
const DetailedTagRow = styled.div`
    ${tw`flex flex-wrap items-center gap-x-3 gap-y-1 mt-1`};
`;

const DetailedStatsGrid = styled.div`
    ${tw`grid gap-2`};
    grid-template-columns: repeat(auto-fit, minmax(112px, 1fr));
`;

const DetailedFooter = styled.div`
    ${tw`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-2.5`};
    border-top: 1px solid var(--color-neutral);
`;

const DetailedNetGroup = styled.div`
    ${tw`flex items-center gap-4`};
`;

const DetailedNetItem = styled.span<{ $direction: 'down' | 'up' }>`
    ${tw`inline-flex items-center gap-1.5 text-xs font-medium`};
    color: var(--color-base);

    svg {
        font-size: 0.65rem;
        color: ${(props) => (props.$direction === 'down' ? '#22c55e' : 'var(--color-primary)')};
    }
`;

type Timer = ReturnType<typeof setInterval>;

export default ({
    server,
    className,
    layout,
    onMove,
    isDragging,
    onDragStart,
    onDragEnd,
}: {
    server: Server;
    className?: string;
    layout?: string;
    onMove?: () => void;
    isDragging?: boolean;
    onDragStart?: (event: React.DragEvent<HTMLAnchorElement>) => void;
    onDragEnd?: () => void;
}) => {
    const { t } = useTranslation('strings');
    const interval = useRef<Timer>(null) as React.MutableRefObject<Timer>;
    const [isSuspended, setIsSuspended] = useState(server.status === 'suspended');
    const [stats, setStats] = useState<ServerStats | null>(null);
    const serverCardVariant = useStoreState(
        (state: ApplicationStore) => state.settings.data?.components?.serverCard ?? 'default'
    );
    const playerCountConfig = useStoreState((state: ApplicationStore) => state.settings.data?.components?.playerCount);
    const playerCountAllowedEggs = (playerCountConfig?.allowedEggs ?? [])
        .map((eggId) => Number(eggId))
        .filter((eggId) => !Number.isNaN(eggId));
    const showPlayerCountCard =
        playerCountConfig?.enabled === true &&
        playerCountConfig?.placement === 'server_card' &&
        playerCountAllowedEggs.length > 0 &&
        playerCountAllowedEggs.includes(Number(server.eggId));

    const getStatusText = (status: ServerPowerState | undefined) => {
        if (!status || status === 'offline') return t('statuses.offline');
        if (status === 'running') return t('statuses.online');
        if (status === 'starting') return t('statuses.starting');
        if (status === 'stopping') return t('statuses.stopping');
        return t('unknown');
    };

    const eggImages = window.SiteConfiguration?.eggImages || {};
    const eggImage = server.eggId ? eggImages[server.eggId] : undefined;

    const getStats = () =>
        getServerResourceUsage(server.uuid)
            .then((data) => setStats(data))
            .catch((error) => console.error(error));

    useEffect(() => {
        setIsSuspended(stats?.isSuspended || server.status === 'suspended');
    }, [stats?.isSuspended, server.status]);

    useEffect(() => {
        if (isSuspended) return;

        getStats().then(() => {
            interval.current = setInterval(() => getStats(), 30000);
        });

        return () => {
            interval.current && clearInterval(interval.current);
        };
    }, [isSuspended]);

    const alarms = { cpu: false, memory: false, disk: false };
    if (stats) {
        alarms.cpu = server.limits.cpu === 0 ? false : stats.cpuUsagePercent >= server.limits.cpu * 0.9;
        alarms.memory = isAlarmState(stats.memoryUsageInBytes, server.limits.memory);
        alarms.disk = server.limits.disk === 0 ? false : isAlarmState(stats.diskUsageInBytes, server.limits.disk);
    }

    const diskLimit = server.limits.disk !== 0 ? bytesToString(mbToBytes(server.limits.disk)) : null;
    const memoryLimit = server.limits.memory !== 0 ? bytesToString(mbToBytes(server.limits.memory)) : null;
    const cpuLimit = server.limits.cpu !== 0 ? server.limits.cpu + '%' : null;

    const defaultAllocation = server.allocations.find((alloc) => alloc.isDefault);
    const address =
        server.primarySubdomain ||
        (defaultAllocation
            ? defaultAllocation.alias
                ? `${defaultAllocation.alias}:${defaultAllocation.port}`
                : `${ip(defaultAllocation.ip)}:${defaultAllocation.port}`
            : null);
    const blurServerHostAddress =
        !!address && !server.primarySubdomain && !!defaultAllocation && !defaultAllocation.alias;

    const memoryPercentage =
        stats && server.limits.memory > 0 ? (stats.memoryUsageInBytes / (server.limits.memory * 1024 * 1024)) * 100 : 0;

    const renderMoveButton = () =>
        onMove && (
            <MoveIconButton
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onMove();
                }}
                title={t('dashboard/index:folders.move_server', { name: server.name })}
            >
                <FontAwesomeIcon icon={faFolder} size='xs' />
            </MoveIconButton>
        );

    const renderLoadingOrSuspended = () =>
        isSuspended ? (
            <StatusTag $type='error'>
                {server.status === 'suspended' ? t('suspended') : t('statuses.connection_error')}
            </StatusTag>
        ) : server.isTransferring || server.status ? (
            <StatusTag $type={server.status === 'installing' ? 'warning' : 'info'}>
                {server.isTransferring
                    ? t('statuses.transferring')
                    : server.status === 'installing'
                    ? t('statuses.installing')
                    : server.status === 'restoring_backup'
                    ? t('statuses.restoring')
                    : t('statuses.unavailable')}
            </StatusTag>
        ) : (
            <Spinner size={'small'} />
        );

    if (serverCardVariant === 'compact') {
        return (
            <CompactCard
                to={`/server/${server.id}`}
                className={className}
                $status={stats?.status}
                $variant='compact'
                $isDragging={isDragging}
                draggable={Boolean(onDragStart)}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
            >
                <CompactHeader>
                    <CompactIcon>
                        <FontAwesomeIcon icon={faMicrochip} style={{ color: 'white', fontSize: '0.875rem' }} />
                    </CompactIcon>
                    <div className='flex items-center gap-2'>
                        {renderMoveButton()}
                        <CompactStatusDot $status={stats?.status} />
                    </div>
                </CompactHeader>

                <div>
                    <CompactTitle>{server.name}</CompactTitle>
                    <CompactSubtitle>
                        {address ? (
                            <PrivacyServerHostBlur when={blurServerHostAddress}>{address}</PrivacyServerHostBlur>
                        ) : (
                            t('no_address')
                        )}
                    </CompactSubtitle>
                </div>

                {!stats || isSuspended ? (
                    <div className='flex items-center justify-center py-2'>{renderLoadingOrSuspended()}</div>
                ) : (
                    <>
                        <CompactProgressContainer>
                            <CompactProgressBar $percentage={memoryPercentage} $alarm={alarms.memory} />
                        </CompactProgressContainer>
                        <CompactStats>
                            <span>
                                {t('cpu')}: {stats.cpuUsagePercent.toFixed(1)}%
                            </span>
                            <span>
                                {t('memory')}: {bytesToString(stats.memoryUsageInBytes)}
                            </span>
                            {showPlayerCountCard && <PlayerCountWidget server={server} variant='card' />}
                        </CompactStats>
                    </>
                )}
            </CompactCard>
        );
    }

    if (serverCardVariant === 'minimal') {
        return (
            <MinimalCard
                to={`/server/${server.id}`}
                className={className}
                $status={stats?.status}
                $variant='minimal'
                $isDragging={isDragging}
                draggable={Boolean(onDragStart)}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
            >
                <MinimalAccent />
                <MinimalBody>
                    <MinimalTopRow>
                        <MinimalTitle>{server.name}</MinimalTitle>
                        <div className='flex items-center gap-2'>
                            {renderMoveButton()}
                            {!isSuspended && stats && (
                                <StatusBadge $status={stats.status}>
                                    <FontAwesomeIcon icon={faCircle} />
                                    {getStatusText(stats.status)}
                                </StatusBadge>
                            )}
                        </div>
                    </MinimalTopRow>
                    {address && (
                        <MinimalAddress>
                            <PrivacyServerHostBlur when={blurServerHostAddress}>{address}</PrivacyServerHostBlur>
                        </MinimalAddress>
                    )}
                    {!stats || isSuspended ? (
                        <div className='flex items-center py-1'>{renderLoadingOrSuspended()}</div>
                    ) : (
                        <MinimalStatsRow>
                            <MinimalStat $alarm={alarms.cpu}>
                                {t('cpu')} {stats.cpuUsagePercent.toFixed(1)}%
                            </MinimalStat>
                            <MinimalStat $alarm={alarms.memory}>
                                {t('memory')} {bytesToString(stats.memoryUsageInBytes)}
                            </MinimalStat>
                            <MinimalStat $alarm={alarms.disk}>
                                {t('disk')} {bytesToString(stats.diskUsageInBytes)}
                            </MinimalStat>
                            {showPlayerCountCard && <PlayerCountWidget server={server} variant='card' />}
                        </MinimalStatsRow>
                    )}
                </MinimalBody>
            </MinimalCard>
        );
    }

    if (serverCardVariant === 'detailed') {
        return (
            <DetailedCard
                to={`/server/${server.id}`}
                className={className}
                $status={stats?.status}
                $variant='detailed'
                $isDragging={isDragging}
                draggable={Boolean(onDragStart)}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
            >
                <DetailedHeader>
                    <DetailedMeta>
                        <DetailedTitle>{server.name}</DetailedTitle>
                        <DetailedTagRow>
                            <MetaChip icon={faServer} title={server.node}>
                                {server.node}
                            </MetaChip>
                            {server.nodeLocation && (
                                <MetaChip icon={faMapMarkerAlt} title={server.nodeLocation}>
                                    {server.nodeLocation}
                                </MetaChip>
                            )}
                            {server.isNodeUnderMaintenance && (
                                <MetaChip icon={faCircle} tone={'warning'} title={t('maintenance', 'Maintenance')}>
                                    {t('maintenance', 'Maintenance')}
                                </MetaChip>
                            )}
                        </DetailedTagRow>
                    </DetailedMeta>
                    <div className='flex items-center gap-2 flex-shrink-0'>
                        {renderMoveButton()}
                        {!isSuspended && stats && (
                            <StatusBadge $status={stats.status}>
                                <FontAwesomeIcon icon={faCircle} />
                                {getStatusText(stats.status)}
                            </StatusBadge>
                        )}
                    </div>
                </DetailedHeader>

                <DataField
                    icon={faNetworkWired}
                    value={
                        address ? (
                            <PrivacyServerHostBlur when={blurServerHostAddress}>{address}</PrivacyServerHostBlur>
                        ) : (
                            t('no_address')
                        )
                    }
                    mono
                />

                {!stats || isSuspended ? (
                    <div className='flex items-center justify-center py-3'>{renderLoadingOrSuspended()}</div>
                ) : (
                    <>
                        <DetailedStatsGrid>
                            {[
                                {
                                    key: 'cpu',
                                    icon: faMicrochip,
                                    label: t('cpu'),
                                    value: `${stats.cpuUsagePercent.toFixed(1)}%`,
                                    limit: cpuLimit,
                                    percentage: percentOf(stats.cpuUsagePercent, server.limits.cpu),
                                },
                                {
                                    key: 'memory',
                                    icon: faMemory,
                                    label: t('memory'),
                                    value: bytesToString(stats.memoryUsageInBytes),
                                    limit: memoryLimit,
                                    percentage: percentOf(stats.memoryUsageInBytes, mbToBytes(server.limits.memory)),
                                },
                                {
                                    key: 'disk',
                                    icon: faHdd,
                                    label: t('disk'),
                                    value: bytesToString(stats.diskUsageInBytes),
                                    limit: diskLimit,
                                    percentage: percentOf(stats.diskUsageInBytes, mbToBytes(server.limits.disk)),
                                },
                            ].map((stat) => (
                                <StatTile
                                    key={stat.key}
                                    icon={stat.icon}
                                    label={stat.label}
                                    value={stat.value}
                                    limit={stat.limit}
                                    percentage={stat.percentage}
                                />
                            ))}
                        </DetailedStatsGrid>

                        <DetailedFooter>
                            <DetailedNetGroup>
                                <DetailedNetItem $direction='down' title={t('network')}>
                                    <FontAwesomeIcon icon={faArrowDown} />
                                    {bytesToString(stats.networkRxInBytes)}
                                </DetailedNetItem>
                                <DetailedNetItem $direction='up' title={t('network')}>
                                    <FontAwesomeIcon icon={faArrowUp} />
                                    {bytesToString(stats.networkTxInBytes)}
                                </DetailedNetItem>
                            </DetailedNetGroup>
                            {showPlayerCountCard && <PlayerCountWidget server={server} variant='card' />}
                        </DetailedFooter>
                    </>
                )}
            </DetailedCard>
        );
    }

    return (
        <DefaultCard
            to={`/server/${server.id}`}
            className={className}
            $status={stats?.status}
            $eggImage={eggImage}
            $layout={layout}
            $variant='default'
            $isDragging={isDragging}
            draggable={Boolean(onDragStart)}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
        >
            <DefaultCardHeader>
                <DefaultServerInfo>
                    <DefaultServerName>{server.name}</DefaultServerName>
                </DefaultServerInfo>
                <div className='flex items-center gap-2'>
                    {renderMoveButton()}
                    {!isSuspended && stats && (
                        <StatusBadge $status={stats.status}>
                            <FontAwesomeIcon icon={faCircle} />
                            {getStatusText(stats.status)}
                        </StatusBadge>
                    )}
                </div>
            </DefaultCardHeader>

            {!stats || isSuspended ? (
                <DefaultStatusMessage>{renderLoadingOrSuspended()}</DefaultStatusMessage>
            ) : (
                <DefaultStatsRow>
                    <DefaultStatItem $alarm={alarms.cpu}>
                        <DefaultStatIcon $alarm={alarms.cpu}>
                            <FontAwesomeIcon icon={faMicrochip} />
                        </DefaultStatIcon>
                        <DefaultStatValue $alarm={alarms.cpu}>{stats.cpuUsagePercent.toFixed(1)}%</DefaultStatValue>
                        {cpuLimit && <DefaultStatLimit>/ {cpuLimit}</DefaultStatLimit>}
                    </DefaultStatItem>

                    <DefaultStatItem $alarm={alarms.memory}>
                        <DefaultStatIcon $alarm={alarms.memory}>
                            <FontAwesomeIcon icon={faMemory} />
                        </DefaultStatIcon>
                        <DefaultStatValue $alarm={alarms.memory}>
                            {bytesToString(stats.memoryUsageInBytes)}
                        </DefaultStatValue>
                        {memoryLimit && <DefaultStatLimit>/ {memoryLimit}</DefaultStatLimit>}
                    </DefaultStatItem>

                    <DefaultStatItem $alarm={alarms.disk}>
                        <DefaultStatIcon $alarm={alarms.disk}>
                            <FontAwesomeIcon icon={faHdd} />
                        </DefaultStatIcon>
                        <DefaultStatValue $alarm={alarms.disk}>
                            {bytesToString(stats.diskUsageInBytes)}
                        </DefaultStatValue>
                        {diskLimit && <DefaultStatLimit>/ {diskLimit}</DefaultStatLimit>}
                    </DefaultStatItem>

                    {address && (
                        <DefaultStatItem>
                            <DefaultStatIcon>
                                <FontAwesomeIcon icon={faNetworkWired} />
                            </DefaultStatIcon>
                            <DefaultStatValue>
                                <PrivacyServerHostBlur when={blurServerHostAddress}>{address}</PrivacyServerHostBlur>
                            </DefaultStatValue>
                        </DefaultStatItem>
                    )}
                    {showPlayerCountCard && (
                        <DefaultStatItem>
                            <PlayerCountWidget server={server} variant='card' />
                        </DefaultStatItem>
                    )}
                </DefaultStatsRow>
            )}
        </DefaultCard>
    );
};
