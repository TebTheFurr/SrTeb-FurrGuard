import React, { useRef, useState, useEffect } from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTerminal, faTimes, faPause, faPlay, faClipboard, faCheck, faSpinner, faTrash } from '@fortawesome/free-solid-svg-icons';
import Console, { ConsoleHandle, TerminalButton, ShareButton } from './Console';
import { useConsoleSidebar } from '@/state/consoleSidebar';

const SidebarWrapper = styled.aside<{ $isOpen: boolean }>`
    position: fixed;
    top: var(--announcement-top-offset, 0px);
    right: 0;
    z-index: 25;
    width: 380px;
    height: calc(100vh - var(--announcement-top-offset, 0px));
    background-color: var(--color-background-secondary);
    border-left: 1px solid var(--color-neutral);
    transform: translateX(${(props) => (props.$isOpen ? '0' : '100%')});
    transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    flex-direction: column;

    @media (max-width: 1280px) {
        width: 340px;
    }

    @media (max-width: 1024px) {
        width: 100%;
        max-width: 400px;
    }
`;

const SidebarHeader = styled.div`
    ${tw`flex items-center justify-between px-4 py-3 flex-shrink-0`};
    border-bottom: 1px solid var(--color-neutral);
`;

const SidebarHeaderLeft = styled.div`
    ${tw`flex items-center gap-2`};
`;

const SidebarHeaderRight = styled.div`
    ${tw`flex items-center gap-1`};
`;

const SidebarTitle = styled.h3`
    ${tw`flex items-center gap-2 text-sm font-semibold`};
    color: var(--color-base);

    svg {
        color: var(--color-primary);
    }
`;

const CloseButton = styled.button`
    ${tw`flex items-center justify-center w-8 h-8 rounded-lg`};
    color: var(--color-muted);
    background: transparent;
    border: none;
    transition: all 150ms ease;
    cursor: pointer;

    &:hover {
        color: var(--color-base);
        background-color: var(--color-neutral);
    }
`;

const SidebarContent = styled.div`
    ${tw`flex-1 overflow-hidden`};
    min-height: 0;
`;

const ToggleButton = styled.button<{ $isOpen: boolean }>`
    position: fixed;
    right: ${(props) => (props.$isOpen ? '380px' : '0')};
    top: 50%;
    transform: translateY(-50%) translateX(${(props) => (props.$isOpen ? '0' : '4px')});
    z-index: 26;
    ${tw`flex items-center justify-center`};
    width: 28px;
    height: 80px;
    background-color: var(--color-background-secondary);
    color: var(--color-muted);
    border: 1px solid var(--color-neutral);
    border-right: none;
    border-right: ${(props) => (props.$isOpen ? '1px solid var(--color-neutral)' : 'none')};
    border-top-left-radius: var(--border-radius, 12px);
    border-bottom-left-radius: var(--border-radius, 12px);
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    box-shadow: -4px 0 12px rgba(0, 0, 0, 0.1);
    transition: all 300ms cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;

    svg {
        font-size: 0.875rem;
        transition: color 150ms ease;
    }

    &:hover {
        transform: translateY(-50%) translateX(0);
        color: var(--color-primary);
        background-color: var(--color-background-secondary);
    }

    @media (max-width: 1280px) {
        right: ${(props) => (props.$isOpen ? '340px' : '0')};
    }

    @media (max-width: 1024px) {
        right: 0;
        height: 64px;
        width: 24px;
    }
`;

const ConsoleSidebar: React.FC = () => {
    const isInPanel = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('_panel') === '1';
    const { isOpen, toggle, close } = useConsoleSidebar();
    const consoleRef = useRef<ConsoleHandle>(null);
    const [controlState, setControlState] = useState({
        isPaused: false,
        shareState: 'idle' as 'idle' | 'loading' | 'success' | 'error',
        connected: false,
    });

    useEffect(() => {
        const interval = setInterval(() => {
            if (consoleRef.current) {
                setControlState({
                    isPaused: consoleRef.current.isPaused,
                    shareState: consoleRef.current.shareState,
                    connected: consoleRef.current.connected,
                });
            }
        }, 100);

        return () => clearInterval(interval);
    }, []);

    if (isInPanel) {
        return null;
    }

    return (
        <>
            <ToggleButton $isOpen={isOpen} onClick={toggle} title={isOpen ? 'Close console' : 'Open console'}>
                <FontAwesomeIcon icon={faTerminal} />
            </ToggleButton>
            <SidebarWrapper $isOpen={isOpen}>
                <SidebarHeader>
                    <SidebarHeaderLeft>
                        <SidebarTitle>
                            <FontAwesomeIcon icon={faTerminal} />
                            Console
                        </SidebarTitle>
                    </SidebarHeaderLeft>
                    <SidebarHeaderRight>
                        <TerminalButton
                            $active={controlState.isPaused}
                            onClick={() => consoleRef.current?.onTogglePause()}
                            disabled={!controlState.connected}
                            title={controlState.isPaused ? 'Resume logs' : 'Pause logs'}
                        >
                            <FontAwesomeIcon icon={controlState.isPaused ? faPlay : faPause} />
                        </TerminalButton>
                        <ShareButton
                            $state={controlState.shareState}
                            onClick={() => consoleRef.current?.onShareLog()}
                            disabled={controlState.shareState === 'loading' || !controlState.connected}
                            title="Share log to mclo.gs"
                        >
                            <FontAwesomeIcon
                                icon={controlState.shareState === 'loading' ? faSpinner : controlState.shareState === 'success' ? faCheck : faClipboard}
                                spin={controlState.shareState === 'loading'}
                            />
                        </ShareButton>
                        <TerminalButton onClick={() => consoleRef.current?.onClearLog()} title="Clear log">
                            <FontAwesomeIcon icon={faTrash} />
                        </TerminalButton>
                        <CloseButton onClick={close} title="Close console">
                            <FontAwesomeIcon icon={faTimes} />
                        </CloseButton>
                    </SidebarHeaderRight>
                </SidebarHeader>
                <SidebarContent>
                    <Console ref={consoleRef} variant="sidebar" />
                </SidebarContent>
            </SidebarWrapper>
        </>
    );
};

export default ConsoleSidebar;
