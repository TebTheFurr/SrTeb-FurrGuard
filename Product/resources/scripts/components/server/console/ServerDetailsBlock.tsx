import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStoreState } from 'easy-peasy';
import {
    faServer,
    faCubes,
    faDatabase,
    faNetworkWired,
} from '@fortawesome/free-solid-svg-icons';
import { bytesToString, ip, mbToBytes } from '@/lib/formatters';
import { ServerContext } from '@/state/server';
import { SocketEvent, SocketRequest } from '@/components/server/events';
import StatBlock from '@/components/server/console/StatBlock';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';
import classNames from 'classnames';
import PrivacyServerHostBlur from '@/components/elements/PrivacyServerHostBlur';
import { ApplicationStore } from '@/state';
import PlayerCountWidget from '../PlayerCountWidget';

type Stats = Record<'memory' | 'cpu' | 'disk', number>;

const getBackgroundColor = (value: number, max: number | null): string | undefined => {
    const delta = !max ? 0 : value / max;

    if (delta > 0.8) {
        if (delta > 0.9) {
            return 'bg-red-500';
        }
        return 'bg-yellow-500';
    }

    return undefined;
};

const Limit = ({ limit, children }: { limit: string | null; children: React.ReactNode }) => (
    <>
        {children}
        {limit && (
            <span className={'ml-1 text-[70%] select-none'} style={{ color: 'var(--color-inverted)' }}>
                / {limit}
            </span>
        )}
    </>
);

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
        let stats: any = {};
        try {
            stats = JSON.parse(data);
        } catch (e) {
            return;
        }

        setStats({
            memory: stats.memory_bytes,
            cpu: stats.cpu_absolute,
            disk: stats.disk_bytes,
        });
    });

    return (
        <div className={classNames(className)}>
            <div className={classNames('grid grid-cols-1 sm:grid-cols-2 gap-3', showPlayerCountStat ? 'lg:grid-cols-5' : 'lg:grid-cols-4')}>
                <StatBlock icon={faServer} title={t('console.details.cpu')} color={getBackgroundColor(stats.cpu, limits.cpu)}>
                    {status === 'offline' ? (
                        <span style={{ color: 'var(--color-inverted)' }}>{t('console.details.offline')}</span>
                    ) : (
                        <Limit limit={textLimits.cpu}>{stats.cpu.toFixed(2)}%</Limit>
                    )}
                </StatBlock>
                <StatBlock
                    icon={faCubes}
                    title={t('console.details.memory')}
                    color={getBackgroundColor(stats.memory / 1024, limits.memory * 1024)}
                >
                    {status === 'offline' ? (
                        <span style={{ color: 'var(--color-inverted)' }}>{t('console.details.offline')}</span>
                    ) : (
                        <Limit limit={textLimits.memory}>{bytesToString(stats.memory)}</Limit>
                    )}
                </StatBlock>
                <StatBlock icon={faDatabase} title={t('console.details.disk')} color={getBackgroundColor(stats.disk / 1024, limits.disk * 1024)}>
                    <Limit limit={textLimits.disk}>{bytesToString(stats.disk)}</Limit>
                </StatBlock>
                <StatBlock icon={faNetworkWired} title={t('console.details.address')} copyOnClick={allocation}>
                    <PrivacyServerHostBlur when={blurAllocationHost}>{allocation}</PrivacyServerHostBlur>
                </StatBlock>
                {showPlayerCountStat && <PlayerCountWidget server={serverData} variant="stat" />}
            </div>
        </div>
    );
};

export default ServerDetailsBlock;
