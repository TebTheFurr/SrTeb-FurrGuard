import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faFileImport,
    faPlug,
    faFolderOpen,
    faFolder,
    faFile,
    faChevronRight,
    faChevronDown,
    faExclamationTriangle,
    faCheckCircle,
    faTimesCircle,
    faSpinner,
    faPlay,
    faStop,
    faRedo,
    faBan,
} from '@fortawesome/free-solid-svg-icons';
import { ServerContext } from '@/state/server';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import { useTranslation } from 'react-i18next';
import PageContentBlock from '@/components/elements/PageContentBlock';
import styles from './server-import.module.css';
import {
    RemoteEntry,
    ImportProgress,
    ServerImportCredentials,
    getImportStatus,
    testImportConnection,
    browseImportDirectory,
    startImport,
    stepImport,
    cancelImport,
    resetImport,
} from '@/api/server/server-import';

interface TreeNode {
    name: string;
    path: string;
    directory: boolean;
    size: number;
    expanded: boolean;
    loading: boolean;
    loaded: boolean;
    children: TreeNode[];
}

const formatBytes = (bytes: number): string => {
    if (!bytes || bytes <= 0) {
        return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, exponent);
    return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
};

const joinRemote = (base: string, relative: string): string => {
    const cleanBase = `/${base.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')}`;
    const cleanRelative = relative.replace(/^\/+|\/+$/g, '');
    if (!cleanRelative) {
        return cleanBase === '' ? '/' : cleanBase;
    }
    return `${cleanBase === '/' ? '' : cleanBase}/${cleanRelative}`;
};

const normalizeHostPort = (rawHost: string, rawPort: string, protocol: 'sftp' | 'ftp'): { host: string; port: number } => {
    let hostValue = rawHost.trim();
    let portValue = rawPort.trim();

    hostValue = hostValue.replace(/^(sftp|ftp|ssh):\/\//i, '');

    const bracketMatch = hostValue.match(/^\[([^\]]+)\](?::(\d+))?$/);
    if (bracketMatch) {
        hostValue = bracketMatch[1];
        if (bracketMatch[2] && portValue === '') {
            portValue = bracketMatch[2];
        }
    } else {
        const colonCount = (hostValue.match(/:/g) || []).length;
        if (colonCount === 1) {
            const parts = hostValue.split(':');
            hostValue = parts[0];
            if (portValue === '') {
                portValue = parts[1];
            }
        }
    }

    const defaultPort = protocol === 'ftp' ? 21 : 22;
    const parsedPort = portValue === '' ? defaultPort : parseInt(portValue, 10);

    return {
        host: hostValue,
        port: Number.isFinite(parsedPort) && parsedPort > 0 && parsedPort <= 65535 ? parsedPort : defaultPort,
    };
};

const buildNodes = (entries: RemoteEntry[], parentPath: string): TreeNode[] =>
    entries.map((entry) => ({
        name: entry.name,
        path: parentPath ? `${parentPath}/${entry.name}` : entry.name,
        directory: entry.directory,
        size: entry.size,
        expanded: false,
        loading: false,
        loaded: false,
        children: [],
    }));

const ServerImportContainer = () => {
    const { t } = useTranslation('server');
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const eggId = ServerContext.useStoreState((state) => state.server.data?.eggId);
    const addonSettings = useStoreState((state: ApplicationStore) => state.settings.data?.addons?.serverImporter);

    const isEnabled = addonSettings?.enabled ?? false;
    const allowedEggs = addonSettings?.allowedEggs ?? [];
    const isEggAllowed = allowedEggs.length === 0 || (eggId !== undefined && allowedEggs.includes(eggId));

    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<'idle' | 'importing' | 'completed' | 'failed' | 'cancelled'>('idle');
    const [progress, setProgress] = useState<ImportProgress | null>(null);

    const [protocol, setProtocol] = useState<'sftp' | 'ftp'>('sftp');
    const [host, setHost] = useState('');
    const [port, setPort] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [remotePath, setRemotePath] = useState('/');

    const [testing, setTesting] = useState(false);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [rootNodes, setRootNodes] = useState<TreeNode[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const [wipe, setWipe] = useState(false);
    const [confirmModal, setConfirmModal] = useState(false);
    const [confirmText, setConfirmText] = useState('');
    const [confirmError, setConfirmError] = useState<string | null>(null);
    const [starting, setStarting] = useState(false);

    const mountedRef = useRef(true);
    const runningRef = useRef(false);

    const credentials = useCallback(
        (): ServerImportCredentials => {
            const normalized = normalizeHostPort(host, port, protocol);
            return {
                protocol,
                host: normalized.host,
                port: normalized.port,
                username,
                password,
                remote_path: remotePath.trim() === '' ? '/' : remotePath.trim(),
            };
        },
        [protocol, host, port, username, password, remotePath],
    );

    const runImport = useCallback(async () => {
        if (runningRef.current) {
            return;
        }
        runningRef.current = true;
        setError(null);
        try {
            while (mountedRef.current) {
                const response = await stepImport(uuid);
                if (!mountedRef.current) {
                    break;
                }
                if (response.progress) {
                    setProgress(response.progress);
                }
                setStatus(response.status as typeof status);
                if (response.status !== 'importing') {
                    break;
                }
            }
        } catch {
            if (mountedRef.current) {
                setError(t('server_import.errors.interrupted', 'The import was interrupted. You can resume it below.'));
            }
        } finally {
            runningRef.current = false;
        }
    }, [uuid, t]);

    useEffect(() => {
        mountedRef.current = true;
        if (!isEnabled || !isEggAllowed) {
            setLoading(false);
            return;
        }
        getImportStatus(uuid)
            .then((response) => {
                if (!mountedRef.current) {
                    return;
                }
                setStatus(response.status);
                setProgress(response.progress);
                if (response.status === 'importing') {
                    runImport();
                }
            })
            .catch(() => undefined)
            .finally(() => mountedRef.current && setLoading(false));
        return () => {
            mountedRef.current = false;
        };
    }, [uuid, isEnabled, isEggAllowed, runImport]);

    const ancestorSelected = useCallback(
        (path: string): boolean => {
            for (const item of selected) {
                if (path === item || path.startsWith(`${item}/`)) {
                    if (path !== item) {
                        return true;
                    }
                }
            }
            return false;
        },
        [selected],
    );

    const isIncluded = useCallback(
        (path: string): boolean => {
            if (selected.has(path)) {
                return true;
            }
            return ancestorSelected(path);
        },
        [selected, ancestorSelected],
    );

    const toggleSelection = useCallback((path: string) => {
        setSelected((previous) => {
            const next = new Set(previous);
            if (next.has(path)) {
                next.delete(path);
            } else {
                for (const item of Array.from(next)) {
                    if (item.startsWith(`${path}/`)) {
                        next.delete(item);
                    }
                }
                next.add(path);
            }
            return next;
        });
    }, []);

    const handleTest = async () => {
        if (!host.trim() || !username.trim()) {
            setError(t('server_import.errors.missing_fields', 'Please enter at least a host and username.'));
            return;
        }
        setTesting(true);
        setError(null);
        try {
            const response = await testImportConnection(uuid, credentials());
            if (!response.success) {
                setConnected(false);
                setError(response.error || t('server_import.errors.connect', 'Could not connect to the source host.'));
                return;
            }
            setConnected(true);
            setRootNodes(buildNodes(response.entries || [], ''));
            setSelected(new Set());
        } catch (err: any) {
            setConnected(false);
            setError(
                err.response?.data?.error ||
                    err.response?.data?.errors?.[0]?.detail ||
                    t('server_import.errors.connect', 'Could not connect to the source host.'),
            );
        } finally {
            setTesting(false);
        }
    };

    const updateNode = (nodes: TreeNode[], path: string, updater: (node: TreeNode) => TreeNode): TreeNode[] =>
        nodes.map((node) => {
            if (node.path === path) {
                return updater(node);
            }
            if (node.children.length > 0 && path.startsWith(`${node.path}/`)) {
                return { ...node, children: updateNode(node.children, path, updater) };
            }
            return node;
        });

    const handleToggleExpand = async (node: TreeNode) => {
        if (!node.directory) {
            return;
        }
        if (node.expanded) {
            setRootNodes((nodes) => updateNode(nodes, node.path, (current) => ({ ...current, expanded: false })));
            return;
        }
        if (node.loaded) {
            setRootNodes((nodes) => updateNode(nodes, node.path, (current) => ({ ...current, expanded: true })));
            return;
        }
        setRootNodes((nodes) => updateNode(nodes, node.path, (current) => ({ ...current, loading: true, expanded: true })));
        try {
            const response = await browseImportDirectory(uuid, credentials(), joinRemote(remotePath, node.path));
            const children = response.success ? buildNodes(response.entries || [], node.path) : [];
            setRootNodes((nodes) =>
                updateNode(nodes, node.path, (current) => ({
                    ...current,
                    loading: false,
                    loaded: true,
                    children,
                })),
            );
        } catch {
            setRootNodes((nodes) =>
                updateNode(nodes, node.path, (current) => ({ ...current, loading: false, loaded: true, children: [] })),
            );
        }
    };

    const beginImport = async () => {
        setStarting(true);
        setError(null);
        setConfirmError(null);
        try {
            const response = await startImport(uuid, credentials(), Array.from(selected), wipe);
            if (!response.success) {
                const message = response.error || t('server_import.errors.start', 'Failed to start the import.');
                setError(message);
                setConfirmError(message);
                return;
            }
            setConfirmModal(false);
            setConfirmText('');
            setConfirmError(null);
            setProgress(response.progress || null);
            setStatus('importing');
            runImport();
        } catch (err: any) {
            const message =
                err.response?.data?.error ||
                err.response?.data?.errors?.[0]?.detail ||
                err.message ||
                t('server_import.errors.start', 'Failed to start the import.');
            setError(message);
            setConfirmError(message);
        } finally {
            setStarting(false);
        }
    };

    const handleStart = () => {
        if (!connected) {
            setError(t('server_import.errors.not_connected', 'Test the connection and browse the remote files before starting an import.'));
            return;
        }
        if (wipe) {
            setConfirmText('');
            setConfirmError(null);
            setConfirmModal(true);
            return;
        }
        beginImport();
    };

    const handleCancel = async () => {
        try {
            await cancelImport(uuid);
            setStatus('cancelled');
        } catch {
            setError(t('server_import.errors.cancel', 'Failed to cancel the import.'));
        }
    };

    const handleReset = async () => {
        try {
            await resetImport(uuid);
        } catch {
            // ignore
        }
        setStatus('idle');
        setProgress(null);
        setError(null);
    };

    if (!isEnabled || !isEggAllowed) {
        return (
            <PageContentBlock title={t('navigation.server_import', 'Server Importer')}>
                <div className={styles.disabledState}>
                    <FontAwesomeIcon icon={faFileImport} />
                    <h3 className={styles.disabledTitle}>{t('server_import.disabled.title', 'Server Importer Unavailable')}</h3>
                    <p className={styles.disabledText}>
                        {!isEnabled
                            ? t('server_import.disabled.message', 'The Server Importer addon is currently disabled.')
                            : t('server_import.disabled.egg', 'This server type is not allowed to use the Server Importer.')}
                    </p>
                </div>
            </PageContentBlock>
        );
    }

    if (loading) {
        return (
            <PageContentBlock title={t('navigation.server_import', 'Server Importer')}>
                <div className={styles.loadingContainer}>
                    <div className={styles.spinner} />
                </div>
            </PageContentBlock>
        );
    }

    const isImporting = status === 'importing';
    const isFinished = status === 'completed' || status === 'failed' || status === 'cancelled';

    return (
        <PageContentBlock title={t('navigation.server_import', 'Server Importer')}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <h1 className={styles.title}>
                        {t('navigation.server_import', 'Server Importer')}
                    </h1>
                    <p className={styles.subtitle}>
                        {t(
                            'server_import.subtitle',
                            'Migrate your files from another host over SFTP or FTP. Your server must be offline and will stay locked until the import finishes.',
                        )}
                    </p>
                </div>

                {error && (
                    <div className={`${styles.banner} ${styles.bannerError}`}>
                        <FontAwesomeIcon icon={faExclamationTriangle} />
                        <span>{error}</span>
                    </div>
                )}

                {isImporting || isFinished ? (
                    <ProgressView
                        status={status}
                        progress={progress}
                        running={runningRef.current}
                        onCancel={handleCancel}
                        onReset={handleReset}
                        onResume={runImport}
                    />
                ) : (
                    <>
                        <div className={styles.card}>
                            <h2 className={styles.sectionTitle}>
                                <FontAwesomeIcon icon={faPlug} />
                                {t('server_import.connection.title', 'Source Connection')}
                            </h2>
                            <p className={styles.sectionHint}>
                                {t('server_import.connection.hint', 'Enter the credentials for the host you are migrating away from.')}
                            </p>

                            <div className={styles.formGrid}>
                                <div className={styles.inputGroup}>
                                    <label className={styles.inputLabel}>{t('server_import.fields.protocol', 'Protocol')}</label>
                                    <div className={styles.selectWrapper}>
                                        <select
                                            className={styles.select}
                                            value={protocol}
                                            onChange={(e) => {
                                                setProtocol(e.target.value as 'sftp' | 'ftp');
                                                setConnected(false);
                                            }}
                                        >
                                            <option value="sftp">SFTP (SSH)</option>
                                            <option value="ftp">FTP</option>
                                        </select>
                                        <FontAwesomeIcon icon={faChevronDown} className={styles.selectIcon} />
                                    </div>
                                </div>
                                <div className={styles.inputGroup}>
                                    <label className={styles.inputLabel}>{t('server_import.fields.port', 'Port')}</label>
                                    <input
                                        className={styles.input}
                                        type="number"
                                        placeholder={protocol === 'ftp' ? '21' : '22'}
                                        value={port}
                                        onChange={(e) => setPort(e.target.value)}
                                    />
                                </div>
                                <div className={`${styles.inputGroup} ${styles.inputGroupFull}`}>
                                    <label className={styles.inputLabel}>{t('server_import.fields.host', 'Host')}</label>
                                    <input
                                        className={styles.input}
                                        type="text"
                                        placeholder="luna-ptero.buzz.dev"
                                        value={host}
                                        onChange={(e) => {
                                            setHost(e.target.value);
                                            setConnected(false);
                                        }}
                                    />
                                    <p className={styles.fieldHint}>
                                        {t(
                                            'server_import.fields.host_hint',
                                            'Hostname or IP only. Put the port in the port field - do not include sftp:// or :port here.',
                                        )}
                                    </p>
                                </div>
                                <div className={styles.inputGroup}>
                                    <label className={styles.inputLabel}>{t('server_import.fields.username', 'Username')}</label>
                                    <input
                                        className={styles.input}
                                        type="text"
                                        autoComplete="off"
                                        value={username}
                                        onChange={(e) => {
                                            setUsername(e.target.value);
                                            setConnected(false);
                                        }}
                                    />
                                </div>
                                <div className={styles.inputGroup}>
                                    <label className={styles.inputLabel}>{t('server_import.fields.password', 'Password')}</label>
                                    <input
                                        className={styles.input}
                                        type="password"
                                        autoComplete="new-password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>
                                <div className={`${styles.inputGroup} ${styles.inputGroupFull}`}>
                                    <label className={styles.inputLabel}>{t('server_import.fields.remote_path', 'Remote Folder')}</label>
                                    <input
                                        className={styles.input}
                                        type="text"
                                        placeholder="/"
                                        value={remotePath}
                                        onChange={(e) => {
                                            setRemotePath(e.target.value);
                                            setConnected(false);
                                        }}
                                    />
                                </div>
                            </div>

                            <div className={styles.actionsRow}>
                                <button className={styles.secondaryButton} onClick={handleTest} disabled={testing}>
                                    <FontAwesomeIcon icon={testing ? faSpinner : faPlug} spin={testing} />
                                    {testing
                                        ? t('server_import.actions.connecting', 'Connecting...')
                                        : t('server_import.actions.connect', 'Connect & Browse')}
                                </button>
                                {connected && (
                                    <span className={`${styles.banner} ${styles.bannerSuccess}`} style={{ padding: '8px 14px' }}>
                                        <FontAwesomeIcon icon={faCheckCircle} />
                                        {t('server_import.connected', 'Connected')}
                                    </span>
                                )}
                            </div>
                        </div>

                        {connected && (
                            <div className={styles.card}>
                                <h2 className={styles.sectionTitle}>
                                    <FontAwesomeIcon icon={faFolderOpen} />
                                    {t('server_import.selection.title', 'Choose What To Import')}
                                </h2>
                                <p className={styles.sectionHint}>
                                    {selected.size === 0
                                        ? t('server_import.selection.all_hint', 'Nothing selected - the entire remote folder will be imported. Tick specific files or folders to narrow it down.')
                                        : t('server_import.selection.some_hint', '{{count}} item(s) selected. Selecting a folder includes everything inside it.', { count: selected.size })}
                                </p>

                                <div className={styles.treeWrap}>
                                    <div className={styles.treeToolbar}>
                                        <span className={styles.treeToolbarLabel}>
                                            <FontAwesomeIcon icon={faFolder} />
                                            {remotePath.trim() === '' ? '/' : remotePath}
                                        </span>
                                        <div className={styles.treeToolbarActions}>
                                            <button className={styles.linkButton} onClick={() => setSelected(new Set())}>
                                                {t('server_import.actions.clear', 'Clear selection')}
                                            </button>
                                        </div>
                                    </div>
                                    <div className={styles.tree}>
                                        {rootNodes.length === 0 ? (
                                            <div className={styles.treeLoading}>
                                                {t('server_import.selection.empty', 'This folder is empty.')}
                                            </div>
                                        ) : (
                                            rootNodes.map((node) => (
                                                <TreeRow
                                                    key={node.path}
                                                    node={node}
                                                    depth={0}
                                                    isIncluded={isIncluded}
                                                    ancestorSelected={ancestorSelected}
                                                    onToggleSelect={toggleSelection}
                                                    onToggleExpand={handleToggleExpand}
                                                />
                                            ))
                                        )}
                                    </div>
                                </div>

                                <div className={styles.wipeBox}>
                                    <label className={styles.wipeToggle}>
                                        <input type="checkbox" checked={wipe} onChange={(e) => setWipe(e.target.checked)} />
                                        {t('server_import.wipe.label', 'Wipe this server before importing')}
                                    </label>
                                    <p className={styles.wipeDisclaimer}>
                                        <FontAwesomeIcon icon={faExclamationTriangle} />
                                        {t(
                                            'server_import.wipe.disclaimer',
                                            'This permanently deletes every existing file and folder on this server before the import begins. This cannot be undone.',
                                        )}
                                    </p>
                                </div>

                                <div className={styles.actionsRow}>
                                    <button className={styles.primaryButton} onClick={handleStart} disabled={starting}>
                                        <FontAwesomeIcon icon={starting ? faSpinner : faPlay} spin={starting} />
                                        {starting
                                            ? t('server_import.actions.starting', 'Starting...')
                                            : t('server_import.actions.start', 'Start Import')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {confirmModal && (
                <div className={styles.modalOverlay} onClick={() => !starting && setConfirmModal(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3 className={styles.modalTitle}>
                                {t('server_import.confirm.title', 'Confirm Server Wipe')}
                            </h3>
                            <button className={styles.modalClose} onClick={() => !starting && setConfirmModal(false)}>
                                <FontAwesomeIcon icon={faTimesCircle} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <p>
                                {t(
                                    'server_import.confirm.message',
                                    'All existing files and folders on this server will be permanently deleted before the import starts.',
                                )}
                            </p>
                            <p className={styles.modalWarning}>
                                {t('server_import.confirm.instruction', 'Type WIPE below to confirm you understand this cannot be undone.')}
                            </p>
                            <div className={styles.confirmField}>
                                <input
                                    className={styles.input}
                                    type="text"
                                    value={confirmText}
                                    placeholder="WIPE"
                                    onChange={(e) => setConfirmText(e.target.value)}
                                />
                            </div>
                            {confirmError && (
                                <div className={`${styles.banner} ${styles.bannerError} ${styles.modalError}`}>
                                    <FontAwesomeIcon icon={faExclamationTriangle} />
                                    <span>{confirmError}</span>
                                </div>
                            )}
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.secondaryButton} onClick={() => setConfirmModal(false)} disabled={starting}>
                                {t('server_import.actions.cancel', 'Cancel')}
                            </button>
                            <button
                                className={styles.modalConfirmDanger}
                                onClick={beginImport}
                                disabled={starting || confirmText.trim().toUpperCase() !== 'WIPE'}
                            >
                                <FontAwesomeIcon icon={starting ? faSpinner : faPlay} spin={starting} />
                                {starting
                                    ? t('server_import.actions.starting', 'Starting...')
                                    : t('server_import.confirm.action', 'Wipe & Import')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </PageContentBlock>
    );
};

const TreeRow: React.FC<{
    node: TreeNode;
    depth: number;
    isIncluded: (path: string) => boolean;
    ancestorSelected: (path: string) => boolean;
    onToggleSelect: (path: string) => void;
    onToggleExpand: (node: TreeNode) => void;
}> = ({ node, depth, isIncluded, ancestorSelected, onToggleSelect, onToggleExpand }) => {
    const lockedByParent = ancestorSelected(node.path);
    return (
        <>
            <div className={styles.treeRow} style={{ paddingLeft: `${16 + depth * 18}px` }}>
                {node.directory ? (
                    <button className={styles.treeToggle} onClick={() => onToggleExpand(node)}>
                        <FontAwesomeIcon
                            icon={node.loading ? faSpinner : node.expanded ? faChevronDown : faChevronRight}
                            spin={node.loading}
                        />
                    </button>
                ) : (
                    <span className={styles.treeTogglePlaceholder} />
                )}
                <input
                    type="checkbox"
                    className={styles.treeCheckbox}
                    checked={isIncluded(node.path)}
                    disabled={lockedByParent}
                    onChange={() => onToggleSelect(node.path)}
                />
                <FontAwesomeIcon
                    icon={node.directory ? faFolder : faFile}
                    className={`${styles.treeIcon} ${node.directory ? styles.treeIconFolder : ''}`}
                />
                <span className={styles.treeName}>{node.name}</span>
                {!node.directory && <span className={styles.treeSize}>{formatBytes(node.size)}</span>}
            </div>
            {node.directory && node.expanded && (
                <div className={styles.treeChildren}>
                    {node.loading ? (
                        <div className={styles.treeLoading}></div>
                    ) : node.children.length === 0 ? (
                        <div className={styles.treeLoading}>Empty</div>
                    ) : (
                        node.children.map((child) => (
                            <TreeRow
                                key={child.path}
                                node={child}
                                depth={depth + 1}
                                isIncluded={isIncluded}
                                ancestorSelected={ancestorSelected}
                                onToggleSelect={onToggleSelect}
                                onToggleExpand={onToggleExpand}
                            />
                        ))
                    )}
                </div>
            )}
        </>
    );
};

const ProgressView: React.FC<{
    status: 'idle' | 'importing' | 'completed' | 'failed' | 'cancelled';
    progress: ImportProgress | null;
    running: boolean;
    onCancel: () => void;
    onReset: () => void;
    onResume: () => void;
}> = ({ status, progress, running, onCancel, onReset, onResume }) => {
    const { t } = useTranslation('server');
    const percent = progress?.percent ?? 0;

    const statusIcon =
        status === 'completed'
            ? faCheckCircle
            : status === 'failed'
            ? faTimesCircle
            : status === 'cancelled'
            ? faBan
            : faSpinner;

    return (
        <div className={styles.progressCard}>
            <div className={styles.progressHead}>
                <h2 className={styles.progressTitle}>
                    <FontAwesomeIcon icon={statusIcon} spin={status === 'importing'} />
                    {status === 'importing'
                        ? t('server_import.progress.importing', 'Importing Files')
                        : status === 'completed'
                        ? t('server_import.progress.completed', 'Import Complete')
                        : status === 'failed'
                        ? t('server_import.progress.failed', 'Import Failed')
                        : t('server_import.progress.cancelled', 'Import Cancelled')}
                </h2>
            </div>

            <div className={styles.progressHead}>
                <span className={styles.currentFile}>
                    {status === 'importing' && progress?.current ? (
                        <>
                            <FontAwesomeIcon icon={faFile} />
                            <strong>{progress.current}</strong>
                        </>
                    ) : (
                        <span style={{ color: 'var(--color-muted)' }}>
                            {status === 'completed'
                                ? t('server_import.progress.all_done', 'All selected files have been transferred to your server.')
                                : status === 'importing'
                                ? t('server_import.progress.preparing', 'Preparing files…')
                                : ''}
                        </span>
                    )}
                </span>
                <span className={styles.progressPercent}>{percent}%</span>
            </div>

            <div className={styles.progressBarTrack}>
                <div className={styles.progressBarFill} style={{ width: `${percent}%` }} />
            </div>

            <div className={styles.progressMetaRow}>
                <div className={styles.metaCard}>
                    <span className={styles.metaLabel}>{t('server_import.progress.files', 'Files')}</span>
                    <span className={styles.metaValue}>
                        {progress?.transferred ?? 0} / {progress?.total ?? 0}
                    </span>
                </div>
                <div className={styles.metaCard}>
                    <span className={styles.metaLabel}>{t('server_import.progress.transferred', 'Transferred')}</span>
                    <span className={styles.metaValue}>{formatBytes(progress?.bytesDone ?? 0)}</span>
                </div>
                <div className={styles.metaCard}>
                    <span className={styles.metaLabel}>{t('server_import.progress.total_size', 'Total Size')}</span>
                    <span className={styles.metaValue}>{formatBytes(progress?.bytesTotal ?? 0)}</span>
                </div>
                <div className={styles.metaCard}>
                    <span className={styles.metaLabel}>{t('server_import.progress.skipped', 'Skipped')}</span>
                    <span className={styles.metaValue}>{progress?.skipped?.length ?? 0}</span>
                </div>
            </div>

            {progress?.error && (
                <div className={`${styles.banner} ${styles.bannerError}`}>
                    <FontAwesomeIcon icon={faExclamationTriangle} />
                    <span>{progress.error}</span>
                </div>
            )}

            {progress?.skipped && progress.skipped.length > 0 && (
                <div className={styles.skippedBox}>
                    <p className={styles.skippedTitle}>{t('server_import.progress.skipped_files', 'Skipped files')}</p>
                    <div className={styles.skippedList}>
                        {progress.skipped.map((item) => (
                            <div className={styles.skippedItem} key={item.path}>
                                <span>{item.path}</span>
                                <span>{item.reason}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className={styles.actionsRow}>
                {status === 'importing' ? (
                    <>
                        <button className={styles.dangerButton} onClick={onCancel}>
                            <FontAwesomeIcon icon={faStop} />
                            {t('server_import.actions.cancel_import', 'Cancel Import')}
                        </button>
                        {!running && (
                            <button className={styles.secondaryButton} onClick={onResume}>
                                <FontAwesomeIcon icon={faRedo} />
                                {t('server_import.actions.resume', 'Resume')}
                            </button>
                        )}
                    </>
                ) : (
                    <button className={styles.primaryButton} onClick={onReset}>
                        <FontAwesomeIcon icon={faRedo} />
                        {t('server_import.actions.new_import', 'Start New Import')}
                    </button>
                )}
            </div>
        </div>
    );
};

export default ServerImportContainer;
