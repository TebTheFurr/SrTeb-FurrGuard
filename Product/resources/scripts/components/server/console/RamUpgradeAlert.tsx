import React, { useState, useEffect } from 'react';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import { ServerContext } from '@/state/server';
import useWebsocketEvent from '@/plugins/useWebsocketEvent';
import { SocketEvent, SocketRequest } from '@/components/server/events';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMemory, faTimes } from '@fortawesome/free-solid-svg-icons';
import styled from 'styled-components/macro';

const AlertContainer = styled.div`
    display: flex;
    margin-top: 1rem;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 1rem 1.5rem;
    border-radius: var(--border-radius, 8px);
    border: 1px solid #f97316;
    margin-bottom: 1rem;
    background-color: rgba(249, 115, 22, 0.12);
    
    @media (max-width: 768px) {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.75rem;
    }
`;

const ContentWrapper = styled.div`
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
    
    @media (max-width: 768px) {
        width: 100%;
    }
`;

const IconWrapper = styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    background-color: rgba(249, 115, 22, 0.15);
    color: #f97316;
    flex-shrink: 0;
`;

const TextWrapper = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
`;

const AlertTitle = styled.h4`
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: #f97316;
`;

const AlertText = styled.p`
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-base);
    line-height: 1.5;
`;

const ButtonGroup = styled.div`
    display: flex;
    gap: 0.5rem;
    
    @media (max-width: 768px) {
        width: 100%;
        flex-direction: column;
    }
`;

const AlertButton = styled.button`
    padding: 0.5rem 1rem;
    border-radius: calc(var(--border-radius, 8px) - 2px);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
    white-space: nowrap;
    background-color: var(--color-primary);
    border: 1px solid var(--color-primary);
    color: #ffffff;
    
    &:hover {
        opacity: 0.85;
    }
    
    @media (max-width: 768px) {
        width: 100%;
    }
`;

const CloseButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border: none;
    background: transparent;
    color: #f97316;
    cursor: pointer;
    border-radius: 6px;
    transition: all 150ms ease;
    flex-shrink: 0;
    align-self: flex-start;
    
    &:hover {
        background-color: rgba(249, 115, 22, 0.1);
    }
`;

interface RamUpgradeAlertConfig {
    enabled?: boolean;
    threshold?: number;
    title?: string;
    text?: string;
    upgradeButtonLink?: string;
}

const RamUpgradeAlert = () => {
    const config = useStoreState((state: ApplicationStore) => 
        state.settings.data?.components?.ramUpgradeAlert as RamUpgradeAlertConfig | undefined
    );
    const billingIntegration = useStoreState((state: ApplicationStore) => 
        state.settings.data?.advanced?.billingIntegration
    );
    
    const server = ServerContext.useStoreState((state) => state.server.data);
    const limits = ServerContext.useStoreState((state) => state.server.data!.limits);
    const status = ServerContext.useStoreState((state) => state.status.value);
    const connected = ServerContext.useStoreState((state) => state.socket.connected);
    const instance = ServerContext.useStoreState((state) => state.socket.instance);
    const [currentMemory, setCurrentMemory] = useState<number>(0);
    const [dismissed, setDismissed] = useState<boolean>(false);

    useEffect(() => {
        if (!connected || !instance) {
            return;
        }

        instance.send(SocketRequest.SEND_STATS);
    }, [connected, instance]);
    
    useWebsocketEvent(SocketEvent.STATS, (data) => {
        let stats: any = {};
        try {
            stats = JSON.parse(data);
        } catch (e) {
            return;
        }

        if (typeof stats.memory_bytes === 'number') {
            setCurrentMemory(stats.memory_bytes);
        }
    });
    
    useEffect(() => {
        setDismissed(false);
    }, [limits.memory]);
    
    if (!config?.enabled || status === 'offline' || dismissed) {
        return null;
    }
    
    if (!limits.memory || limits.memory === 0) {
        return null;
    }
    
    const memoryLimitBytes = limits.memory * 1024 * 1024;
    const memoryUsagePercent = (currentMemory / memoryLimitBytes) * 100;
    const threshold = config.threshold || 85;
    
    if (memoryUsagePercent < threshold) {
        return null;
    }
    
    const title = config.title || 'RAM Limit Approaching';
    const text = config.text || 'Your server is using a high amount of RAM. Consider upgrading to a higher plan to ensure optimal performance.';
    
    let upgradeButtonLink = config.upgradeButtonLink || '/store';
    
    if (billingIntegration?.enabled && server?.externalId && billingIntegration?.billingUrl) {
        const baseUrl = billingIntegration.billingUrl.replace(/\/+$/, '');
        upgradeButtonLink = `${baseUrl}/services/${server.externalId}/upgrade`;
    }
    
    return (
        <AlertContainer>
            <ContentWrapper>
                <IconWrapper>
                    <FontAwesomeIcon icon={faMemory} />
                </IconWrapper>
                <TextWrapper>
                    <AlertTitle>{title}</AlertTitle>
                    <AlertText>{text}</AlertText>
                </TextWrapper>
            </ContentWrapper>
            <ButtonGroup>
                <AlertButton 
                    onClick={() => {
                        window.location.href = upgradeButtonLink;
                    }}
                >
                    Upgrade Plan
                </AlertButton>
                <CloseButton 
                    onClick={() => setDismissed(true)}
                    aria-label="Dismiss alert"
                >
                    <FontAwesomeIcon icon={faTimes} />
                </CloseButton>
            </ButtonGroup>
        </AlertContainer>
    );
};

export default RamUpgradeAlert;
