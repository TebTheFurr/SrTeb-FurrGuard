import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faExternalLinkAlt, faLayerGroup, faNetworkWired, faServer, faTimes, faTrash } from '@fortawesome/free-solid-svg-icons';
import PageContentBlock from '@/components/elements/PageContentBlock';
import Spinner from '@/components/elements/Spinner';
import { ServerContext } from '@/state/server';
import { httpErrorToHuman } from '@/api/http';
import {
    createServerSplit,
    deleteServerSplit,
    getServerSplits,
    ServerSplit,
    ServerSplitsResponse,
} from '@/api/server/splits';
import styles from './splits.module.css';

const formatMb = (value: number | null) => {
    if (value === null) {
        return 'Unlimited';
    }

    if (value >= 1024) {
        return `${(value / 1024).toFixed(value % 1024 === 0 ? 0 : 1)} GB`;
    }

    return `${value} MB`;
};

const formatCpu = (value: number | null) => (value === null ? 'Unlimited' : `${value}%`);

const formatAllocationCount = (count: number) => `${count} allocation${count === 1 ? '' : 's'}`;

const formatSplitStatus = (status: string | null) => {
    if (!status) {
        return 'Ready';
    }

    return status
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

const getSplitStatusClass = (status: string | null) => {
    if (!status) {
        return styles.statusReady;
    }

    if (status === 'installing' || status === 'restoring_backup') {
        return styles.statusWarning;
    }

    if (status === 'install_failed' || status === 'reinstall_failed' || status === 'suspended') {
        return styles.statusError;
    }

    return styles.statusNeutral;
};

const ServerSplitsContainer = () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const parentName = ServerContext.useStoreState((state) => state.server.data!.name);

    const [data, setData] = useState<ServerSplitsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<number | null>(null);
    const [splitToDelete, setSplitToDelete] = useState<ServerSplit | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [eggId, setEggId] = useState('');
    const [memory, setMemory] = useState('1024');
    const [cpu, setCpu] = useState('50');
    const [disk, setDisk] = useState('2048');
    const [allocations, setAllocations] = useState('1');
    const [databases, setDatabases] = useState('0');
    const [backups, setBackups] = useState('0');

    const refresh = async () => {
        try {
            const response = await getServerSplits(uuid);
            setData(response);
            setError(null);

            const defaultEggId = response.status.parent_egg_id
                ?? response.status.split_eggs?.[0]?.id;

            if (defaultEggId) {
                setEggId(String(defaultEggId));
            }
        } catch (error) {
            setError(httpErrorToHuman(error));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
    }, [uuid]);

    const maxSplits = data?.status.limits?.max_splits ?? 0;
    const canCreate = Boolean(
        data?.status.enabled
        && data.usage
        && data.status.limits
        && data.status.split_eggs?.length
        && (maxSplits <= 0 || data.usage.used.count < maxSplits)
    );

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        setSaving(true);
        setError(null);

        try {
            await createServerSplit(uuid, {
                name,
                description,
                egg_id: Number(eggId),
                memory: Number(memory),
                cpu: Number(cpu),
                disk: Number(disk),
                allocations: Number(allocations),
                database_limit: Number(databases),
                backup_limit: Number(backups),
            });

            setName('');
            setDescription('');
            await refresh();
        } catch (error) {
            setError(httpErrorToHuman(error));
        } finally {
            setSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!splitToDelete) {
            return;
        }

        setDeleting(splitToDelete.server_id);
        setSplitToDelete(null);
        setError(null);

        try {
            await deleteServerSplit(uuid, splitToDelete.server_id);
            await refresh();
        } catch (error) {
            setError(httpErrorToHuman(error));
        } finally {
            setDeleting(null);
        }
    };

    if (loading) {
        return (
            <PageContentBlock title={'Server Splits'}>
                <Spinner size={'large'} centered />
            </PageContentBlock>
        );
    }

    if (!data?.status.enabled) {
        return (
            <PageContentBlock title={'Server Splits'}>
                <div className={styles.emptyState}>
                    <FontAwesomeIcon icon={faLayerGroup} className={styles.emptyIcon} />
                    <p>{data?.status.message || 'Server Splitter is currently disabled.'}</p>
                </div>
            </PageContentBlock>
        );
    }

    const usage = data.usage;
    const splits = data.splits;

    return (
        <PageContentBlock title={'Server Splits'}>
            <div className={styles.layout}>
                <div>
                    <div className={styles.panel}>
                        <div className={styles.header}>
                            <div>
                                <h2 className={styles.title}>Split Servers</h2>
                                <p className={styles.subtitle}>
                                    Create smaller servers from {parentName}. Resources you give a split are taken from this server.
                                </p>
                            </div>
                        </div>

                        {error && <div className={styles.error}>{error}</div>}

                        {usage && (
                            <div className={styles.metricGrid}>
                                <div className={styles.metric}>
                                    <div className={styles.metricLabel}>RAM you can split</div>
                                    <div className={styles.metricValue}>{formatMb(usage.available.memory)}</div>
                                </div>
                                <div className={styles.metric}>
                                    <div className={styles.metricLabel}>CPU you can split</div>
                                    <div className={styles.metricValue}>{formatCpu(usage.available.cpu)}</div>
                                </div>
                                <div className={styles.metric}>
                                    <div className={styles.metricLabel}>Disk you can split</div>
                                    <div className={styles.metricValue}>{formatMb(usage.available.disk)}</div>
                                </div>
                                <div className={styles.metric}>
                                    <div className={styles.metricLabel}>Allocations you can split</div>
                                    <div className={styles.metricValue}>{usage.available.allocations}</div>
                                </div>
                                <div className={styles.metric}>
                                    <div className={styles.metricLabel}>Splits used</div>
                                    <div className={styles.metricValue}>{usage.used.count}</div>
                                </div>
                                <div className={styles.metric}>
                                    <div className={styles.metricLabel}>Backups you can split</div>
                                    <div className={styles.metricValue}>{usage.available.backups}</div>
                                </div>
                            </div>
                        )}

                        {splits.length === 0 ? (
                            <div className={styles.emptyState}>
                                <FontAwesomeIcon icon={faServer} className={styles.emptyIcon} />
                                <p>No split servers have been created from this parent yet.</p>
                            </div>
                        ) : (
                            <div className={styles.splitList}>
                                {splits.map((split) => (
                                    <div className={styles.splitCard} key={split.id}>
                                        <div className={styles.splitMain}>
                                            <h3 className={styles.splitName}>{split.name}</h3>
                                            <div className={styles.splitMeta}>
                                                <span className={styles.metaItem}>
                                                    <FontAwesomeIcon icon={faServer} />
                                                    {split.node || 'Unknown node'}
                                                </span>
                                                <span className={styles.metaItem}>
                                                    <FontAwesomeIcon icon={faNetworkWired} />
                                                    {split.address || 'No allocation'}
                                                </span>
                                                <span className={`${styles.splitStatus} ${getSplitStatusClass(split.status)}`}>
                                                    <span className={styles.splitStatusDot} aria-hidden={'true'} />
                                                    {formatSplitStatus(split.status)}
                                                </span>
                                            </div>
                                            <div className={styles.splitResources}>
                                                <span>{formatMb(split.memory)} RAM</span>
                                                <span className={styles.splitResourceDivider} aria-hidden={'true'}>•</span>
                                                <span>{split.cpu}% CPU</span>
                                                <span className={styles.splitResourceDivider} aria-hidden={'true'}>•</span>
                                                <span>{formatMb(split.disk)} Disk</span>
                                                <span className={styles.splitResourceDivider} aria-hidden={'true'}>•</span>
                                                <span>{formatAllocationCount(split.allocations)}</span>
                                            </div>
                                        </div>
                                        <div className={styles.splitActions}>
                                            <Link className={styles.openButton} to={`/server/${split.identifier}`}>
                                                <FontAwesomeIcon icon={faExternalLinkAlt} />
                                                Open
                                            </Link>
                                            {data.status.users_may_delete && (
                                                <button
                                                    className={styles.deleteButton}
                                                    disabled={deleting === split.server_id}
                                                    onClick={() => setSplitToDelete(split)}
                                                    title={'Delete split'}
                                                >
                                                    <FontAwesomeIcon icon={faTrash} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className={styles.panel}>
                    <h2 className={styles.title}>Create Split</h2>
                    <p className={styles.subtitle}>Choose an egg and set the resources to take from this server.</p>

                    <form className={styles.form} onSubmit={submit}>
                        <div className={styles.field}>
                            <label className={styles.label}>Name</label>
                            <input className={styles.input} value={name} onChange={(event) => setName(event.target.value)} required />
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label}>Description</label>
                            <input className={styles.input} value={description} onChange={(event) => setDescription(event.target.value)} />
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label}>Egg</label>
                            {data.status.split_eggs && data.status.split_eggs.length > 0 ? (
                                <div className={styles.selectWrapper}>
                                    <select
                                        className={styles.select}
                                        value={eggId}
                                        onChange={(event) => setEggId(event.target.value)}
                                        required
                                    >
                                        {data.status.split_eggs.map((egg) => (
                                            <option key={egg.id} value={egg.id}>
                                                {egg.name} ({egg.nest_name})
                                            </option>
                                        ))}
                                    </select>
                                    <FontAwesomeIcon icon={faChevronDown} className={styles.selectIcon} />
                                </div>
                            ) : (
                                <p className={styles.fieldHint}>No eggs are available. Configure allowed eggs in the Server Splitter addon settings.</p>
                            )}
                        </div>

                        <div className={styles.fieldGrid}>
                            <div className={styles.field}>
                                <label className={styles.label}>RAM (MB)</label>
                                <input className={styles.input} value={memory} onChange={(event) => setMemory(event.target.value)} inputMode={'numeric'} required />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label}>CPU (%)</label>
                                <input className={styles.input} value={cpu} onChange={(event) => setCpu(event.target.value)} inputMode={'numeric'} required />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label}>Disk (MB)</label>
                                <input className={styles.input} value={disk} onChange={(event) => setDisk(event.target.value)} inputMode={'numeric'} required />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label}>Allocations</label>
                                <input className={styles.input} value={allocations} onChange={(event) => setAllocations(event.target.value)} inputMode={'numeric'} required />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label}>Databases</label>
                                <input className={styles.input} value={databases} onChange={(event) => setDatabases(event.target.value)} inputMode={'numeric'} required />
                            </div>
                            <div className={styles.field}>
                                <label className={styles.label}>Backups</label>
                                <input className={styles.input} value={backups} onChange={(event) => setBackups(event.target.value)} inputMode={'numeric'} required />
                            </div>
                        </div>

                        <button className={styles.button} disabled={saving || !canCreate || !eggId}>
                            {saving ? 'Creating...' : !data.status.split_eggs?.length ? 'No Eggs Available' : canCreate ? 'Create Split' : 'Split Limit Reached'}
                        </button>
                    </form>
                </div>
            </div>

            {splitToDelete && (
                <div className={styles.modalOverlay} onClick={() => setSplitToDelete(null)}>
                    <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3 className={styles.modalTitle}>Delete Split</h3>
                            <button className={styles.modalClose} onClick={() => setSplitToDelete(null)}>
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <p>Are you sure you want to delete {splitToDelete.name}?</p>
                            <p className={styles.modalWarning}>This will permanently delete the split server and release its reserved resources back to the parent. This action cannot be undone.</p>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.modalCancel} onClick={() => setSplitToDelete(null)}>
                                Cancel
                            </button>
                            <button className={styles.modalConfirm} onClick={confirmDelete}>
                                Delete Split
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </PageContentBlock>
    );
};

export default ServerSplitsContainer;
