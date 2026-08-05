import React, { useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlay, faSync, faStop, faSkull } from '@fortawesome/free-solid-svg-icons';
import Can from '@/components/elements/Can';
import { ServerContext } from '@/state/server';
import { Dialog } from '@/components/elements/dialog';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';

type PowerAction = 'start' | 'stop' | 'restart' | 'kill';

const fadeIn = keyframes`
    from {
        opacity: 0;
        transform: translateY(20px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
`;

const DockContainer = styled.div<{ $bottombarLayout?: boolean }>`
    ${tw`fixed left-0 right-0 flex justify-center pointer-events-none`};
    bottom: ${(props) => (props.$bottombarLayout ? '5rem' : '2rem')};
    z-index: 40;

    @media (max-width: 1023px) {
        display: none;
    }
`;

const Dock = styled.div`
    ${tw`flex items-center gap-2 pointer-events-auto shadow-lg`};
    padding: 8px 12px;
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 12px);
    backdrop-filter: blur(10px);
    animation: ${fadeIn} 0.3s ease-out;
`;

const DockButton = styled.button<{ $variant?: 'start' | 'restart' | 'stop' | 'kill' }>`
    ${tw`flex items-center justify-center transition-all duration-150`};
    width: 44px;
    height: 44px;
    border-radius: var(--border-radius, 12px);
    border: 1px solid transparent;
    background-color: ${(props) => {
        switch (props.$variant) {
            case 'start':
                return '#22c55e';
            case 'restart':
                return 'var(--color-background-secondary)';
            case 'stop':
            case 'kill':
                return '#ef4444';
            default:
                return 'var(--color-neutral)';
        }
    }};
    border-color: ${(props) => props.$variant === 'restart' ? 'var(--color-neutral)' : 'transparent'};
    color: white;
    cursor: pointer;

    &:hover:not(:disabled) {
        transform: scale(1.03);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    }

    &:active:not(:disabled) {
        transform: scale(1.05);
    }

    &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
        background-color: var(--color-neutral);
    }

    & svg {
        width: 18px;
        height: 18px;
    }
`;

const SmallButton = styled.button<{ $variant?: 'start' | 'restart' | 'stop' | 'kill' }>`
    ${tw`flex items-center justify-center transition-all duration-150`};
    width: 32px;
    height: 32px;
    border-radius: var(--border-radius, 12px);
    border: 1px solid transparent;
    background-color: ${(props) => {
        switch (props.$variant) {
            case 'start':
                return '#22c55e';
            case 'restart':
                return 'var(--color-neutral)';
            case 'stop':
            case 'kill':
                return '#ef4444';
            default:
                return 'var(--color-neutral)';
        }
    }};
    color: white;
    cursor: pointer;

    &:hover:not(:disabled) {
        transform: scale(1.03);
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    }

    &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
        background-color: var(--color-neutral);
    }

    & svg {
        width: 12px;
        height: 12px;
    }
`;

const Tooltip = styled.span`
    ${tw`absolute bottom-full mb-2 px-2 py-1 text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none transition-opacity duration-150`};
    background-color: var(--color-background);
    border: 1px solid var(--color-neutral);
    border-radius: 6px;
    color: var(--color-base);
`;

const ButtonWrapper = styled.div<{ $showLabel?: boolean }>`
    ${tw`relative flex justify-center`};
    flex-direction: ${(props) => (props.$showLabel ? 'column' : 'row')};
    align-items: center;
    gap: ${(props) => (props.$showLabel ? '6px' : '0')};

    &:hover ${Tooltip} {
        opacity: 1;
    }
`;

const Label = styled.span`
    ${tw`text-xs font-medium whitespace-nowrap`};
    color: var(--color-base);
    opacity: 0.85;
`;

const TopbarContainer = styled.div`
    ${tw`flex items-center justify-between w-full mb-4 p-3`};
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 12px);
`;

const TopbarTitle = styled.h2`
    ${tw`font-semibold text-base`};
    color: var(--color-base);
`;

const TopbarControls = styled.div`
    ${tw`flex items-center gap-2`};
`;

export const usePowerControls = () => {
    const [open, setOpen] = useState(false);
    const status = ServerContext.useStoreState((state) => state.status.value);
    const instance = ServerContext.useStoreState((state) => state.socket.instance);

    const killable = status === 'stopping';

    const onButtonClick = (
        action: PowerAction | 'kill-confirmed',
        e: React.MouseEvent<HTMLButtonElement, MouseEvent>
    ): void => {
        e.preventDefault();
        if (action === 'kill') {
            return setOpen(true);
        }

        if (instance) {
            setOpen(false);
            instance.send('set state', action === 'kill-confirmed' ? 'kill' : action);
        }
    };

    useEffect(() => {
        if (status === 'offline') {
            setOpen(false);
        }
    }, [status]);

    useEffect(() => {
        const handler = (event: Event) => {
            const customEvent = event as CustomEvent<{ action?: PowerAction }>;
            const action = customEvent.detail?.action;
            if (!action || !instance) {
                return;
            }
            instance.send('set state', action);
        };

        window.addEventListener('luna:keybind:power', handler as EventListener);
        return () => window.removeEventListener('luna:keybind:power', handler as EventListener);
    }, [instance]);

    return { open, setOpen, status, killable, onButtonClick };
};

interface PowerControlsDialogProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    onButtonClick: (action: PowerAction | 'kill-confirmed', e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
}

export const PowerControlsDialog: React.FC<PowerControlsDialogProps> = ({ open, setOpen, onButtonClick }) => (
    <Dialog.Confirm
        open={open}
        hideCloseIcon
        onClose={() => setOpen(false)}
        title={'Forcibly Stop Process'}
        confirm={'Continue'}
        onConfirmed={onButtonClick.bind(null, 'kill-confirmed')}
    >
        Forcibly stopping a server can lead to data corruption.
    </Dialog.Confirm>
);

export const SidebarPowerControls = () => {
    const isInPanel = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('_panel') === '1';
    const { open, setOpen, status, killable, onButtonClick } = usePowerControls();

    if (isInPanel) {
        return null;
    }

    return (
        <>
            <PowerControlsDialog open={open} setOpen={setOpen} onButtonClick={onButtonClick} />
            <div style={{ 
                display: 'flex', 
                gap: '6px', 
                padding: '0 16px',
                marginBottom: '12px',
            }}>
                <Can action={'control.start'}>
                    <SmallButton
                        $variant="start"
                        disabled={status !== 'offline'}
                        onClick={onButtonClick.bind(null, 'start')}
                        title="Start"
                    >
                        <FontAwesomeIcon icon={faPlay} />
                    </SmallButton>
                </Can>
                <Can action={'control.restart'}>
                    <SmallButton
                        $variant="restart"
                        disabled={!status}
                        onClick={onButtonClick.bind(null, 'restart')}
                        title="Restart"
                    >
                        <FontAwesomeIcon icon={faSync} />
                    </SmallButton>
                </Can>
                <Can action={'control.stop'}>
                    <SmallButton
                        $variant={killable ? 'kill' : 'stop'}
                        disabled={status === 'offline'}
                        onClick={onButtonClick.bind(null, killable ? 'kill' : 'stop')}
                        title={killable ? 'Kill' : 'Stop'}
                    >
                        <FontAwesomeIcon icon={killable ? faSkull : faStop} />
                    </SmallButton>
                </Can>
            </div>
        </>
    );
};

export const TopbarPowerControls = () => {
    const isInPanel = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('_panel') === '1';
    const { open, setOpen, status, killable, onButtonClick } = usePowerControls();
    const serverName = ServerContext.useStoreState((state) => state.server.data?.name);

    if (isInPanel) {
        return null;
    }

    return (
        <>
            <PowerControlsDialog open={open} setOpen={setOpen} onButtonClick={onButtonClick} />
            <TopbarContainer>
                <TopbarTitle>{serverName || 'Server'}</TopbarTitle>
                <TopbarControls>
                    <Can action={'control.start'}>
                        <SmallButton
                            $variant="start"
                            disabled={status !== 'offline'}
                            onClick={onButtonClick.bind(null, 'start')}
                            title="Start"
                        >
                            <FontAwesomeIcon icon={faPlay} />
                        </SmallButton>
                    </Can>
                    <Can action={'control.restart'}>
                        <SmallButton
                            $variant="restart"
                            disabled={!status}
                            onClick={onButtonClick.bind(null, 'restart')}
                            title="Restart"
                        >
                            <FontAwesomeIcon icon={faSync} />
                        </SmallButton>
                    </Can>
                    <Can action={'control.stop'}>
                        <SmallButton
                            $variant={killable ? 'kill' : 'stop'}
                            disabled={status === 'offline'}
                            onClick={onButtonClick.bind(null, killable ? 'kill' : 'stop')}
                            title={killable ? 'Kill' : 'Stop'}
                        >
                            <FontAwesomeIcon icon={killable ? faSkull : faStop} />
                        </SmallButton>
                    </Can>
                </TopbarControls>
            </TopbarContainer>
        </>
    );
};

const PowerDock = () => {
    const isInPanel = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('_panel') === '1';
    const { open, setOpen, status, killable, onButtonClick } = usePowerControls();
    const layoutType = useStoreState((state: ApplicationStore) => state.settings.data?.layout?.layoutType ?? 'default');
    const powerDockLocation = useStoreState((state: ApplicationStore) => state.settings.data?.components?.powerDock ?? 'dock');

    const isBottombarLayout = layoutType === 'bottombar';
    const showLabels = powerDockLocation === 'dock_labels';

    if (isInPanel || (powerDockLocation !== 'dock' && powerDockLocation !== 'dock_labels')) {
        return null;
    }

    return (
        <DockContainer $bottombarLayout={isBottombarLayout}>
            <PowerControlsDialog open={open} setOpen={setOpen} onButtonClick={onButtonClick} />
            <Dock>
                <Can action={'control.start'}>
                    <ButtonWrapper $showLabel={showLabels}>
                        <DockButton
                            $variant="start"
                            disabled={status !== 'offline'}
                            onClick={onButtonClick.bind(null, 'start')}
                            aria-label="Start"
                        >
                            <FontAwesomeIcon icon={faPlay} />
                        </DockButton>
                        {showLabels ? <Label>Start</Label> : <Tooltip>Start</Tooltip>}
                    </ButtonWrapper>
                </Can>
                <Can action={'control.restart'}>
                    <ButtonWrapper $showLabel={showLabels}>
                        <DockButton
                            $variant="restart"
                            disabled={!status}
                            onClick={onButtonClick.bind(null, 'restart')}
                            aria-label="Restart"
                        >
                            <FontAwesomeIcon icon={faSync} style={{ color: 'white' }} />
                        </DockButton>
                        {showLabels ? <Label>Restart</Label> : <Tooltip>Restart</Tooltip>}
                    </ButtonWrapper>
                </Can>
                <Can action={'control.stop'}>
                    <ButtonWrapper $showLabel={showLabels}>
                        <DockButton
                            $variant={killable ? 'kill' : 'stop'}
                            disabled={status === 'offline'}
                            onClick={onButtonClick.bind(null, killable ? 'kill' : 'stop')}
                            aria-label={killable ? 'Kill' : 'Stop'}
                        >
                            <FontAwesomeIcon icon={killable ? faSkull : faStop} />
                        </DockButton>
                        {showLabels ? <Label>{killable ? 'Kill' : 'Stop'}</Label> : <Tooltip>{killable ? 'Kill' : 'Stop'}</Tooltip>}
                    </ButtonWrapper>
                </Can>
            </Dock>
        </DockContainer>
    );
};

export default PowerDock;
