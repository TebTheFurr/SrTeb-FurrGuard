import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faPlus,
    faTrash,
    faChevronDown,
    faCopy,
    faGlobe,
    faServer,
    faClock,
    faCheck,
    faExclamationCircle,
    faTimes,
} from '@fortawesome/free-solid-svg-icons';
import { ServerContext } from '@/state/server';
import PageContentBlock from '@/components/elements/PageContentBlock';
import getSubdomains, { Subdomain, SubdomainsResponse } from '@/api/server/subdomains/getSubdomains';
import createSubdomain from '@/api/server/subdomains/createSubdomain';
import deleteSubdomain from '@/api/server/subdomains/deleteSubdomain';
import checkSubdomain from '@/api/server/subdomains/checkSubdomain';
import styles from './subdomains.module.css';
import PrivacyServerHostBlur from '@/components/elements/PrivacyServerHostBlur';
import { useTranslation } from 'react-i18next';

const SubdomainsContainer: React.FC = () => {
    const { t } = useTranslation('server');
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<SubdomainsResponse | null>(null);

    const [newSubdomain, setNewSubdomain] = useState('');
    const [selectedAllocation, setSelectedAllocation] = useState<number | null>(null);
    const [selectedDomain, setSelectedDomain] = useState<string>('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [copiedId, setCopiedId] = useState<number | null>(null);
    const [deleteModal, setDeleteModal] = useState<Subdomain | null>(null);

    const [checking, setChecking] = useState(false);
    const [availability, setAvailability] = useState<{ available: boolean; fullDomain?: string } | null>(null);
    const [checkTimeout, setCheckTimeout] = useState<NodeJS.Timeout | null>(null);

    const fetchData = useCallback(async () => {
        try {
            const response = await getSubdomains(uuid);
            setData(response);
            setError(null);

            if (response.allocations.length === 1) {
                setSelectedAllocation(response.allocations[0].id);
            } else if (response.allocations.length > 0 && !selectedAllocation) {
                const primary = response.allocations.find((a) => a.is_primary);
                setSelectedAllocation(primary?.id || response.allocations[0].id);
            }

            if (response.status.domains.length > 0 && !selectedDomain) {
                setSelectedDomain(response.status.domains[0]);
            }
        } catch (err: any) {
            setError(err.message || t('subdomains.errors.load', 'Failed to load subdomains'));
        } finally {
            setLoading(false);
        }
    }, [uuid, selectedAllocation, selectedDomain, t]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (checkTimeout) {
            clearTimeout(checkTimeout);
        }

        if (!newSubdomain.trim() || !selectedDomain) {
            setAvailability(null);
            return;
        }

        setChecking(true);
        const timeout = setTimeout(async () => {
            try {
                const result = await checkSubdomain(uuid, newSubdomain.trim(), selectedDomain);
                setAvailability({
                    available: result.available,
                    fullDomain: result.full_domain,
                });
            } catch {
                setAvailability(null);
            } finally {
                setChecking(false);
            }
        }, 500);

        setCheckTimeout(timeout);
        return () => clearTimeout(timeout);
    }, [newSubdomain, uuid, selectedDomain]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSubdomain.trim() || !selectedAllocation || !selectedDomain) return;

        setCreating(true);
        setCreateError(null);

        try {
            await createSubdomain(uuid, {
                subdomain: newSubdomain.trim().toLowerCase(),
                allocation_id: selectedAllocation,
                domain: selectedDomain,
            });
            setNewSubdomain('');
            setAvailability(null);
            setSuccessMessage(t('subdomains.success.created', 'Subdomain created successfully!'));
            setTimeout(() => setSuccessMessage(null), 5000);
            await fetchData();
        } catch (err: any) {
            setCreateError(err.response?.data?.errors?.[0]?.detail || err.message || t('subdomains.errors.create', 'Failed to create subdomain'));
        } finally {
            setCreating(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteModal) return;

        setDeletingId(deleteModal.id);
        setDeleteModal(null);

        try {
            await deleteSubdomain(uuid, deleteModal.id);
            await fetchData();
        } catch (err: any) {
            setCreateError(err.response?.data?.errors?.[0]?.detail || err.message || t('subdomains.errors.delete', 'Failed to delete subdomain'));
        } finally {
            setDeletingId(null);
        }
    };

    const handleCopy = async (subdomain: Subdomain) => {
        try {
            const address = subdomain.proxied
                ? `https://${subdomain.full_domain}`
                : (subdomain.allocation?.port ? `${subdomain.full_domain}:${subdomain.allocation.port}` : subdomain.full_domain);
            await navigator.clipboard.writeText(address);
            setCopiedId(subdomain.id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch {
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    if (loading) {
        return (
            <PageContentBlock title={t('navigation.subdomains', 'Subdomains')}>
                <div className={styles.loadingContainer}>
                    <div className={styles.spinner} />
                </div>
            </PageContentBlock>
        );
    }

    if (!data?.status.enabled) {
        return (
            <PageContentBlock title={t('navigation.subdomains', 'Subdomains')}>
                <div className={styles.disabledState}>
                    <h3 className={styles.emptyTitle}>{t('subdomains.disabled.title', 'Subdomains Disabled')}</h3>
                    <p className={styles.emptyText}>
                        {t('subdomains.disabled.message', 'The Subdomains Manager addon is currently disabled. Please contact your administrator.')}
                    </p>
                </div>
            </PageContentBlock>
        );
    }

    if (!data?.status.configured) {
        return (
            <PageContentBlock title={t('navigation.subdomains', 'Subdomains')}>
                <div className={styles.disabledState}>
                    <h3 className={styles.emptyTitle}>{t('subdomains.not_configured.title', 'Not Configured')}</h3>
                    <p className={styles.emptyText}>
                        {t('subdomains.not_configured.message', 'The Subdomains Manager has not been configured by the administrator. CloudFlare credentials need to be set up.')}
                    </p>
                </div>
            </PageContentBlock>
        );
    }

    if (!data?.status.eggAllowed) {
        return (
            <PageContentBlock title={t('navigation.subdomains', 'Subdomains')}>
                <div className={styles.disabledState}>
                    <h3 className={styles.emptyTitle}>{t('subdomains.not_available.title', 'Not Available')}</h3>
                    <p className={styles.emptyText}>
                        {t('subdomains.not_available.message', 'Subdomains are not available for this server type.')}
                    </p>
                </div>
            </PageContentBlock>
        );
    }

    const subdomains = data.subdomains || [];
    const allocations = data.allocations || [];
    const maxSubdomains = data.status.maxPerServer;
    const isUnlimited = maxSubdomains === -1;
    const canCreate = isUnlimited || subdomains.length < maxSubdomains;

    return (
        <PageContentBlock title={t('navigation.subdomains', 'Subdomains')}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <h1 className={styles.title}>{t('navigation.subdomains', 'Subdomains')}</h1>
                    <p className={styles.subtitle}>
                        {t('subdomains.subtitle', 'Create custom subdomains for your server.')}
                    </p>
                </div>

                <div className={styles.statsRow}>
                    <div className={styles.statCard}>
                        <span className={styles.statLabel}>{t('subdomains.stats.active', 'Active Subdomains')}</span>
                        <span className={styles.statValue}>{subdomains.length}/{isUnlimited ? '∞' : maxSubdomains}</span>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statLabel}>{t('subdomains.stats.allocations', 'Available Allocations')}</span>
                        <span className={styles.statValue}>{allocations.length}</span>
                    </div>
                </div>

                {error && (
                    <div className={styles.errorState}>
                        <FontAwesomeIcon icon={faExclamationCircle} />
                        {error}
                    </div>
                )}

                {createError && (
                    <div className={styles.errorState}>
                        <FontAwesomeIcon icon={faExclamationCircle} />
                        {createError}
                    </div>
                )}

                {successMessage && (
                    <div className={styles.successMessage}>
                        <FontAwesomeIcon icon={faCheck} />
                        {successMessage}
                    </div>
                )}

                {canCreate && (
                    <div className={styles.createSection}>
                        <h3 className={styles.createTitle}>
                            {t('subdomains.create.title', 'Create New Subdomain')}
                        </h3>
                        <form onSubmit={handleCreate} className={styles.createForm}>
                            <div className={styles.inputGroup}>
                                <label className={styles.inputLabel}>{t('subdomains.create.subdomain_label', 'Subdomain')}</label>
                                <div className={styles.inputWrapper}>
                                    <input
                                        type="text"
                                        className={`${styles.subdomainInput} ${availability && !availability.available && !checking ? styles.inputUnavailable : ''}`}
                                        placeholder="myserver"
                                        value={newSubdomain}
                                        onChange={(e) => setNewSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                        maxLength={63}
                                        disabled={creating}
                                    />
                                    {data.status.domains.length === 1 ? (
                                        <span className={styles.domainSuffix}>.{data.status.domains[0]}</span>
                                    ) : (
                                        <div className={styles.selectWrapperAttached}>
                                            <select
                                                className={styles.domainSelect}
                                                value={selectedDomain}
                                                onChange={(e) => setSelectedDomain(e.target.value)}
                                                disabled={creating}
                                            >
                                                {data.status.domains.map((domain) => (
                                                    <option key={domain} value={domain}>.{domain}</option>
                                                ))}
                                            </select>
                                            <FontAwesomeIcon icon={faChevronDown} className={styles.selectIconAttached} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className={styles.inputGroup}>
                                <label className={styles.inputLabel}>{t('subdomains.create.allocation_label', 'Allocation')}</label>
                                <div className={styles.selectWrapper}>
                                    <select
                                        className={styles.allocationSelect}
                                        value={selectedAllocation || ''}
                                        onChange={(e) => setSelectedAllocation(Number(e.target.value))}
                                        disabled={creating}
                                    >
                                        {allocations.map((allocation) => (
                                            <option key={allocation.id} value={allocation.id}>
                                                {allocation.alias || allocation.ip}:{allocation.port}
                                                {allocation.is_primary ? ` (${t('network.primary', 'Primary')})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <FontAwesomeIcon icon={faChevronDown} className={styles.selectIcon} />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className={styles.createButton}
                                disabled={creating || !newSubdomain.trim() || !selectedAllocation || !selectedDomain || (availability !== null && !availability.available)}
                            >
                                <FontAwesomeIcon icon={creating ? faCheck : faPlus} spin={creating} />
                                {creating ? t('subdomains.create.creating', 'Creating...') : t('subdomains.create.submit', 'Create Subdomain')}
                            </button>
                        </form>
                    </div>
                )}

                {subdomains.length === 0 ? (
                    <div className={styles.emptyState}>
                        <h3 className={styles.emptyTitle}>{t('subdomains.empty.title', 'No Subdomains Yet')}</h3>
                    </div>
                ) : (
                    <div className={styles.subdomainsList}>
                        {subdomains.map((subdomain) => (
                            <div key={subdomain.id} className={styles.subdomainCard}>
                                <div className={styles.subdomainInfo}>
                                    <div className={styles.subdomainDomain}>
                                        <FontAwesomeIcon icon={faGlobe} />
                                        {subdomain.proxied
                                            ? subdomain.full_domain
                                            : (subdomain.allocation?.port ? `${subdomain.full_domain}:${subdomain.allocation.port}` : subdomain.full_domain)}
                                    </div>
                                    <div className={styles.subdomainMeta}>
                                        <span className={styles.metaItem}>
                                            <FontAwesomeIcon icon={faServer} />
                                            {subdomain.allocation?.alias ? (
                                                `${subdomain.allocation.alias}:${subdomain.allocation.port}`
                                            ) : subdomain.allocation ? (
                                                <PrivacyServerHostBlur>
                                                    {subdomain.allocation.ip}:{subdomain.allocation.port}
                                                </PrivacyServerHostBlur>
                                            ) : null}
                                        </span>
                                        <span className={styles.metaItem}>
                                            <FontAwesomeIcon icon={faClock} />
                                            {t('subdomains.created_at', 'Created {{date}}', { date: formatDate(subdomain.created_at) })}
                                        </span>
                                    </div>
                                </div>
                                <div className={styles.subdomainActions}>
                                    <button
                                        className={styles.copyButton}
                                        onClick={() => handleCopy(subdomain)}
                                    >
                                        <FontAwesomeIcon icon={copiedId === subdomain.id ? faCheck : faCopy} />
                                        {copiedId === subdomain.id ? t('subdomains.copied', 'Copied!') : t('startup.copy', 'Copy')}
                                    </button>
                                    <button
                                        className={styles.deleteButton}
                                        onClick={() => setDeleteModal(subdomain)}
                                        disabled={deletingId === subdomain.id}
                                    >
                                        <FontAwesomeIcon icon={faTrash} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {deleteModal && (
                    <div className={styles.modalOverlay} onClick={() => setDeleteModal(null)}>
                        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                            <div className={styles.modalHeader}>
                                <h3 className={styles.modalTitle}>{t('subdomains.delete.title', 'Delete Subdomain')}</h3>
                                <button className={styles.modalClose} onClick={() => setDeleteModal(null)}>
                                    <FontAwesomeIcon icon={faTimes} />
                                </button>
                            </div>
                            <div className={styles.modalBody}>
                                <p>{t('subdomains.delete.confirm', 'Are you sure you want to delete {{domain}}?', { domain: deleteModal.full_domain })}</p>
                                <p className={styles.modalWarning}>{t('subdomains.delete.warning', 'This action cannot be undone.')}</p>
                            </div>
                            <div className={styles.modalFooter}>
                                <button className={styles.modalCancel} onClick={() => setDeleteModal(null)}>
                                    {t('databases.cancel', 'Cancel')}
                                </button>
                                <button className={styles.modalConfirm} onClick={confirmDelete}>
                                    {t('files.actions.delete', 'Delete')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </PageContentBlock>
    );
};

export default SubdomainsContainer;
