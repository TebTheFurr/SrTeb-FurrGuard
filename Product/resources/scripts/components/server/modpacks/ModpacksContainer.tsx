import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCubes,
    faChevronLeft,
    faChevronRight,
    faAngleDoubleLeft,
    faAngleDoubleRight,
    faSyncAlt,
    faHistory,
    faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import FlashMessageRender from '@/components/FlashMessageRender';
import Spinner from '@/components/elements/Spinner';
import Input from '@/components/elements/Input';
import Select from '@/components/elements/Select';
import ModpackCard from './ModpackCard';
import ModpackDetailsModal from './ModpackDetailsModal';
import InstallModpackModal from './InstallModpackModal';
import {
    searchModpacks,
    getModpackInstallerStatus,
    getModpackCompatibility,
    getModpackVersions,
    getMinecraftVersions,
    MODPACK_METADATA_FILE,
    MODPACK_LOADERS,
    MODPACK_PLATFORMS,
} from '@/api/server/modpacks';
import { ServerContext } from '@/state/server';
import { useStoreState } from '@/state/hooks';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';
import styles from './modpacks.module.css';
import getFileContents from '@/api/server/files/getFileContents';

const STORAGE_KEY = 'pterodactyl_modpack_filters';

const getStoredFilters = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {}
    return {};
};

const ModpacksContainer = () => {
    const { t } = useTranslation('server');
    const server = ServerContext.useStoreState((state) => state.server.data);
    const uuid = ServerContext.useStoreState((state) => state.server.data.uuid);
    const addonSettings = useStoreState((state) => state.settings.data?.addons?.minecraftModpackInstaller);
    const compatibility = useMemo(() => getModpackCompatibility(server), [server]);
    const gridColumns = addonSettings?.gridColumns || 3;
    const enabledPlatforms = useMemo(() => {
        const platforms = addonSettings?.platforms || { modrinth: true, curseforge: true };
        return MODPACK_PLATFORMS.filter((platform) => {
            const enabled = platforms[platform.value as keyof typeof platforms];
            if (!enabled) {
                return false;
            }

            if (platform.value === 'curseforge') {
                return addonSettings?.curseforgeEnabled ?? true;
            }

            return true;
        });
    }, [addonSettings?.curseforgeEnabled, addonSettings?.platforms]);
    const { clearFlashes, addError } = useFlash();
    const [loading, setLoading] = useState(false);
    const installing: string | null = null;
    const [modpacks, setModpacks] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const pageSize = 18;

    const [isInstalled, setIsInstalled] = useState(null);
    const [checkingStatus, setCheckingStatus] = useState(true);
    const [installedModpack, setInstalledModpack] = useState(null);
    const [installedVersions, setInstalledVersions] = useState([]);
    const [checkingInstalledModpack, setCheckingInstalledModpack] = useState(true);

    const [minecraftVersions, setMinecraftVersions] = useState([]);
    const [loadingVersions, setLoadingVersions] = useState(true);

    const storedFilters = getStoredFilters();
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [selectedPlatform, setSelectedPlatform] = useState(storedFilters.platform ?? 'modrinth');
    const [selectedVersion, setSelectedVersion] = useState(storedFilters.version ?? compatibility.gameVersion ?? '');
    const [selectedLoader, setSelectedLoader] = useState(storedFilters.loader ?? compatibility.loader ?? '');

    const [detailsModpack, setDetailsModpack] = useState(null);
    const [detailsVisible, setDetailsVisible] = useState(false);

    const [installModpack, setInstallModpack] = useState(null);
    const [installVisible, setInstallVisible] = useState(false);
    const [installMode, setInstallMode] = useState<'install' | 'update' | 'downgrade' | 'reinstall'>('install');
    const [preselectedVersionId, setPreselectedVersionId] = useState<string | null>(null);

    const [pageInput, setPageInput] = useState('');

    useEffect(() => {
        setCheckingStatus(true);
        getModpackInstallerStatus(uuid)
            .then((status) => {
                setIsInstalled(status.installed);
                setCheckingStatus(false);
            })
            .catch(() => {
                setIsInstalled(false);
                setCheckingStatus(false);
            });

        setLoadingVersions(true);
        getMinecraftVersions(uuid)
            .then((versions) => {
                setMinecraftVersions(versions);
            })
            .catch((error) => {
                console.error('Failed to fetch Minecraft versions:', error);
                setMinecraftVersions([]);
            })
            .finally(() => {
                setLoadingVersions(false);
            });
    }, [uuid]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery);
            setPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        if (enabledPlatforms.length === 0) {
            return;
        }

        if (!enabledPlatforms.some((platform) => platform.value === selectedPlatform)) {
            setSelectedPlatform(enabledPlatforms[0].value);
        }
    }, [enabledPlatforms, selectedPlatform]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            platform: selectedPlatform,
            version: selectedVersion,
            loader: selectedLoader,
        }));
    }, [selectedPlatform, selectedVersion, selectedLoader]);

    const fetchModpacks = useCallback(async () => {
        setLoading(true);
        clearFlashes('modpacks');

        try {
            const result = await searchModpacks(uuid, {
                query: debouncedQuery,
                platforms: [selectedPlatform],
                gameVersion: selectedVersion || undefined,
                loader: selectedLoader || undefined,
                page,
                pageSize,
            });
            if (result.error) {
                setModpacks([]);
                setTotalCount(0);
                addError({ key: 'modpacks', message: result.error });
                return;
            }

            setModpacks(result.modpacks);
            setTotalCount(result.totalCount);
        } catch (error) {
            console.error('Failed to search modpacks:', error);
            addError({ key: 'modpacks', message: httpErrorToHuman(error) });
        } finally {
            setLoading(false);
        }
    }, [uuid, debouncedQuery, selectedPlatform, selectedVersion, selectedLoader, page, addError, clearFlashes]);

    useEffect(() => {
        if (isInstalled && compatibility.shouldShow) {
            fetchModpacks();
        }
    }, [fetchModpacks, isInstalled, compatibility.shouldShow]);

    useEffect(() => {
        if (!isInstalled || !compatibility.shouldShow) {
            setInstalledModpack(null);
            setInstalledVersions([]);
            setCheckingInstalledModpack(false);
            return;
        }

        setCheckingInstalledModpack(true);
        getFileContents(uuid, MODPACK_METADATA_FILE)
            .then((raw) => {
                const parsed = JSON.parse(raw);
                if (parsed?.platform && parsed?.modpackId && parsed?.versionId) {
                    setInstalledModpack(parsed);
                } else {
                    setInstalledModpack(null);
                }
                setCheckingInstalledModpack(false);
            })
            .catch(() => {
                setInstalledModpack(null);
                setCheckingInstalledModpack(false);
            });
    }, [uuid, isInstalled, compatibility.shouldShow]);

    useEffect(() => {
        if (!installedModpack) {
            setInstalledVersions([]);
            return;
        }

        getModpackVersions(
            uuid,
            installedModpack.platform,
            installedModpack.modpackId,
            installedModpack.gameVersion || undefined,
            installedModpack.loader || undefined
        )
            .then((versions) => setInstalledVersions(versions))
            .catch(() => setInstalledVersions([]));
    }, [uuid, installedModpack]);

    const sortedInstalledVersions = useMemo(() => {
        return [...installedVersions].sort((a, b) => {
            const aTime = a?.releaseDate ? new Date(a.releaseDate).getTime() : 0;
            const bTime = b?.releaseDate ? new Date(b.releaseDate).getTime() : 0;
            if (aTime !== bTime) {
                return bTime - aTime;
            }

            return (b?.downloads || 0) - (a?.downloads || 0);
        });
    }, [installedVersions]);

    const latestInstalledVersion = sortedInstalledVersions[0] || null;
    const hasInstalledUpdate = installedModpack && latestInstalledVersion && latestInstalledVersion.id !== installedModpack.versionId;
    const hasInstalledDowngrade = sortedInstalledVersions.length > 1;

    const openInstallFlow = useCallback((modpack, mode: 'install' | 'update' | 'downgrade' | 'reinstall' = 'install', versionId: string | null = null) => {
        setInstallMode(mode);
        setPreselectedVersionId(versionId);
        setInstallModpack(modpack);
        setInstallVisible(true);
    }, []);

    const handleInstall = (modpack) => {
        openInstallFlow(modpack, 'install');
    };

    const handleDetails = (modpack) => {
        setDetailsModpack(modpack);
        setDetailsVisible(true);
    };

    const handleInstalledAction = (mode: 'update' | 'downgrade' | 'reinstall') => {
        if (!installedModpack) {
            return;
        }

        openInstallFlow({
            id: installedModpack.modpackId,
            platform: installedModpack.platform,
            name: installedModpack.modpackName,
            iconUrl: installedModpack.iconUrl || null,
            externalUrl: installedModpack.externalUrl || '',
            author: '',
            description: '',
        }, mode, mode === 'reinstall' ? installedModpack.versionId : null);
    };

    const handlePageInputSubmit = (e) => {
        e.preventDefault();
        const pageNum = parseInt(pageInput, 10);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
            setPage(pageNum);
        }
        setPageInput('');
    };

    const totalPages = Math.ceil(totalCount / pageSize);

    if (checkingStatus) {
        return (
            <ServerContentBlock title={t('modpacks.title', 'Modpacks')}>
                <div className={styles.loadingContainer}>
                    <Spinner size="large" />
                </div>
            </ServerContentBlock>
        );
    }

    if (!isInstalled) {
        return (
            <ServerContentBlock title={t('modpacks.title', 'Modpacks')}>
                <div className={styles.notInstalledContainer}>
                    <h2 className={styles.notInstalledTitle}>{t('modpacks.not_installed.title', 'Feature Not Available')}</h2>
                    <p className={styles.notInstalledMessage}>
                        {t('modpacks.not_installed.message', 'This addon is not installed.')}
                    </p>
                </div>
            </ServerContentBlock>
        );
    }

    if (!compatibility.shouldShow) {
        return null;
    }

    return (
        <ServerContentBlock title={t('modpacks.title', 'Modpacks')}>
            <FlashMessageRender byKey="modpacks" className="mb-4" />

            {!checkingInstalledModpack && installedModpack && (
                <div className={styles.installedBanner}>
                    <div className={styles.installedBannerBody}>
                        <div className={styles.installedBannerIcon}>
                            {installedModpack.iconUrl ? (
                                <img src={installedModpack.iconUrl} alt={installedModpack.modpackName} className={styles.installedBannerImage} />
                            ) : (
                                <FontAwesomeIcon icon={faCubes} />
                            )}
                        </div>
                        <div className={styles.installedBannerText}>
                            <strong>{installedModpack.modpackName}</strong>
                            <span>
                                {t('modpacks.installed_version', 'Installed version {{version}}', { version: installedModpack.versionName })}
                                {hasInstalledUpdate && latestInstalledVersion ? ` • ${t('modpacks.update_available', 'Latest {{version}} is available', { version: latestInstalledVersion.name })}` : ''}
                            </span>
                        </div>
                    </div>
                    <div className={styles.installedBannerActions}>
                        {hasInstalledUpdate && (
                            <button className={styles.bannerButton} onClick={() => handleInstalledAction('update')}>
                                <FontAwesomeIcon icon={faSyncAlt} />
                                {t('modpacks.actions.update', 'Update')}
                            </button>
                        )}
                        <button
                            className={styles.bannerButton}
                            onClick={() => handleInstalledAction('downgrade')}
                            disabled={!hasInstalledDowngrade}
                        >
                            <FontAwesomeIcon icon={faHistory} />
                            {t('modpacks.actions.downgrade', 'Downgrade')}
                        </button>
                        <button className={`${styles.bannerButton} ${styles.bannerButtonPrimary}`} onClick={() => handleInstalledAction('reinstall')}>
                            <FontAwesomeIcon icon={faExclamationTriangle} />
                            {t('modpacks.actions.reinstall', 'Reinstall')}
                        </button>
                    </div>
                </div>
            )}

            <div className={styles.filtersContainer}>
                <div className={styles.filterGroup}>
                    <span className={styles.filterLabel}>{t('modpacks.filters.platform', 'Platform')}</span>
                    <Select
                        value={selectedPlatform}
                        onChange={(e) => {
                            setSelectedPlatform(e.target.value);
                            setPage(1);
                        }}
                    >
                        {enabledPlatforms.map((platform) => (
                            <option key={platform.value} value={platform.value}>
                                {platform.label}
                            </option>
                        ))}
                    </Select>
                </div>

                <div className={styles.filterGroup}>
                    <span className={styles.filterLabel}>{t('modpacks.filters.minecraft_version', 'Minecraft Version')}</span>
                    <Select
                        value={selectedVersion}
                        onChange={(e) => {
                            setSelectedVersion(e.target.value);
                            setPage(1);
                        }}
                    >
                        <option value="">{t('modpacks.filters.all_versions', 'All Versions')}</option>
                        {minecraftVersions.map((version) => (
                            <option key={version} value={version}>
                                {version}
                            </option>
                        ))}
                    </Select>
                </div>

                <div className={styles.filterGroup}>
                    <span className={styles.filterLabel}>{t('modpacks.filters.loader', 'Loader')}</span>
                    <Select
                        value={selectedLoader}
                        onChange={(e) => {
                            setSelectedLoader(e.target.value);
                            setPage(1);
                        }}
                    >
                        <option value="">{t('modpacks.filters.all_loaders', 'All Loaders')}</option>
                        {MODPACK_LOADERS.map((loader) => (
                            <option key={loader.value} value={loader.value}>
                                {loader.label}
                            </option>
                        ))}
                    </Select>
                </div>

                <div className={`${styles.filterGroup} ${styles.searchGroup}`}>
                    <span className={styles.filterLabel}>{t('modpacks.filters.search', 'Search')}</span>
                    <div style={{ position: 'relative' }}>
                        <Input
                            type="text"
                            placeholder={t('modpacks.filters.search_placeholder', 'Search modpacks...')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={styles.searchInput}
                        />
                    </div>
                </div>
            </div>

            {loading ? (
                <div className={styles.loadingContainer}>
                    <Spinner size="large" />
                </div>
            ) : modpacks.length === 0 ? (
                <div className={styles.emptyState}>
                    <FontAwesomeIcon icon={faCubes} />
                    <h3 className={styles.emptyStateTitle}>{t('modpacks.empty.title', 'No modpacks found')}</h3>
                    <p className={styles.emptyStateMessage}>
                        {t('modpacks.empty.message', 'Try adjusting your search filters or search term.')}
                    </p>
                </div>
            ) : (
                <>
                    <div className={styles.modpackGrid} style={{ '--grid-columns': gridColumns } as React.CSSProperties}>
                        {modpacks.map((modpack) => (
                            <ModpackCard
                                key={`${modpack.platform}-${modpack.id}`}
                                modpack={modpack}
                                onInstall={handleInstall}
                                onDetails={handleDetails}
                                isInstalling={installing === `${modpack.platform}-${modpack.id}`}
                            />
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className={styles.pagination}>
                            <div className={styles.paginationNav}>
                                <button
                                    className={styles.pageButton}
                                    onClick={() => setPage(1)}
                                    disabled={page === 1}
                                    title={t('modpacks.pagination.first_page', 'First page')}
                                >
                                    <FontAwesomeIcon icon={faAngleDoubleLeft} />
                                </button>
                                <button
                                    className={styles.pageButton}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                >
                                    <FontAwesomeIcon icon={faChevronLeft} />
                                    {t('modpacks.pagination.previous', 'Previous')}
                                </button>
                            </div>
                            <div className={styles.pageCenter}>
                                <span className={styles.pageInfo}>
                                    {t('modpacks.pagination.page_info', 'Page {{page}} of {{total}}', { page, total: totalPages })}
                                </span>
                                <form onSubmit={handlePageInputSubmit} className={styles.pageInputForm}>
                                    <input
                                        type="number"
                                        min={1}
                                        max={totalPages}
                                        value={pageInput}
                                        onChange={(e) => setPageInput(e.target.value)}
                                        placeholder="#"
                                        className={styles.pageInput}
                                    />
                                    <button type="submit" className={styles.pageGoButton}>{t('modpacks.pagination.go', 'Go')}</button>
                                </form>
                            </div>
                            <div className={styles.paginationNav}>
                                <button
                                    className={styles.pageButton}
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages}
                                >
                                    {t('modpacks.pagination.next', 'Next')}
                                    <FontAwesomeIcon icon={faChevronRight} />
                                </button>
                                <button
                                    className={styles.pageButton}
                                    onClick={() => setPage(totalPages)}
                                    disabled={page >= totalPages}
                                    title={t('modpacks.pagination.last_page', 'Last page')}
                                >
                                    <FontAwesomeIcon icon={faAngleDoubleRight} />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            <ModpackDetailsModal
                modpack={detailsModpack}
                visible={detailsVisible}
                onDismissed={() => {
                    setDetailsVisible(false);
                    setDetailsModpack(null);
                }}
                onInstall={handleInstall}
            />

            <InstallModpackModal
                modpack={installModpack}
                visible={installVisible}
                initialMode={installMode}
                preselectedVersionId={preselectedVersionId}
                compatibility={compatibility}
                preferredGameVersion={selectedVersion || null}
                preferredLoader={selectedLoader || null}
                installedMetadata={installedModpack}
                onInstalled={(metadata) => setInstalledModpack(metadata)}
                onDismissed={() => {
                    setInstallVisible(false);
                    setInstallModpack(null);
                    setInstallMode('install');
                    setPreselectedVersionId(null);
                }}
            />
        </ServerContentBlock>
    );
};

export default ModpacksContainer;
