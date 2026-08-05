import React, { useEffect, useState } from 'react';
import { ServerContext } from '@/state/server';
import { SocketEvent, SocketRequest } from '@/components/server/events';
import UptimeDuration from '@/components/server/UptimeDuration';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';

const UptimeDisplay = () => {
    const [uptime, setUptime] = useState<number>(0);

    const status = ServerContext.useStoreState((state) => state.status.value);
    const connected = ServerContext.useStoreState((state) => state.socket.connected);
    const instance = ServerContext.useStoreState((state) => state.socket.instance);

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

        setUptime(stats.uptime || 0);
    });

    if (status === null || status === 'offline' || uptime <= 0) {
        return null;
    }

    return (
        <div className={'flex items-center gap-2 text-sm'} style={{ color: 'var(--color-muted)' }}>
            <span>Uptime:</span>
            <span style={{ color: 'var(--color-base)' }}>
                <UptimeDuration uptime={uptime / 1000} />
            </span>
        </div>
    );
};

export default UptimeDisplay;
