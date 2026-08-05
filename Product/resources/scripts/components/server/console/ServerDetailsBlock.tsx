import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStoreState } from 'easy-peasy';
import { faHdd, faMemory, faMicrochip, faNetworkWired } from '@fortawesome/free-solid-svg-icons';
import { bytesToString, ip, mbToBytes } from '@/lib/formatters';
import { ServerContext } from '@/state/server';
import { SocketEvent, SocketRequest } from '@/components/server/events';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';
import classNames from 'classnames';
import PrivacyServerHostBlur from '@/components/elements/PrivacyServerHostBlur';
import { ApplicationStore } from '@/state';
import PlayerCountWidget from '../PlayerCountWidget';
import StatTile from '@/components/elements/ui/StatTile';
import { percentOf } from '@/components/elements/ui/tokens';
import styled from 'styled-components/macro';
import tw from 'twin.macro';

type Stats = Record<'memory' | 'cpu' | 'disk', number>;

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
    const { t } = useTranslation('server');
    const [stats, setStats] = useState<Stats>({ memory: 0, cpu: 0, disk: 0 });

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

    const textLimits = useMemo(
        () => ({
            cpu: limits?.cpu ? `${limits.cpu}%` : null,
            memory: limits?.memory ? bytesToString(mbToBytes(limits.memory)) : null,
            disk: limits?.disk ? bytesToString(mbToBytes(limits.disk)) : null,
        }),
        [limits]
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
        let values: any = {};
        try {
            values = JSON.parse(data);
        } catch (e) {
            return;
        }

        setStats({
            memory: values.memory_bytes,
            cpu: values.cpu_absolute,
            disk: values.disk_bytes,
        });
    });

    // A stopped server reports no live usage, so the bars are hidden rather
    // than pinned at zero, which would read as "measured and empty".
    const cpuPercentage = isOffline ? null : percentOf(stats.cpu, limits.cpu);
    const memoryPercentage = isOffline ? null : percentOf(stats.memory, mbToBytes(limits.memory));
    const diskPercentage = percentOf(stats.disk, mbToBytes(limits.disk));

    return (
        <div className={classNames(className)}>
            <Grid $columns={showPlayerCountStat ? 5 : 4}>
                <StatTile
                    icon={faMicrochip}
                    label={t('console.details.cpu')}
                    value={isOffline ? <Offline>{t('console.details.offline')}</Offline> : `${stats.cpu.toFixed(2)}%`}
                    limit={textLimits.cpu}
                    percentage={cpuPercentage}
                    hideLimit={isOffline}
                />
                <StatTile
                    icon={faMemory}
                    label={t('console.details.memory')}
                    value={
                        isOffline ? <Offline>{t('console.details.offline')}</Offline> : bytesToString(stats.memory)
                    }
                    limit={textLimits.memory}
                    percentage={memoryPercentage}
                    hideLimit={isOffline}
                />
                <StatTile
                    icon={faHdd}
                    label={t('console.details.disk')}
                    value={bytesToString(stats.disk)}
                    limit={textLimits.disk}
                    percentage={diskPercentage}
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
