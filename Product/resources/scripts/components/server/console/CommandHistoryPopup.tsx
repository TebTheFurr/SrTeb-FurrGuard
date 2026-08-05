import React, { useEffect, useState } from 'react';
import { Popover } from '@headlessui/react';
import { AnimatePresence, motion } from 'framer-motion';

const PopoverButton = Popover.Button || 'button';
const PopoverPanel = Popover.Panel || 'div';
import { TrashIcon } from '@heroicons/react/solid';
import { ClockIcon } from '@heroicons/react/outline';
import { ServerContext } from '@/state/server';
import { getCommandHistory, clearCommandHistory, CommandHistoryItem } from '@/api/server/commandHistory';
import { format, formatDistanceToNow } from 'date-fns';
import styled from 'styled-components/macro';
import Spinner from '@/components/elements/Spinner';

const PopoverWrapper = styled(Popover)`
    position: absolute;
    top: 50%;
    right: 0.75rem;
    transform: translateY(-50%);
    z-index: 10;
`;

const PopupPanel = styled(motion.div)`
    position: absolute;
    bottom: calc(100% + 1rem);
    right: -0.5rem;
    width: 20rem;
    max-width: calc(100vw - 2rem);
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 12px);
    overflow: hidden;
    box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.5);
    z-index: 50;
    
    @media (max-width: 480px) {
        position: fixed;
        bottom: auto;
        top: 50%;
        left: 50%;
        right: auto;
        transform: translate(-50%, -50%);
        width: calc(100vw - 2rem);
        max-width: 20rem;
    }
`;

const CommandList = styled.div`
    max-height: 16rem;
    overflow-y: auto;
    
    &::-webkit-scrollbar {
        width: 5px;
    }
    
    &::-webkit-scrollbar-track {
        background: transparent;
    }
    
    &::-webkit-scrollbar-thumb {
        background-color: var(--color-neutral);
        border-radius: 3px;
    }
`;

const CommandItem = styled.button`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    width: 100%;
    padding: 0.625rem 0.875rem;
    text-align: left;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background-color 0.1s ease;
    
    &:last-child {
        border-bottom: none;
    }
    
    &:hover {
        background-color: var(--color-background);
    }
`;

const CommandText = styled.code`
    flex: 1;
    min-width: 0;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.8125rem;
    color: var(--color-base);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const CommandTime = styled.span`
    flex-shrink: 0;
    font-size: 0.6875rem;
    color: var(--color-muted);
`;

const EmptyState = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1.5rem 1rem;
    color: var(--color-muted);
    text-align: center;
`;

const EmptyIcon = styled.div`
    width: 1.75rem;
    height: 1.75rem;
    margin-bottom: 0.5rem;
    opacity: 0.5;
`;

const ClearButton = styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    width: 100%;
    padding: 0.5rem;
    font-size: 0.75rem;
    color: var(--color-muted);
    background: transparent;
    border: none;
    border-top: 1px solid var(--color-neutral);
    cursor: pointer;
    transition: all 0.1s ease;
    
    &:hover {
        color: #ef4444;
        background-color: rgba(239, 68, 68, 0.08);
    }
`;

const HistoryButton = styled(PopoverButton)`
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

const Backdrop = styled(motion.div)`
    display: none;
    
    @media (max-width: 480px) {
        display: block;
        position: fixed;
        inset: 0;
        background-color: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(2px);
        z-index: 40;
    }
`;

interface Props {
    disabled?: boolean;
    onSelectCommand: (command: string) => void;
}

export default ({ disabled, onSelectCommand }: Props) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data?.uuid);
    const [history, setHistory] = useState<CommandHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [clearing, setClearing] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (isOpen && uuid) {
            setLoading(true);
            getCommandHistory(uuid)
                .then(setHistory)
                .finally(() => setLoading(false));
        }
    }, [isOpen, uuid]);

    const handleSelectCommand = (command: string, close: () => void) => {
        onSelectCommand(command);
        close();
    };

    const handleClearHistory = async () => {
        if (!uuid || clearing) return;
        
        setClearing(true);
        try {
            await clearCommandHistory(uuid);
            setHistory([]);
        } finally {
            setClearing(false);
        }
    };

    return (
        <PopoverWrapper>
            {({ open, close }) => {
                if (open !== isOpen) {
                    setIsOpen(open);
                }
                
                return (
                    <>
                        <HistoryButton disabled={disabled} title="Command history">
                            <ClockIcon className="w-5 h-5" />
                        </HistoryButton>

                        <AnimatePresence>
                            {open && (
                                <>
                                    <Backdrop
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                        onClick={() => close()}
                                    />
                                    <PopoverPanel
                                        static
                                        as={PopupPanel}
                                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                        transition={{ duration: 0.15, ease: 'easeOut' }}
                                    >
                                        {loading ? (
                                            <div className="py-6">
                                                <Spinner centered size="small" />
                                            </div>
                                        ) : history.length === 0 ? (
                                            <EmptyState>
                                                <EmptyIcon>
                                                    <ClockIcon className="w-full h-full" />
                                                </EmptyIcon>
                                                <p className="text-xs mb-0.5">No history yet</p>
                                                <p className="text-xs opacity-60">Commands will appear here</p>
                                            </EmptyState>
                                        ) : (
                                            <>
                                                <CommandList>
                                                    {history.map((item) => (
                                                        <CommandItem
                                                            key={item.id}
                                                            onClick={() => handleSelectCommand(item.command, close)}
                                                        >
                                                            <CommandText title={item.command}>{item.command}</CommandText>
                                                            <CommandTime title={format(item.createdAt, 'PPpp')}>
                                                                {formatDistanceToNow(item.createdAt, { addSuffix: true })}
                                                            </CommandTime>
                                                        </CommandItem>
                                                    ))}
                                                </CommandList>
                                                <ClearButton onClick={handleClearHistory} disabled={clearing}>
                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                    Clear history
                                                </ClearButton>
                                            </>
                                        )}
                                    </PopoverPanel>
                                </>
                            )}
                        </AnimatePresence>
                    </>
                );
            }}
        </PopoverWrapper>
    );
};
