import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components/macro';
import { useHistory, useLocation } from 'react-router-dom';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import Modal from '@/components/elements/Modal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faKeyboard } from '@fortawesome/free-solid-svg-icons';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import { isVaultEnabledFor } from '@/components/server/vault/vaultNavigation';

type Keybind = {
    cat: 'global' | 'server' | 'account' | 'admin';
    label: string;
    keys: string[][];
    ctx?: string;
    admin?: boolean;
};

const binds: Keybind[] = [
    { cat: 'global', label: 'Show keybinds help', keys: [['Ctrl+/'], ['Alt+/'], ['Ctrl+\\'], ['Alt+\\']] },
    { cat: 'global', label: 'Go home', keys: [['Ctrl+Esc']] },
    { cat: 'global', label: 'Search', keys: [['Alt+F'], ['Ctrl+K']] },
    { cat: 'server', label: 'Terminal', keys: [['Ctrl+1'], ['Alt+.']] },
    { cat: 'server', label: 'Files', keys: [['Ctrl+2'], ['Alt+,']] },
    { cat: 'server', label: 'Databases', keys: [['Ctrl+3']] },
    { cat: 'server', label: 'Schedules', keys: [['Ctrl+4']] },
    { cat: 'server', label: 'Users', keys: [['Ctrl+5']] },
    { cat: 'server', label: 'Backups', keys: [['Ctrl+6']] },
    { cat: 'server', label: 'Network', keys: [['Ctrl+7']] },
    { cat: 'server', label: 'Startup', keys: [['Ctrl+8'], ['Alt+M']] },
    { cat: 'server', label: 'Settings', keys: [['Ctrl+9'], ['Alt+L']] },
    { cat: 'server', label: 'Activity', keys: [['Ctrl+0'], ['Alt+-']] },
    { cat: 'server', label: 'Start server', keys: [['Alt+Z']] },
    { cat: 'server', label: 'Stop server', keys: [['Alt+X']] },
    { cat: 'server', label: 'Restart server', keys: [['Alt+C']] },
    { cat: 'server', label: 'Select server', keys: [['Alt+A']], ctx: 'Terminal' },
    { cat: 'server', label: 'Toggle file layout', keys: [['Alt+Z']], ctx: 'Files' },
    { cat: 'server', label: 'New file', keys: [['Alt+[']], ctx: 'Files' },
    { cat: 'server', label: 'Upload file', keys: [['Alt+]']], ctx: 'Files' },
    { cat: 'server', label: 'Create database', keys: [['Alt+[']], ctx: 'Databases' },
    { cat: 'server', label: 'Create schedule', keys: [['Alt+[']], ctx: 'Schedules' },
    { cat: 'server', label: 'New subuser', keys: [['Alt+[']], ctx: 'Users' },
    { cat: 'server', label: 'Create backup', keys: [['Alt+[']], ctx: 'Backups' },
    { cat: 'server', label: 'Allocate port', keys: [['Alt+[']], ctx: 'Network' },
    { cat: 'server', label: 'SFTP connection info', keys: [['Alt+A']], ctx: 'Settings' },
    { cat: 'account', label: 'Account', keys: [['Ctrl+.']] },
    { cat: 'account', label: 'API keys', keys: [['Ctrl+,']] },
    { cat: 'account', label: 'SSH keys', keys: [['Ctrl+3']] },
    { cat: 'account', label: 'Activity', keys: [['Ctrl+4']] },
    { cat: 'admin', label: 'Admin panel', keys: [['Ctrl+,']], admin: true },
    { cat: 'admin', label: 'New server (admin)', keys: [['Alt+N']], admin: true },
    { cat: 'admin', label: 'View current server (admin)', keys: [['Alt+E']], admin: true },
    { cat: 'admin', label: 'Open designer', keys: [['Ctrl+D']], admin: true },
];

const HelpHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
`;

const HelpTitle = styled.h2`
    font-size: 1.35rem;
    font-weight: 600;
    color: var(--color-base);
`;

const HelpBody = styled.div`
    display: grid;
    gap: 14px;
`;

const GroupCard = styled.div`
    background: var(--color-background);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 12px);
    overflow: hidden;
`;

const GroupTitle = styled.div`
    padding: 10px 14px;
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-muted);
    border-bottom: 1px solid var(--color-neutral);
`;

const BindRow = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    border-top: 1px solid color-mix(in srgb, var(--color-neutral) 50%, transparent);

    &:first-of-type {
        border-top: none;
    }
`;

const BindText = styled.div`
    color: var(--color-base);
    font-size: 0.92rem;
`;

const ContextText = styled.span`
    color: var(--color-muted);
    font-size: 0.82rem;
    margin-left: 8px;
`;

const KeysWrap = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
`;

const KeyChip = styled.span`
    font-size: 0.76rem;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    color: var(--color-base);
    border: 1px solid var(--color-neutral);
    border-radius: 6px;
    padding: 4px 7px;
    background: color-mix(in srgb, var(--color-neutral) 24%, transparent);
`;

const FloatingButton = styled.button`
    position: fixed;
    right: 18px;
    bottom: 18px;
    z-index: 38;
    width: 44px;
    height: 44px;
    border-radius: var(--border-radius, 12px);
    border: 1px solid var(--color-neutral);
    background: var(--color-background-secondary);
    color: var(--color-base);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.15s ease;
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.18);
    cursor: pointer;

    &:hover {
        background: color-mix(in srgb, var(--color-primary) 20%, var(--color-background-secondary));
        border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-neutral));
        color: var(--color-primary);
        transform: translateY(-1px);
    }

    @media (max-width: 767px) {
        display: none;
    }
`;

const isTypingTarget = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
};

const normaliseKey = (key: string) => {
    if (key === 'Escape') return 'Esc';
    if (key.length === 1) return key.toUpperCase();
    return key;
};

const getCombo = (event: KeyboardEvent) => {
    const parts: string[] = [];
    if (event.ctrlKey || event.metaKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (!parts.length) return '';
    parts.push(normaliseKey(event.key));
    return parts.join('+');
};

const getServerIdFromPath = (pathname: string): string | null => {
    const match = pathname.match(/^\/server\/([^/]+)/);
    return match?.[1] || null;
};

const getServerContext = (pathname: string): string | null => {
    if (!pathname.startsWith('/server/')) return null;
    if (pathname.includes('/console')) return 'Terminal';
    if (pathname.includes('/files')) return 'Files';
    if (pathname.includes('/databases')) return 'Databases';
    if (pathname.includes('/schedules')) return 'Schedules';
    if (pathname.includes('/users')) return 'Users';
    if (pathname.includes('/backups')) return 'Backups';
    if (pathname.includes('/vault')) return 'Vault';
    if (pathname.includes('/network')) return 'Network';
    if (pathname.includes('/startup')) return 'Startup';
    if (pathname.includes('/settings')) return 'Settings';
    if (pathname.includes('/activity')) return 'Activity';
    return null;
};

export default () => {
    const history = useHistory();
    const location = useLocation();
    const keybindsEnabled = useStoreState((state: ApplicationStore) => state.settings.data?.advanced?.keybindsEnabled ?? false);
    const rootAdmin = useStoreState((state: ApplicationStore) => state.user.data?.rootAdmin ?? false);
    const [visible, setVisible] = useState(false);
    const isAuthRoute = location.pathname.startsWith('/auth');

    const currentServerUsesVault = isVaultEnabledFor(getServerIdFromPath(location.pathname));

    const visibleBinds = useMemo(
        () =>
            binds
                .filter((bind) => !bind.admin || rootAdmin)
                .map((bind) => {
                    // On Vault servers Ctrl+6 and the "create backup" shortcut lead to the Vault.
                    if (!currentServerUsesVault) return bind;
                    if (bind.label === 'Backups') return { ...bind, label: 'Vault' };
                    // The Vault section is always Spanish (see useVaultTranslation).
                    if (bind.ctx === 'Backups') return { ...bind, label: 'Crear M-Backup', ctx: 'Vault' };
                    return bind;
                }),
        [rootAdmin, currentServerUsesVault, visible]
    );

    useEffect(() => {
        const openHelp = () => setVisible(true);
        window.addEventListener('luna:keybinds:show-help', openHelp as EventListener);
        return () => window.removeEventListener('luna:keybinds:show-help', openHelp as EventListener);
    }, []);

    useEffect(() => {
        if (!keybindsEnabled) return;

        const onKeyDown = (event: KeyboardEvent) => {
            const combo = getCombo(event);
            if (!combo) return;
            if (isTypingTarget(event.target)) return;

            const pathname = window.location.pathname;
            const serverId = getServerIdFromPath(pathname);
            const serverContext = getServerContext(pathname);
            const inAccount = pathname.startsWith('/account');

            if (combo === 'Ctrl+/' || combo === 'Alt+/' || combo === 'Ctrl+\\' || combo === 'Alt+\\') {
                event.preventDefault();
                setVisible(true);
                return;
            }

            if (combo === 'Ctrl+Esc') {
                event.preventDefault();
                history.push('/');
                return;
            }

            if (combo === 'Alt+F' || combo === 'Ctrl+K') {
                event.preventDefault();
                window.dispatchEvent(new CustomEvent('luna:keybind:search'));
                return;
            }

            if (inAccount) {
                if (combo === 'Ctrl+.' || combo === 'Ctrl+,' || combo === 'Ctrl+3' || combo === 'Ctrl+4') {
                    event.preventDefault();
                    if (combo === 'Ctrl+.') history.push('/account');
                    if (combo === 'Ctrl+,') history.push('/account/api');
                    if (combo === 'Ctrl+3') history.push('/account/ssh');
                    if (combo === 'Ctrl+4') history.push('/account/activity');
                    return;
                }
            }

            if (rootAdmin && !inAccount) {
                if (combo === 'Ctrl+,') {
                    event.preventDefault();
                    window.location.href = '/admin';
                    return;
                }
                if (combo === 'Alt+N') {
                    event.preventDefault();
                    window.location.href = '/admin/servers/new';
                    return;
                }
                if (combo === 'Alt+E') {
                    event.preventDefault();
                    window.dispatchEvent(new CustomEvent('luna:keybind:admin-view-current-server'));
                    return;
                }
                if (combo === 'Ctrl+D') {
                    event.preventDefault();
                    window.location.href = '/admin/settings/theme';
                    return;
                }
            }

            if (!serverId) return;

            const goServer = (path: string) => history.push(`/server/${serverId}${path}`);

            if (combo === 'Ctrl+1' || combo === 'Alt+.') {
                event.preventDefault();
                goServer('/console');
                return;
            }
            if (combo === 'Ctrl+2' || combo === 'Alt+,') {
                event.preventDefault();
                goServer('/files');
                return;
            }
            if (combo === 'Ctrl+3') {
                event.preventDefault();
                goServer('/databases');
                return;
            }
            if (combo === 'Ctrl+4') {
                event.preventDefault();
                goServer('/schedules');
                return;
            }
            if (combo === 'Ctrl+5') {
                event.preventDefault();
                goServer('/users');
                return;
            }
            if (combo === 'Ctrl+6') {
                event.preventDefault();
                goServer(isVaultEnabledFor(serverId) ? '/vault' : '/backups');
                return;
            }
            if (combo === 'Ctrl+7') {
                event.preventDefault();
                goServer('/network');
                return;
            }
            if (combo === 'Ctrl+8' || combo === 'Alt+M') {
                event.preventDefault();
                goServer('/startup');
                return;
            }
            if (combo === 'Ctrl+9' || combo === 'Alt+L') {
                event.preventDefault();
                goServer('/settings');
                return;
            }
            if (combo === 'Ctrl+0' || combo === 'Alt+-') {
                event.preventDefault();
                goServer('/activity');
                return;
            }

            if (combo === 'Alt+Z' || combo === 'Alt+X' || combo === 'Alt+C') {
                event.preventDefault();
                if (combo === 'Alt+Z') window.dispatchEvent(new CustomEvent('luna:keybind:power', { detail: { action: 'start' } }));
                if (combo === 'Alt+X') window.dispatchEvent(new CustomEvent('luna:keybind:power', { detail: { action: 'stop' } }));
                if (combo === 'Alt+C') window.dispatchEvent(new CustomEvent('luna:keybind:power', { detail: { action: 'restart' } }));
                return;
            }

            if (serverContext === 'Terminal' && combo === 'Alt+A') {
                event.preventDefault();
                history.push('/');
                return;
            }

            if (serverContext === 'Files') {
                if (combo === 'Alt+Z') {
                    event.preventDefault();
                    window.dispatchEvent(new CustomEvent('luna:keybind:file-toggle-layout'));
                    return;
                }
                if (combo === 'Alt+[') {
                    event.preventDefault();
                    history.push(`/server/${serverId}/files/new${window.location.hash}`);
                    return;
                }
                if (combo === 'Alt+]') {
                    event.preventDefault();
                    window.dispatchEvent(new CustomEvent('luna:keybind:file-upload'));
                    return;
                }
            }

            if (combo === 'Alt+[' && serverContext) {
                if (serverContext === 'Databases') {
                    event.preventDefault();
                    window.dispatchEvent(new CustomEvent('luna:keybind:create-database'));
                    return;
                }
                if (serverContext === 'Schedules') {
                    event.preventDefault();
                    window.dispatchEvent(new CustomEvent('luna:keybind:create-schedule'));
                    return;
                }
                if (serverContext === 'Users') {
                    event.preventDefault();
                    window.dispatchEvent(new CustomEvent('luna:keybind:create-subuser'));
                    return;
                }
                // The Vault page opens its M-Backup dialog on the same event; native
                // backups cannot be created on Vault servers.
                if ((serverContext === 'Backups' && !isVaultEnabledFor(serverId)) || serverContext === 'Vault') {
                    event.preventDefault();
                    window.dispatchEvent(new CustomEvent('luna:keybind:create-backup'));
                    return;
                }
                if (serverContext === 'Network') {
                    event.preventDefault();
                    window.dispatchEvent(new CustomEvent('luna:keybind:allocate-port'));
                    return;
                }
            }

            if (serverContext === 'Settings' && combo === 'Alt+A') {
                event.preventDefault();
                window.dispatchEvent(new CustomEvent('luna:keybind:settings-open-sftp'));
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [history, keybindsEnabled, rootAdmin, location.pathname]);

    if (!keybindsEnabled) return null;

    const globalRows = visibleBinds.filter((bind) => bind.cat === 'global');
    const serverRows = visibleBinds.filter((bind) => bind.cat === 'server');
    const accountRows = visibleBinds.filter((bind) => bind.cat === 'account');
    const adminRows = visibleBinds.filter((bind) => bind.cat === 'admin');

    return (
        <>
            {visible && (
                <Modal visible={visible} appear onDismissed={() => setVisible(false)} top={false}>
                    <HelpHeader>
                        <HelpTitle>Keyboard Shortcuts</HelpTitle>
                    </HelpHeader>
                    <HelpBody>
                        <GroupCard>
                            <GroupTitle>Global</GroupTitle>
                            {globalRows.map((bind) => (
                                <BindRow key={`${bind.cat}-${bind.label}`}>
                                    <BindText>{bind.label}</BindText>
                                    <KeysWrap>
                                        {bind.keys.map((item) => (
                                            <KeyChip key={`${bind.label}-${item.join('+')}`}>{item.join(' / ')}</KeyChip>
                                        ))}
                                    </KeysWrap>
                                </BindRow>
                            ))}
                        </GroupCard>
                        <GroupCard>
                            <GroupTitle>Server</GroupTitle>
                            {serverRows.map((bind) => (
                                <BindRow key={`${bind.cat}-${bind.label}-${bind.ctx || 'all'}`}>
                                    <BindText>
                                        {bind.label}
                                        {bind.ctx && <ContextText>{bind.ctx}</ContextText>}
                                    </BindText>
                                    <KeysWrap>
                                        {bind.keys.map((item) => (
                                            <KeyChip key={`${bind.label}-${bind.ctx || 'all'}-${item.join('+')}`}>
                                                {item.join(' / ')}
                                            </KeyChip>
                                        ))}
                                    </KeysWrap>
                                </BindRow>
                            ))}
                        </GroupCard>
                        <GroupCard>
                            <GroupTitle>Account</GroupTitle>
                            {accountRows.map((bind) => (
                                <BindRow key={`${bind.cat}-${bind.label}`}>
                                    <BindText>{bind.label}</BindText>
                                    <KeysWrap>
                                        {bind.keys.map((item) => (
                                            <KeyChip key={`${bind.label}-${item.join('+')}`}>{item.join(' / ')}</KeyChip>
                                        ))}
                                    </KeysWrap>
                                </BindRow>
                            ))}
                        </GroupCard>
                        {rootAdmin && !!adminRows.length && (
                            <GroupCard>
                                <GroupTitle>Admin</GroupTitle>
                                {adminRows.map((bind) => (
                                    <BindRow key={`${bind.cat}-${bind.label}`}>
                                        <BindText>{bind.label}</BindText>
                                        <KeysWrap>
                                            {bind.keys.map((item) => (
                                                <KeyChip key={`${bind.label}-${item.join('+')}`}>{item.join(' / ')}</KeyChip>
                                            ))}
                                        </KeysWrap>
                                    </BindRow>
                                ))}
                            </GroupCard>
                        )}
                    </HelpBody>
                </Modal>
            )}
            {!isAuthRoute && (
                <Tooltip placement={'left'} content={'Keyboard shortcuts'}>
                    <FloatingButton
                        type={'button'}
                        onClick={() => setVisible(true)}
                        aria-label={'Open keyboard shortcuts help'}
                    >
                        <FontAwesomeIcon icon={faKeyboard} />
                    </FloatingButton>
                </Tooltip>
            )}
        </>
    );
};
