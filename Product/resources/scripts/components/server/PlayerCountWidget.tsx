import React, { useEffect, useMemo, useState } from 'react';
import classNames from 'classnames';
import { useStoreState } from 'easy-peasy';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers } from '@fortawesome/free-solid-svg-icons';
import { ApplicationStore } from '../../state';
import { Server } from '../../api/server/getServer';
import getMinecraftStatus, { MinecraftStatus } from '../../api/server/getMinecraftStatus';
import StatBlock from './console/StatBlock';
import styles from './PlayerCountWidget.module.css';

type PlayerCountWidgetVariant = 'sidebar' | 'stat' | 'card';

const placementByVariant: Record<PlayerCountWidgetVariant, 'sidebar' | 'stat_block' | 'server_card'> = {
    sidebar: 'sidebar',
    stat: 'stat_block',
    card: 'server_card',
};

interface PlayerCountWidgetProps {
    server: Server;
    variant: PlayerCountWidgetVariant;
    className?: string;
}

const cleanAddress = (address: string | null | undefined): string | null => {
    if (!address) {
        return null;
    }

    const trimmed = address.trim();

    if (!trimmed) {
        return null;
    }

    return trimmed.replace(/^https?:\/\//, '').split('/')[0];
};

const getServerAddress = (server: Server): string | null => {
    const primarySubdomain = cleanAddress(server.primarySubdomain);

    if (primarySubdomain) {
        return primarySubdomain;
    }

    const allocation = server.allocations.find((item) => item.isDefault);

    if (!allocation) {
        return null;
    }

    return cleanAddress(`${allocation.alias || allocation.ip}:${allocation.port}`);
};

const formatPlayers = (status: MinecraftStatus | null, hasFetched: boolean): string => {
    if (!hasFetched) {
        return 'Loading';
    }

    if (!status || !status.online) {
        return 'Offline';
    }

    if (status.players.max > 0) {
        return `${status.players.online} / ${status.players.max}`;
    }

    return `${status.players.online}`;
};

const formatSidebarPlayers = (status: MinecraftStatus | null, hasFetched: boolean): string => {
    if (!hasFetched) {
        return 'Checking players';
    }

    if (!status || !status.online) {
        return '0/0 players';
    }

    if (status.players.max > 0) {
        return `${status.players.online}/${status.players.max} players`;
    }

    return `${status.players.online}/0 players`;
};

const getAlarmColor = (status: MinecraftStatus | null): string | undefined => {
    if (!status?.online || status.players.max <= 0) {
        return undefined;
    }

    const usage = status.players.online / status.players.max;

    if (usage >= 0.9) {
        return 'bg-red-500';
    }

    if (usage >= 0.8) {
        return 'bg-yellow-500';
    }

    return undefined;
};

const PlayerCountWidget = ({ server, variant, className }: PlayerCountWidgetProps) => {
    const config = useStoreState((state: ApplicationStore) => state.settings.data?.components?.playerCount);
    const [status, setStatus] = useState<MinecraftStatus | null>(null);
    const [hasFetched, setHasFetched] = useState(false);

    const allowedEggs = useMemo(() => {
        return (config?.allowedEggs ?? []).map((eggId) => Number(eggId)).filter((eggId) => !Number.isNaN(eggId));
    }, [config?.allowedEggs]);

    const address = useMemo(() => getServerAddress(server), [server]);
    const placement = config?.placement ?? 'sidebar';
    const isVisible =
        config?.enabled === true &&
        placement === placementByVariant[variant] &&
        allowedEggs.length > 0 &&
        allowedEggs.includes(Number(server.eggId));

    useEffect(() => {
        if (!isVisible || !address) {
            setStatus(null);
            setHasFetched(false);
            return;
        }

        let isMounted = true;

        const updateStatus = () => {
            getMinecraftStatus(address)
                .then((data) => {
                    if (isMounted) {
                        setStatus(data);
                        setHasFetched(true);
                    }
                })
                .catch(() => {
                    if (isMounted) {
                        setStatus(null);
                        setHasFetched(true);
                    }
                });
        };

        setStatus(null);
        setHasFetched(false);
        updateStatus();

        const interval = window.setInterval(updateStatus, 5000);

        return () => {
            isMounted = false;
            window.clearInterval(interval);
        };
    }, [address, isVisible]);

    if (!isVisible || !address) {
        return null;
    }

    const value = formatPlayers(status, hasFetched);

    if (variant === 'stat') {
        return (
            <StatBlock title={'Players'} icon={faUsers} color={getAlarmColor(status)} className={className}>
                {value}
            </StatBlock>
        );
    }

    if (variant === 'card') {
        return (
            <span className={classNames(styles.card, className)} title={`Players: ${value}`}>
                <FontAwesomeIcon icon={faUsers} className={styles.cardIcon} />
                <span className={styles.cardLabel}>{value}</span>
            </span>
        );
    }

    return (
        <div className={classNames(styles.sidebar, className)} title={`Players: ${value}`}>
            <span className={styles.sidebarPulse} />
            <span>{formatSidebarPlayers(status, hasFetched)}</span>
        </div>
    );
};

export default PlayerCountWidget;
