import React from 'react';
import { ServerContext } from '@/state/server';
import styled, { css, keyframes } from 'styled-components/macro';
import { useTranslation } from 'react-i18next';

const pulse = keyframes`
    0%, 100% {
        opacity: 1;
    }
    50% {
        opacity: 0.5;
    }
`;

const StatusDot = styled.span<{ $isRunning: boolean; $color: string }>`
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    background-color: ${(props) => props.$color};
    animation: ${(props) =>
        props.$isRunning
            ? css`
                  ${pulse} 2s ease-in-out infinite
              `
            : 'none'};
`;

const StatusBadge = () => {
    const { t } = useTranslation('strings');
    const status = ServerContext.useStoreState((state) => state.status.value);

    const getStatusColor = () => {
        if (status === 'running') return '#22c55e';
        if (status === 'starting') return '#eab308';
        if (status === 'stopping') return '#f97316';
        if (status === 'offline') return 'var(--color-inverted)';
        return 'var(--color-muted)';
    };

    const getStatusText = () => {
        if (status === null || status === 'offline') return t('statuses.offline');
        if (status === 'running') return t('statuses.online');
        if (status === 'starting') return t('statuses.starting');
        if (status === 'stopping') return t('statuses.stopping');
        return t('unknown');
    };

    const isOffline = status === null || status === 'offline';

    return (
        <div className={'flex items-center gap-2'}>
            {!isOffline && <StatusDot $isRunning={status === 'running'} $color={getStatusColor()} />}
            <span
                className={'text-sm font-medium'}
                style={{ color: 'var(--color-muted)' }}
            >
                {getStatusText()}
            </span>
        </div>
    );
};

export default StatusBadge;
