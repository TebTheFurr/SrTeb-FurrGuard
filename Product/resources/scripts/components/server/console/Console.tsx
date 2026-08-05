import React, { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { ITerminalOptions, Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { SearchAddon } from 'xterm-addon-search';
import { SearchBarAddon } from 'xterm-addon-search-bar';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { ScrollDownHelperAddon } from '@/plugins/XtermScrollDownHelperAddon';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import { ServerContext } from '@/state/server';
import { useStoreState } from '@/state/hooks';
import { usePermissions } from '@/plugins/usePermissions';
import useEventListener from '@/plugins/useEventListener';
import { debounce } from 'debounce';
import { usePersistedState } from '@/plugins/usePersistedState';
import { SocketEvent, SocketRequest } from '@/components/server/events';
import classNames from 'classnames';
import { ChevronDoubleRightIcon } from '@heroicons/react/solid';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClipboard, faCheck, faSpinner, faPause, faPlay, faTrash, faEllipsisV } from '@fortawesome/free-solid-svg-icons';
import styled from 'styled-components/macro';
import { Popover } from '@headlessui/react';

const PopoverButton = Popover.Button || 'button';
const PopoverPanel = Popover.Panel || 'div';
import { AnimatePresence, motion } from 'framer-motion';
import CommandHistoryPopup from './CommandHistoryPopup';
import { storeCommandHistory } from '@/api/server/commandHistory';
import { getMacros, ServerMacro } from '@/api/server/macros';
import { useTranslation } from 'react-i18next';

import 'xterm/css/xterm.css';
import styles from './style.module.css';

interface ConsoleProps {
    variant?: 'default' | 'sidebar';
}

export interface ConsoleHandle {
    isPaused: boolean;
    shareState: 'idle' | 'loading' | 'success' | 'error';
    connected: boolean;
    onTogglePause: () => void;
    onShareLog: () => void;
    onClearLog: () => void;
}

const getComputedColor = (varName: string, fallback: string): string => {
    if (typeof window !== 'undefined') {
        const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
        return value || fallback;
    }
    return fallback;
};

const theme = {
    background: getComputedColor('--color-background-secondary', 'hsl(240, 2%, 8%)'),
    foreground: getComputedColor('--color-base', 'hsl(0, 0%, 100%)'),
    cursor: 'transparent',
    black: getComputedColor('--color-background-secondary', 'hsl(240, 2%, 8%)'),
    red: '#E54B4B',
    green: '#9ECE58',
    yellow: '#FAED70',
    blue: getComputedColor('--color-primary', 'hsl(229, 100%, 64%)'),
    magenta: '#BB80B3',
    cyan: getComputedColor('--color-primary', 'hsl(229, 100%, 64%)'),
    white: getComputedColor('--color-muted', 'hsl(220, 16%, 45%)'),
    brightBlack: 'rgba(255, 255, 255, 0.2)',
    brightRed: '#FF5370',
    brightGreen: '#C3E88D',
    brightYellow: '#FFCB6B',
    brightBlue: getComputedColor('--color-primary', 'hsl(229, 100%, 64%)'),
    brightMagenta: '#C792EA',
    brightCyan: getComputedColor('--color-primary', 'hsl(229, 100%, 64%)'),
    brightWhite: getComputedColor('--color-base', 'hsl(0, 0%, 100%)'),
    selection: getComputedColor('--color-primary', 'hsl(229, 100%, 64%)'),
};

const terminalProps: ITerminalOptions = {
    disableStdin: true,
    cursorStyle: 'underline',
    allowTransparency: true,
    fontSize: 12,
    fontFamily: '"IBM Plex Mono", monospace',
    rows: 30,
    theme: theme,
};

export const TerminalButton = styled.button<{ $active?: boolean }>`
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: none;
    background: transparent;
    font-size: 1rem;
    transition: all 150ms ease;
    color: ${({ $active }) => $active ? 'var(--color-primary)' : 'var(--color-muted)'};
    cursor: pointer;

    &:hover:not(:disabled) {
        color: ${({ $active }) => $active ? 'var(--color-primary)' : 'var(--color-base)'};
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

export const ShareButton = styled(TerminalButton)<{ $state: 'idle' | 'loading' | 'success' | 'error' }>`
    color: ${({ $state }) => 
        $state === 'success' ? '#22c55e' : 
        $state === 'error' ? '#ef4444' : 
        'var(--color-muted)'};

    &:hover:not(:disabled) {
        color: ${({ $state }) => 
            $state === 'success' ? '#22c55e' : 
            $state === 'error' ? '#ef4444' : 
            'var(--color-base)'};
    }
`;

const TerminalButtonGroup = styled.div`
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    display: none;
    gap: 0.25rem;

    @media (min-width: 640px) {
        display: flex;
    }
`;

const MobileToolsWrapper = styled(Popover)`
    position: absolute;
    top: 50%;
    right: 3rem;
    transform: translateY(-50%);
    z-index: 10;

    @media (min-width: 640px) {
        display: none;
    }
`;

const MobileToolsButton = styled(PopoverButton)`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--color-muted);
    cursor: pointer;
    transition: all 150ms ease;
    border-radius: 6px;

    &:hover {
        color: var(--color-base);
        background-color: var(--color-neutral);
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    
    &[data-headlessui-state="open"] {
        color: var(--color-primary);
        background-color: var(--color-neutral);
    }
`;

const MobileToolsPanel = styled(motion.div)`
    position: absolute;
    bottom: calc(100% + 0.75rem);
    right: -0.25rem;
    display: flex;
    gap: 0.25rem;
    padding: 0.5rem;
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 12px);
    box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.5);
    z-index: 50;
`;


const DEFAULT_PRELUDE = 'container@pterodactyl~ ';

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
              r: parseInt(result[1], 16),
              g: parseInt(result[2], 16),
              b: parseInt(result[3], 16),
          }
        : null;
};

const hslToRgb = (hsl: string): { r: number; g: number; b: number } | null => {
    const match = hsl.match(/hsl\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?\s*\)/i);
    if (!match) return null;

    let h = parseInt(match[1]) / 360;
    let s = parseInt(match[2]) / 100;
    let l = parseInt(match[3]) / 100;

    let r, g, b;

    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255),
    };
};

const colorToRgb = (color: string | undefined): { r: number; g: number; b: number } | null => {
    if (!color) return null;
    if (color.startsWith('#')) return hexToRgb(color);
    if (color.startsWith('hsl')) return hslToRgb(color);
    return null;
};

const Console = forwardRef<ConsoleHandle, ConsoleProps>(({ variant = 'default' }, forwardedRef) => {
    const { t } = useTranslation('server');
    const preludeText = useStoreState((state) => state.settings.data?.advanced?.consoleCommandPrelude);
    const preludeColor = useStoreState((state) => state.settings.data?.advanced?.consolePreludeColor);

    const TERMINAL_PRELUDE = useMemo(() => {
        const rgb = colorToRgb(preludeColor || 'hsl(60, 100%, 70%)');
        const colorCode = rgb ? `38;2;${rgb.r};${rgb.g};${rgb.b}` : '33';
        return '\u001b[1m\u001b[' + colorCode + 'm' + (preludeText?.trim() || DEFAULT_PRELUDE.trim()) + ' \u001b[0m';
    }, [preludeColor, preludeText]);

    const ref = useRef<HTMLDivElement>(null);
    const isSidebar = variant === 'sidebar';
    const terminal = useMemo(() => new Terminal({ ...terminalProps, rows: isSidebar ? 50 : 30 }), []);
    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const searchBar = new SearchBarAddon({ searchAddon });
    const webLinksAddon = new WebLinksAddon();
    const scrollDownHelperAddon = new ScrollDownHelperAddon();
    const { connected, instance } = ServerContext.useStoreState((state) => state.socket);
    const [canSendCommands] = usePermissions(['control.console']);
    const serverId = ServerContext.useStoreState((state) => state.server.data!.id);
    const isTransferring = ServerContext.useStoreState((state) => state.server.data!.isTransferring);
    const uuid = ServerContext.useStoreState((state) => state.server.data?.uuid);
    const [history, setHistory] = usePersistedState<string[]>(`${serverId}:command_history`, []);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [shareState, setShareState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [isPaused, setIsPaused] = useState(false);
    const isPausedRef = useRef(false);
    const bufferedLogsRef = useRef<Array<{ line: string; prelude: boolean }>>([]);
    const commandInputRef = useRef<HTMLInputElement>(null);
    const [macros, setMacros] = useState<ServerMacro[]>([]);
    const zIndex = `
    .xterm-search-bar__addon {
        z-index: 30;
    }`;

    useEffect(() => {
        if (uuid) {
            getMacros(uuid).then(setMacros).catch(() => setMacros([]));
        }
    }, [uuid]);

    const processMacro = (command: string): { success: true; output: string } | { success: false; error?: string } | null => {
        if (!macros || macros.length === 0) return null;

        const parts = command.trim().split(/\s+/);
        const shortcut = parts[0].replace(/^\/+/, '');
        const providedArgs = parts.slice(1);

        const macro = macros.find((m: ServerMacro) => m.shortcut.replace(/^\/+/, '') === shortcut);
        if (!macro) return null;

        let output = macro.output;
        const macroArgs = macro.arguments || [];

        if (providedArgs.length < macroArgs.length) {
            return { 
                success: false, 
                error: `Missing arguments. Usage: ${shortcut} ${macroArgs.map((a: { name: string }) => `<${a.name}>`).join(' ')}`
            };
        }

        macroArgs.forEach((arg: { name: string }, index: number) => {
            const placeholder = `{${arg.name}}`;
            const value = providedArgs[index] || '';
            output = output.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
        });

        return { success: true, output };
    };

    const handleConsoleOutput = (line: string, prelude = false) => {
        if (isPausedRef.current) {
            bufferedLogsRef.current.push({ line, prelude });
            return;
        }
        
        let processedLine = line;
        if (!prelude && DEFAULT_PRELUDE.trim() !== (preludeText?.trim() || DEFAULT_PRELUDE.trim())) {
            processedLine = line.replace(/container@pterodactyl~/g, preludeText?.trim() || DEFAULT_PRELUDE.trim());
        }
        
        terminal.writeln((prelude ? TERMINAL_PRELUDE : '') + processedLine.replace(/(?:\r\n|\r|\n)$/im, '') + '\u001b[0m');
    };

    const handleTransferStatus = (status: string) => {
        switch (status) {
            case 'failure':
                handleConsoleOutput('Transfer has failed.', true);
                return;
        }
    };

    const handleDaemonErrorOutput = (line: string) => {
        if (isPausedRef.current) {
            bufferedLogsRef.current.push({ line: '\u001b[1m\u001b[41m' + line + '\u001b[0m', prelude: true });
            return;
        }
        terminal.writeln(
            TERMINAL_PRELUDE + '\u001b[1m\u001b[41m' + line.replace(/(?:\r\n|\r|\n)$/im, '') + '\u001b[0m'
        );
    };

    const handlePowerChangeEvent = (state: string) =>
        handleConsoleOutput('Server marked as ' + state + '...', true);

    const handleCommandKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowUp') {
            const newIndex = Math.min(historyIndex + 1, history!.length - 1);

            setHistoryIndex(newIndex);
            e.currentTarget.value = history![newIndex] || '';

            e.preventDefault();
        }

        if (e.key === 'ArrowDown') {
            const newIndex = Math.max(historyIndex - 1, -1);

            setHistoryIndex(newIndex);
            e.currentTarget.value = history![newIndex] || '';
        }

        const command = e.currentTarget.value;
        if (e.key === 'Enter' && command.length > 0) {
            setHistory((prevHistory) => [command, ...prevHistory!].slice(0, 32));
            setHistoryIndex(-1);

            const macroResult = processMacro(command);
            
            if (macroResult !== null && !macroResult.success) {
                terminal.writeln(TERMINAL_PRELUDE + '\u001b[31m' + macroResult.error + '\u001b[0m');
                e.currentTarget.value = '';
                return;
            }
            
            const finalCommand = macroResult?.success ? macroResult.output : command;
            
            if (macroResult?.success) {
                terminal.writeln(TERMINAL_PRELUDE + '\u001b[90m' + command + ' \u001b[36m>\u001b[0m ' + finalCommand);
            }
            
            instance && instance.send('send command', finalCommand);
            e.currentTarget.value = '';
            
            if (uuid) {
                storeCommandHistory(uuid, command).catch(() => {});
            }
        }
    };

    const handleSelectHistoryCommand = (command: string) => {
        if (commandInputRef.current) {
            commandInputRef.current.value = command;
            commandInputRef.current.focus();
        }
    };

    const getTerminalContent = (): string => {
        const buffer = terminal.buffer.active;
        const lines: string[] = [];
        
        for (let i = 0; i < buffer.length; i++) {
            const line = buffer.getLine(i);
            if (line) {
                lines.push(line.translateToString(true));
            }
        }
        
        return lines.join('\n').replace(/\x1b\[[0-9;]*m/g, '').trim();
    };

    const handleShareLog = async () => {
        if (shareState === 'loading') return;
        
        setShareState('loading');
        
        try {
            const content = getTerminalContent();
            
            if (!content) {
                setShareState('error');
                setTimeout(() => setShareState('idle'), 2000);
                return;
            }

            const response = await fetch('https://api.mclo.gs/1/log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `content=${encodeURIComponent(content)}`,
            });

            const data = await response.json();

            if (data.success) {
                await navigator.clipboard.writeText(data.url);
                setShareState('success');
                setTimeout(() => setShareState('idle'), 2000);
            } else {
                console.error('mclo.gs error:', data.error);
                setShareState('error');
                setTimeout(() => setShareState('idle'), 2000);
            }
        } catch (error) {
            console.error('Failed to share log:', error);
            setShareState('error');
            setTimeout(() => setShareState('idle'), 2000);
        }
    };

    const handleTogglePause = () => {
        const newPaused = !isPaused;
        setIsPaused(newPaused);
        isPausedRef.current = newPaused;
        
        if (!newPaused && bufferedLogsRef.current.length > 0) {
            bufferedLogsRef.current.forEach(({ line, prelude }) => {
                let processedLine = line;
                if (!prelude && DEFAULT_PRELUDE.trim() !== (preludeText?.trim() || DEFAULT_PRELUDE.trim())) {
                    processedLine = line.replace(/container@pterodactyl~/g, preludeText?.trim() || DEFAULT_PRELUDE.trim());
                }
                terminal.writeln((prelude ? TERMINAL_PRELUDE : '') + processedLine.replace(/(?:\r\n|\r|\n)$/im, '') + '\u001b[0m');
            });
            bufferedLogsRef.current = [];
        }
    };

    const handleClearLog = () => {
        bufferedLogsRef.current = [];
        terminal.write('\u001b[3J\u001b[H\u001b[2J');
        terminal.clear();
    };

    useImperativeHandle(forwardedRef, () => ({
        isPaused,
        shareState,
        connected,
        onTogglePause: handleTogglePause,
        onShareLog: handleShareLog,
        onClearLog: handleClearLog,
    }), [isPaused, shareState, connected]);

    useEffect(() => {
        if (connected && ref.current && !terminal.element) {
            terminal.loadAddon(fitAddon);
            terminal.loadAddon(searchAddon);
            terminal.loadAddon(searchBar);
            terminal.loadAddon(webLinksAddon);
            terminal.loadAddon(scrollDownHelperAddon);

            terminal.open(ref.current);
            fitAddon.fit();
            searchBar.addNewStyle(zIndex);

            terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                    document.execCommand('copy');
                    return false;
                } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                    e.preventDefault();
                    searchBar.show();
                    return false;
                } else if (e.key === 'Escape') {
                    searchBar.hidden();
                }
                return true;
            });
        }
    }, [terminal, connected]);

    useEventListener(
        'resize',
        debounce(() => {
            if (terminal.element) {
                fitAddon.fit();
            }
        }, 100)
    );

    useEffect(() => {
        const listeners: Record<string, (s: string) => void> = {
            [SocketEvent.STATUS]: handlePowerChangeEvent,
            [SocketEvent.CONSOLE_OUTPUT]: handleConsoleOutput,
            [SocketEvent.INSTALL_OUTPUT]: handleConsoleOutput,
            [SocketEvent.TRANSFER_LOGS]: handleConsoleOutput,
            [SocketEvent.TRANSFER_STATUS]: handleTransferStatus,
            [SocketEvent.DAEMON_MESSAGE]: (line) => handleConsoleOutput(line, true),
            [SocketEvent.DAEMON_ERROR]: handleDaemonErrorOutput,
        };

        if (connected && instance) {
            if (!isTransferring) {
                terminal.clear();
            }

            Object.keys(listeners).forEach((key: string) => {
                instance.addListener(key, listeners[key]);
            });
            instance.send(SocketRequest.SEND_LOGS);
        }

        return () => {
            if (instance) {
                Object.keys(listeners).forEach((key: string) => {
                    instance.removeListener(key, listeners[key]);
                });
            }
        };
    }, [connected, instance]);

    return (
        <div className={classNames(styles.terminal, 'relative', { [styles.terminal_sidebar]: isSidebar })}>
            <SpinnerOverlay visible={!connected} size={'large'} />
            {!isSidebar && (
                <TerminalButtonGroup>
                    <TerminalButton
                        $active={isPaused}
                        onClick={handleTogglePause}
                        disabled={!connected}
                        title={isPaused ? t('console.resume_logs') : t('console.pause_logs')}
                    >
                        <FontAwesomeIcon icon={isPaused ? faPlay : faPause} />
                    </TerminalButton>
                    <ShareButton 
                        $state={shareState}
                        onClick={handleShareLog}
                        disabled={shareState === 'loading' || !connected}
                        title={t('console.share_log_mclogs')}
                    >
                        <FontAwesomeIcon 
                            icon={shareState === 'loading' ? faSpinner : shareState === 'success' ? faCheck : faClipboard} 
                            spin={shareState === 'loading'}
                        />
                    </ShareButton>
                    <TerminalButton onClick={handleClearLog} title={t('console.clear_log')}>
                        <FontAwesomeIcon icon={faTrash} />
                    </TerminalButton>
                </TerminalButtonGroup>
            )}
            <div
                className={classNames(styles.container, { 'rounded-b': !canSendCommands })}
            >
                <div className={'h-full'}>
                    <div id={styles.terminal} ref={ref} />
                </div>
            </div>
            {canSendCommands && (
                <div className={'relative'}>
                    <input
                        ref={commandInputRef}
                        className={classNames('peer', styles.command_input)}
                        type={'text'}
                        placeholder={t('console.command_placeholder')}
                        aria-label={t('console.command_input')}
                        disabled={!instance || !connected}
                        onKeyDown={handleCommandKeyDown}
                        autoCorrect={'off'}
                        autoCapitalize={'none'}
                    />
                    <div className={classNames('peer-focus:animate-pulse', styles.command_icon)}>
                        <ChevronDoubleRightIcon className={'w-4 h-4'} />
                    </div>
                    {!isSidebar && (
                        <>
                            <MobileToolsWrapper>
                                {({ open }) => (
                                    <>
                                        <MobileToolsButton disabled={!connected} title={t('console.mobile_console_tools')}>
                                            <FontAwesomeIcon icon={faEllipsisV} />
                                        </MobileToolsButton>
                                        <AnimatePresence>
                                            {open && (
                                                <PopoverPanel
                                                    static
                                                    as={MobileToolsPanel}
                                                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                                    transition={{ duration: 0.15, ease: 'easeOut' }}
                                                >
                                                    <TerminalButton
                                                        $active={isPaused}
                                                        onClick={handleTogglePause}
                                                        disabled={!connected}
                                                        title={isPaused ? t('console.resume_logs') : t('console.pause_logs')}
                                                    >
                                                        <FontAwesomeIcon icon={isPaused ? faPlay : faPause} />
                                                    </TerminalButton>
                                                    <ShareButton 
                                                        $state={shareState}
                                                        onClick={handleShareLog}
                                                        disabled={shareState === 'loading' || !connected}
                                                        title={t('console.share_log_mclogs')}
                                                    >
                                                        <FontAwesomeIcon 
                                                            icon={shareState === 'loading' ? faSpinner : shareState === 'success' ? faCheck : faClipboard} 
                                                            spin={shareState === 'loading'}
                                                        />
                                                    </ShareButton>
                                                    <TerminalButton onClick={handleClearLog} title={t('console.clear_log')}>
                                                        <FontAwesomeIcon icon={faTrash} />
                                                    </TerminalButton>
                                                </PopoverPanel>
                                            )}
                                        </AnimatePresence>
                                    </>
                                )}
                            </MobileToolsWrapper>
                            <CommandHistoryPopup
                                disabled={!connected}
                                onSelectCommand={handleSelectHistoryCommand}
                            />
                        </>
                    )}
                </div>
            )}
        </div>
    );
});

export default Console;
