import React, { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faChevronDown,
    faPlus,
    faTrash,
    faNetworkWired,
    faServer,
    faClock,
    faExclamationCircle,
    faCheck,
    faSpinner,
    faTimes,
    faLock,
} from '@fortawesome/free-solid-svg-icons';
import { ServerContext } from '@/state/server';
import PageContentBlock from '@/components/elements/PageContentBlock';
import getReverseProxies, {
    ReverseProxy,
    ReverseProxiesResponse,
    createReverseProxy,
    deleteReverseProxy,
    confirmReverseProxyDns,
    checkDomain,
} from '@/api/server/reverse-proxies';
import styles from './reverse-proxies.module.css';
import PrivacyServerHostBlur from '@/components/elements/PrivacyServerHostBlur';
import { useTranslation } from 'react-i18next';

const ReverseProxiesContainer: React.FC = () => {
    const { t } = useTranslation('server');
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<ReverseProxiesResponse | null>(null);

    const [newDomain, setNewDomain] = useState('');
    const [selectedAllocation, setSelectedAllocation] = useState<number | null>(null);
    const [sslEnabled, setSslEnabled] = useState(true);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [confirmingId, setConfirmingId] = useState<number | null>(null);
    const [watchActiveProxyId, setWatchActiveProxyId] = useState<number | null>(null);
    const [deleteModal, setDeleteModal] = useState<ReverseProxy | null>(null);

    const [checking, setChecking] = useState(false);
    const [availability, setAvailability] = useState<{
        valid: boolean;
        available: boolean;
        dns_matches: boolean;
        expected_ip: string;
        resolved_ips: string[];
        domain: string;
    } | null>(null);
    const [checkTimeout, setCheckTimeout] = useState<NodeJS.Timeout | null>(null);

    const performDomainCheck = useCallback(async () => {
        const input = newDomain.trim();

        if (!input || !selectedAllocation) {
            setAvailability(null);
            return;
        }

        setChecking(true);

        try {
            const result = await checkDomain(uuid, input, selectedAllocation);
            setAvailability(result);
        } catch {
            setAvailability(null);
        } finally {
            setChecking(false);
        }
    }, [newDomain, selectedAllocation, uuid]);

    const fetchData = useCallback(async () => {
        try {
            const response = await getReverseProxies(uuid);
            setData(response);
            setError(null);

            if (response.allocations.length === 1) {
                setSelectedAllocation(response.allocations[0].id);
            } else if (response.allocations.length > 0 && !selectedAllocation) {
                const primary = response.allocations.find((a) => a.is_primary);
                setSelectedAllocation(primary?.id || response.allocations[0].id);
            }
        } catch (err: any) {
            setError(err.message || t('reverse_proxies.errors.load', 'Failed to load reverse proxies'));
        } finally {
            setLoading(false);
        }
    }, [uuid, selectedAllocation, t]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (checkTimeout) {
            clearTimeout(checkTimeout);
        }

        const timeout = setTimeout(async () => {
            await performDomainCheck();
        }, 500);

        setCheckTimeout(timeout);
        return () => clearTimeout(timeout);
    }, [newDomain, selectedAllocation, performDomainCheck]);

    useEffect(() => {
        if (!watchActiveProxyId) {
            return;
        }

        const interval = setInterval(async () => {
            try {
                const response = await getReverseProxies(uuid);
                const proxy = response.proxies.find((item) => item.id === watchActiveProxyId);

                if (!proxy) {
                    setWatchActiveProxyId(null);
                    return;
                }

                if (proxy.status === 'active') {
                    window.location.reload();
                    return;
                }

                if (proxy.status === 'failed') {
                    setCreateError(proxy.error_message || t('reverse_proxies.errors.configuration_failed', 'Reverse proxy configuration failed.'));
                    setWatchActiveProxyId(null);
                }
            } catch {
            }
        }, 4000);

        return () => clearInterval(interval);
    }, [watchActiveProxyId, uuid, t]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDomain.trim() || !selectedAllocation || !availability?.available || !availability.valid) return;

        setCreating(true);
        setCreateError(null);

        try {
            const response = await createReverseProxy(uuid, {
                domain: availability.domain,
                allocation_id: selectedAllocation,
                ssl_enabled: sslEnabled,
            });
            setNewDomain('');
            setSslEnabled(true);
            setAvailability(null);
            setSuccessMessage(t('reverse_proxies.success.saved', 'Reverse proxy saved. Add an A record for {{domain}} pointing to {{ip}}, then confirm it below.', {
                domain: response.proxy.domain,
                ip: response.proxy.expected_dns_ip,
            }));
            setTimeout(() => setSuccessMessage(null), 7000);
            window.location.reload();
        } catch (err: any) {
            setCreateError(err.response?.data?.errors?.[0]?.detail || err.message || t('reverse_proxies.errors.create', 'Failed to create reverse proxy'));
        } finally {
            setCreating(false);
        }
    };

    const handleConfirmDns = async (proxy: ReverseProxy) => {
        setConfirmingId(proxy.id);
        setCreateError(null);

        try {
            const response = await confirmReverseProxyDns(uuid, proxy.id);
            setSuccessMessage(response.message || t('reverse_proxies.success.dns_confirmed', 'DNS confirmed. Reverse proxy configuration has started.'));
            setTimeout(() => setSuccessMessage(null), 7000);
            setWatchActiveProxyId(proxy.id);
            await fetchData();
        } catch (err: any) {
            setCreateError(err.response?.data?.errors?.[0]?.detail || err.message || t('reverse_proxies.errors.confirm_dns', 'Failed to confirm DNS'));
        } finally {
            setConfirmingId(null);
        }
    };

    const confirmDelete = async () => {
        if (!deleteModal) return;

        setDeletingId(deleteModal.id);
        setDeleteModal(null);

        try {
            await deleteReverseProxy(uuid, deleteModal.id);
            window.location.reload();
        } catch (err: any) {
            setCreateError(err.response?.data?.errors?.[0]?.detail || err.message || t('reverse_proxies.errors.delete', 'Failed to delete reverse proxy'));
        } finally {
            setDeletingId(null);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'active':
                return styles.statusActive;
            case 'pending':
                return styles.statusPending;
            case 'failed':
                return styles.statusFailed;
            case 'deleting':
                return styles.statusDeleting;
            default:
                return '';
        }
    };

    const getStatusLabel = (proxy: ReverseProxy) => {
        if (proxy.status === 'pending' && !proxy.dns_verified) {
            return t('reverse_proxies.status.awaiting_dns', 'awaiting dns');
        }

        if (proxy.status === 'pending' && proxy.dns_verified) {
            return t('reverse_proxies.status.configuring', 'configuring');
        }

        return proxy.status;
    };

    if (loading) {
        return (
            <PageContentBlock title={t('navigation.reverse_proxies', 'Reverse Proxies')}>
                <div className={styles.loadingContainer}>
                    <div className={styles.spinner} />
                </div>
            </PageContentBlock>
        );
    }

    if (!data?.status.enabled) {
        return (
            <PageContentBlock title={t('navigation.reverse_proxies', 'Reverse Proxies')}>
                <div className={styles.disabledState}>
                    <h3 className={styles.emptyTitle}>{t('reverse_proxies.disabled.title', 'Reverse Proxy Manager Disabled')}</h3>
                    <p className={styles.emptyText}>
                        {t('reverse_proxies.disabled.message', 'The Reverse Proxy Manager addon is currently disabled. Please contact your administrator.')}
                    </p>
                </div>
            </PageContentBlock>
        );
    }

    if (!data?.status.configured) {
        return (
            <PageContentBlock title={t('navigation.reverse_proxies', 'Reverse Proxies')}>
                <div className={styles.disabledState}>
                    <h3 className={styles.emptyTitle}>{t('reverse_proxies.not_configured.title', 'Not Configured')}</h3>
                    <p className={styles.emptyText}>
                        {t('reverse_proxies.not_configured.message', "The Reverse Proxy Manager could not determine a valid IPv4 address from this server's allocations.")}
                    </p>
                </div>
            </PageContentBlock>
        );
    }

    if (!data?.status.egg_allowed) {
        return (
            <PageContentBlock title={t('navigation.reverse_proxies', 'Reverse Proxies')}>
                <div className={styles.disabledState}>
                    <h3 className={styles.emptyTitle}>{t('reverse_proxies.not_available.title', 'Not Available')}</h3>
                    <p className={styles.emptyText}>
                        {t('reverse_proxies.not_available.message', 'Reverse proxies are not available for this server type.')}
                    </p>
                </div>
            </PageContentBlock>
        );
    }

    const proxies = data.proxies || [];
    const allocations = data.allocations || [];
    const maxProxies = data.status.max_per_server;
    const isUnlimited = maxProxies === -1;
    const canCreate = isUnlimited || proxies.length < maxProxies;

    return (
        <PageContentBlock title={t('navigation.reverse_proxies', 'Reverse Proxies')}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <h1 className={styles.title}>{t('navigation.reverse_proxies', 'Reverse Proxies')}</h1>
                    <p className={styles.subtitle}>
                        {t('reverse_proxies.subtitle', 'Attach your own domains to this server by using a reverse proxy')}
                    </p>
                </div>

                <div className={styles.statsRow}>
                    <div className={styles.statCard}>
                        <span className={styles.statLabel}>{t('reverse_proxies.stats.active', 'Active Proxies')}</span>
                        <span className={styles.statValue}>{proxies.length}/{isUnlimited ? '∞' : maxProxies}</span>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statLabel}>{t('reverse_proxies.stats.proxy_type', 'Proxy Type')}</span>
                        <span className={styles.statValue}>{data.status.proxy_type}</span>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statLabel}>{t('reverse_proxies.stats.ssl_type', 'SSL Type')}</span>
                        <span className={styles.statValue}>{data.status.ssl_type}</span>
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
                            {t('reverse_proxies.create.title', 'Create New Reverse Proxy')}
                        </h3>
                        <form onSubmit={handleCreate} className={styles.createForm}>
                            <div className={styles.inputGroup}>
                                <label className={styles.inputLabel}>{t('reverse_proxies.create.domain_label', 'Domain')}</label>
                                <input
                                    type="text"
                                    className={`${styles.domainInput} ${availability && !availability.available && !checking ? styles.inputUnavailable : ''}`}
                                    placeholder="www.example.com"
                                    value={newDomain}
                                    onChange={(e) => setNewDomain(e.target.value.toLowerCase())}
                                    disabled={creating}
                                />
                            </div>

                            <div className={styles.inputGroup}>
                                <label className={styles.inputLabel}>{t('reverse_proxies.create.allocation_label', 'Allocation')}</label>
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

                            <div className={styles.sslToggleWrapper}>
                                <button
                                    type="button"
                                    className={`${styles.sslToggleButton} ${sslEnabled ? styles.sslToggleActive : ''}`}
                                    onClick={() => setSslEnabled(!sslEnabled)}
                                    disabled={creating}
                                >
                                    <FontAwesomeIcon icon={faLock} />
                                    <span>{t('reverse_proxies.create.ssl_enabled', 'SSL Enabled')}</span>
                                </button>
                            </div>

                            {availability && availability.valid && availability.available && !availability.dns_matches && (
                                <div className={styles.dnsNotice}>
                                    <div className={styles.dnsNoticeTitle}>{t('reverse_proxies.dns.ready_title', 'Ready to create')}</div>
                                    <div className={styles.dnsNoticeText}>
                                        {t('reverse_proxies.dns.not_pointing', 'This domain does not point at the selected allocation yet.')}
                                    </div>
                                    <div className={styles.dnsNoticeText}>
                                        {t('reverse_proxies.dns.after_create_prefix', 'After creating the proxy, add an A record for')} <strong>{availability.domain}</strong> {t('reverse_proxies.dns.pointing_to', 'pointing to')}{' '}
                                        <strong>
                                            <PrivacyServerHostBlur>{availability.expected_ip}</PrivacyServerHostBlur>
                                        </strong>
                                        , {t('reverse_proxies.dns.after_create_suffix', 'then confirm it from the proxy card.')}
                                    </div>
                                    <div className={styles.dnsNoticeText}>
                                        {t('reverse_proxies.dns.current_records', 'Current A records:')}{' '}
                                        {availability.resolved_ips.length > 0 ? (
                                            <PrivacyServerHostBlur>{availability.resolved_ips.join(', ')}</PrivacyServerHostBlur>
                                        ) : (
                                            t('reverse_proxies.dns.none_detected', 'none detected yet')
                                        )}
                                    </div>
                                </div>
                            )}

                            {availability && availability.valid && availability.available && availability.dns_matches && (
                                <div className={styles.successMessage}>
                                    <FontAwesomeIcon icon={faCheck} />
                                    {t('reverse_proxies.dns.already_pointing_prefix', 'DNS is already pointing to')}{' '}
                                    <PrivacyServerHostBlur>{availability.expected_ip}</PrivacyServerHostBlur>. {t('reverse_proxies.dns.already_pointing_suffix', 'Create the proxy, then confirm it to start provisioning.')}
                                </div>
                            )}

                            <button
                                type="submit"
                                className={styles.createButton}
                                disabled={
                                    creating ||
                                    !newDomain.trim() ||
                                    !selectedAllocation ||
                                    !availability?.valid ||
                                    !availability.available
                                }
                            >
                                <FontAwesomeIcon icon={creating ? faSpinner : faPlus} spin={creating} />
                                {creating ? t('reverse_proxies.create.creating', 'Creating...') : t('reverse_proxies.create.submit', 'Create Pending Proxy')}
                            </button>
                        </form>
                    </div>
                )}

                {proxies.length === 0 ? (
                    <div className={styles.emptyState}>
                        <h3 className={styles.emptyTitle}>{t('reverse_proxies.empty.title', 'No Reverse Proxies Yet')}</h3>
                        <p className={styles.emptyText}>
                            {t('reverse_proxies.empty.message', 'Create your first reverse proxy to get started.')}
                        </p>
                    </div>
                ) : (
                    <div className={styles.proxiesList}>
                        {proxies.map((proxy) => (
                            <div key={proxy.id} className={styles.proxyCard}>
                                <div className={styles.proxyInfo}>
                                    <div className={styles.proxyDomain}>
                                        <FontAwesomeIcon icon={faNetworkWired} />
                                        {proxy.domain}
                                        {proxy.ssl_enabled && <FontAwesomeIcon icon={faLock} />}
                                    </div>
                                    <div className={styles.proxyMeta}>
                                        <span className={styles.metaItem}>
                                            <FontAwesomeIcon icon={faServer} />
                                            {proxy.allocation?.alias ? (
                                                `${proxy.allocation.alias}:${proxy.allocation.port}`
                                            ) : proxy.allocation ? (
                                                <PrivacyServerHostBlur>
                                                    {proxy.allocation.ip}:{proxy.allocation.port}
                                                </PrivacyServerHostBlur>
                                            ) : null}
                                        </span>
                                        <span className={styles.metaItem}>
                                            <FontAwesomeIcon icon={faClock} />
                                            {t('reverse_proxies.created_at', 'Created {{date}}', { date: formatDate(proxy.created_at) })}
                                        </span>
                                        <span className={`${styles.statusBadge} ${getStatusBadgeClass(proxy.status)}`}>
                                            {getStatusLabel(proxy)}
                                        </span>
                                    </div>
                                    {!proxy.dns_verified && proxy.status !== 'deleting' && (
                                        <div className={styles.dnsNotice}>
                                            <div className={styles.dnsNoticeTitle}>{t('reverse_proxies.dns.add_then_confirm', 'Add DNS, then confirm')}</div>
                                            <div className={styles.dnsNoticeText}>
                                                {t('reverse_proxies.dns.add_record_prefix', 'Add an A record for')} <strong>{proxy.domain}</strong> {t('reverse_proxies.dns.pointing_to', 'pointing to')}{' '}
                                                <strong>
                                                    <PrivacyServerHostBlur>{proxy.expected_dns_ip}</PrivacyServerHostBlur>
                                                </strong>
                                                .
                                            </div>
                                            <div className={styles.dnsNoticeText}>
                                                {t('reverse_proxies.dns.propagated', 'Once the DNS change has propagated, click confirm and the reverse proxy will be configured for this allocation.')}
                                            </div>
                                            <div className={styles.noticeActions}>
                                                <button
                                                    className={`${styles.confirmButton} ${styles.primaryAction}`}
                                                    onClick={() => handleConfirmDns(proxy)}
                                                    disabled={confirmingId === proxy.id}
                                                >
                                                    <FontAwesomeIcon icon={confirmingId === proxy.id ? faSpinner : faNetworkWired} spin={confirmingId === proxy.id} />
                                                    {confirmingId === proxy.id ? t('reverse_proxies.actions.checking_dns', 'Checking DNS...') : t('reverse_proxies.actions.confirm_added', "It's added, confirm")}
                                                </button>
                                                <button
                                                    className={styles.removeButton}
                                                    onClick={() => setDeleteModal(proxy)}
                                                    disabled={deletingId === proxy.id}
                                                >
                                                    <FontAwesomeIcon icon={faTrash} />
                                                    {t('reverse_proxies.actions.remove', 'Remove')}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {proxy.error_message && (
                                        <div className={styles.errorState}>
                                            <FontAwesomeIcon icon={faExclamationCircle} />
                                            {proxy.error_message}
                                        </div>
                                    )}
                                </div>
                                <div className={styles.proxyActions}>
                                    {proxy.dns_verified && proxy.status === 'failed' && (
                                        <div className={styles.noticeActions}>
                                            <button
                                                className={`${styles.confirmButton} ${styles.primaryAction}`}
                                                onClick={() => handleConfirmDns(proxy)}
                                                disabled={confirmingId === proxy.id}
                                            >
                                                <FontAwesomeIcon icon={confirmingId === proxy.id ? faSpinner : faNetworkWired} spin={confirmingId === proxy.id} />
                                                {confirmingId === proxy.id ? t('reverse_proxies.actions.retrying', 'Retrying...') : t('reverse_proxies.actions.retry_setup', 'Retry setup')}
                                            </button>
                                            <button
                                                className={styles.removeButton}
                                                onClick={() => setDeleteModal(proxy)}
                                                disabled={deletingId === proxy.id}
                                            >
                                                <FontAwesomeIcon icon={faTrash} />
                                                {t('reverse_proxies.actions.remove', 'Remove')}
                                            </button>
                                        </div>
                                    )}
                                    {!(!proxy.dns_verified && proxy.status !== 'deleting') && !(proxy.dns_verified && proxy.status === 'failed') && (
                                        <button
                                            className={styles.removeButton}
                                            onClick={() => setDeleteModal(proxy)}
                                            disabled={deletingId === proxy.id || proxy.status === 'deleting'}
                                        >
                                            <FontAwesomeIcon icon={deletingId === proxy.id ? faSpinner : faTrash} spin={deletingId === proxy.id} />
                                            {deletingId === proxy.id ? t('reverse_proxies.actions.removing', 'Removing...') : t('reverse_proxies.actions.remove', 'Remove')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {deleteModal && (
                    <div className={styles.modalOverlay} onClick={() => setDeleteModal(null)}>
                        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                            <div className={styles.modalHeader}>
                                <h3 className={styles.modalTitle}>{t('reverse_proxies.delete.title', 'Delete Reverse Proxy')}</h3>
                                <button className={styles.modalClose} onClick={() => setDeleteModal(null)}>
                                    <FontAwesomeIcon icon={faTimes} />
                                </button>
                            </div>
                            <div className={styles.modalBody}>
                                <p>{t('reverse_proxies.delete.confirm', 'Are you sure you want to delete {{domain}}?', { domain: deleteModal.domain })}</p>
                                <p className={styles.modalWarning}>{t('reverse_proxies.delete.warning', 'This action cannot be undone. The proxy configuration will be removed, but the user-managed DNS record will be left in place.')}</p>
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

export default ReverseProxiesContainer;
