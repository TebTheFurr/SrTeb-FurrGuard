import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPuzzlePiece, faChevronLeft, faChevronRight, faAngleDoubleLeft, faAngleDoubleRight, faSearch, faCheckCircle, faTrash } from '@fortawesome/free-solid-svg-icons';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import FlashMessageRender from '@/components/FlashMessageRender';
import Spinner from '@/components/elements/Spinner';
import Input from '@/components/elements/Input';
import Select from '@/components/elements/Select';
import Modal from '@/components/elements/Modal';
import Button from '@/components/elements/Button';
import PluginCard from './PluginCard';
import InstallPluginModal from './InstallPluginModal';
import UninstallConfirmModal from './UninstallConfirmModal';
import {
    searchPlugins,
    getPluginVersions,
    getPluginInstallerStatus,
    getMinecraftVersions,
    Plugin,
    PluginPlatform,
    PluginLoader,
    PluginVersion,
    PLUGIN_LOADERS,
    PLUGIN_PLATFORMS,
} from '@/api/server/plugins';
import pullFile from '@/api/server/files/pullFile';
import loadDirectory, { FileObject } from '@/api/server/files/loadDirectory';
import deleteFiles from '@/api/server/files/deleteFiles';
import createDirectory from '@/api/server/files/createDirectory';
import { ServerContext } from '@/state/server';
import { useStoreState } from '@/state/hooks';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';
import tw from 'twin.macro';
import styles from './plugins.module.css';

const STORAGE_KEY = 'pterodactyl_plugin_filters';

const getStoredFilters = () => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {}
    return {};
};

const PluginsContainer: React.FC = () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const addonSettings = useStoreState((state) => state.settings.data?.addons?.minecraftPluginInstaller);
    const installFolder = addonSettings?.installFolder || '/plugins';
    const gridColumns = addonSettings?.gridColumns || 3;
    const enabledPlatforms = useMemo(() => {
        const platforms = addonSettings?.platforms || { modrinth: true, curseforge: true, hangar: true, spigot: true };
        return PLUGIN_PLATFORMS.filter((p) => platforms[p.value as keyof typeof platforms]);
    }, [addonSettings?.platforms]);
    const { clearFlashes, addFlash, addError } = useFlash();
    const [loading, setLoading] = useState(false);
    const [installing, setInstalling] = useState<string | null>(null);
    const [plugins, setPlugins] = useState<Plugin[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const pageSize = 18;

    const [isInstalled, setIsInstalled] = useState<boolean | null>(null);
    const [checkingStatus, setCheckingStatus] = useState(true);

    const [minecraftVersions, setMinecraftVersions] = useState<string[]>([]);
    const [loadingVersions, setLoadingVersions] = useState(true);

    const storedFilters = getStoredFilters();
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [selectedPlatform, setSelectedPlatform] = useState<PluginPlatform>(storedFilters.platform || 'modrinth');
    const [selectedVersion, setSelectedVersion] = useState<string>(storedFilters.version || '');
    const [selectedLoader, setSelectedLoader] = useState<PluginLoader | ''>(storedFilters.loader || '');

    const [modalPlugin, setModalPlugin] = useState<Plugin | null>(null);
    const [modalVersions, setModalVersions] = useState<PluginVersion[]>([]);
    const [modalVisible, setModalVisible] = useState(false);

    const [installedPlugins, setInstalledPlugins] = useState<FileObject[]>([]);

    const [uninstallPlugin, setUninstallPlugin] = useState<Plugin | null>(null);
    const [uninstallFileName, setUninstallFileName] = useState('');
    const [uninstallModalVisible, setUninstallModalVisible] = useState(false);
    const [isUninstalling, setIsUninstalling] = useState(false);
    const [pageInput, setPageInput] = useState('');
    const [activeTab, setActiveTab] = useState<'search' | 'installed'>('search');
    const [deleteFileName, setDeleteFileName] = useState<string | null>(null);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        setCheckingStatus(true);
        getPluginInstallerStatus(uuid)
            .then((status) => {
                setIsInstalled(status.installed);
            })
            .catch(() => {
                setIsInstalled(false);
            })
            .finally(() => {
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

    const fetchInstalledPlugins = useCallback(async () => {
        try {
            const files = await loadDirectory(uuid, installFolder);
            setInstalledPlugins(files.filter(f => f.isFile && f.name.endsWith('.jar')));
        } catch (error) {
            console.error('Failed to fetch installed plugins:', error);
        }
    }, [uuid, installFolder]);

    useEffect(() => {
        if (isInstalled) {
            fetchInstalledPlugins();
        }
    }, [fetchInstalledPlugins, isInstalled]);

    const matchesPlugin = useCallback((plugin: Plugin, fileName: string): boolean => {
        const normalise = (value: string) => value
            .toLowerCase()
            .replace(/\.jar$/i, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        const compact = (value: string) => normalise(value).replace(/-/g, '');
        const fileNameNormalised = normalise(fileName);
        const fileNameCompact = compact(fileName);
        const candidates = [plugin.name, plugin.id].filter(Boolean);

        return candidates.some((candidate) => {
            const candidateNormalised = normalise(candidate);
            const candidateCompact = compact(candidate);

            if (candidateNormalised === '' || candidateCompact === '') {
                return false;
            }

            if (fileNameNormalised === candidateNormalised) {
                return true;
            }

            if (fileNameCompact === candidateCompact) {
                return true;
            }

            const normalisedSuffix = fileNameNormalised.slice(candidateNormalised.length);
            const compactSuffix = fileNameCompact.slice(candidateCompact.length);
            return (
                fileNameNormalised.startsWith(`${candidateNormalised}-`) &&
                /^-\d/.test(normalisedSuffix)
            ) || (
                fileNameCompact.startsWith(candidateCompact) &&
                /^\d/.test(compactSuffix)
            );
        });
    }, []);

    const isPluginInstalled = useCallback((plugin: Plugin): boolean => {
        return installedPlugins.some(file => matchesPlugin(plugin, file.name));
    }, [installedPlugins, matchesPlugin]);

    const getInstalledFileName = useCallback((plugin: Plugin): string | undefined => {
        const found = installedPlugins.find(file => matchesPlugin(plugin, file.name));
        return found?.name;
    }, [installedPlugins, matchesPlugin]);

    const getMatchingPlugin = useCallback((fileName: string): Plugin | undefined => {
        return plugins.find(plugin => matchesPlugin(plugin, fileName));
    }, [plugins, matchesPlugin]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery);
            setPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            platform: selectedPlatform,
            version: selectedVersion,
            loader: selectedLoader,
        }));
    }, [selectedPlatform, selectedVersion, selectedLoader]);

    const getActivePlatforms = useCallback((): PluginPlatform[] => {
        return [selectedPlatform];
    }, [selectedPlatform]);

    const fetchPlugins = useCallback(async () => {
        const platforms = getActivePlatforms();
        const safeGameVersion = selectedVersion && minecraftVersions.includes(selectedVersion) ? selectedVersion : undefined;

        setLoading(true);
        clearFlashes('plugins');

        try {
            const result = await searchPlugins(uuid, {
                query: debouncedQuery,
                platforms,
                gameVersion: safeGameVersion,
                loader: (selectedLoader as PluginLoader) || undefined,
                page,
                pageSize,
            });

            setPlugins(result.plugins);
            setTotalCount(result.totalCount);
        } catch (error) {
            console.error('Failed to search plugins:', error);
            addError({ key: 'plugins', message: httpErrorToHuman(error) });
        } finally {
            setLoading(false);
        }
    }, [uuid, debouncedQuery, getActivePlatforms, selectedVersion, selectedLoader, page]);

    useEffect(() => {
        if (isInstalled) {
            fetchPlugins();
        }
    }, [fetchPlugins, isInstalled]);

    const handleInstall = async (plugin: Plugin) => {
        const pluginKey = `${plugin.platform}-${plugin.id}`;
        const safeGameVersion = selectedVersion && minecraftVersions.includes(selectedVersion) ? selectedVersion : undefined;
        setInstalling(pluginKey);
        clearFlashes('plugins');

        try {
            const versions = await getPluginVersions(
                uuid,
                plugin.platform,
                plugin.id,
                safeGameVersion,
                (selectedLoader as PluginLoader) || undefined
            );

            if (versions.length === 0) {
                addError({ key: 'plugins', message: 'No compatible versions found for this plugin.' });
                return;
            }

            if (versions.length === 1) {
                const version = versions[0];
                await createDirectory(uuid, '/', installFolder.replace(/^\//, ''));
                await pullFile(uuid, {
                    url: version.downloadUrl,
                    directory: installFolder,
                    filename: version.fileName,
                    foreground: true,
                });
                addFlash({
                    key: 'plugins',
                    type: 'success',
                    message: `Successfully installed ${plugin.name} (${version.name})`,
                });
                fetchInstalledPlugins();
            } else {
                setModalPlugin(plugin);
                setModalVersions(versions);
                setModalVisible(true);
            }
        } catch (error) {
            addError({ key: 'plugins', message: httpErrorToHuman(error) });
        } finally {
            setInstalling(null);
        }
    };

    const handleUninstall = (plugin: Plugin) => {
        const fileName = getInstalledFileName(plugin);
        if (!fileName) {
            addError({ key: 'plugins', message: 'Could not find installed plugin file.' });
            return;
        }

        setUninstallPlugin(plugin);
        setUninstallFileName(fileName);
        setUninstallModalVisible(true);
    };

    const confirmUninstall = async () => {
        if (!uninstallPlugin || !uninstallFileName) return;

        setIsUninstalling(true);
        clearFlashes('plugins');

        try {
            await deleteFiles(uuid, installFolder, [uninstallFileName]);
            addFlash({
                key: 'plugins',
                type: 'success',
                message: `Successfully uninstalled ${uninstallPlugin.name}`,
            });
            fetchInstalledPlugins();
            setUninstallModalVisible(false);
            setUninstallPlugin(null);
            setUninstallFileName('');
        } catch (error) {
            addError({ key: 'plugins', message: httpErrorToHuman(error) });
        } finally {
            setIsUninstalling(false);
        }
    };

    const cancelUninstall = () => {
        setUninstallModalVisible(false);
        setUninstallPlugin(null);
        setUninstallFileName('');
    };

    const handlePageInputSubmit = (e: React.FormEvent) => {
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
            <ServerContentBlock title="Plugins">
                <div className={styles.loadingContainer}>
                    <Spinner size="large" />
                </div>
            </ServerContentBlock>
        );
    }

    if (!isInstalled) {
        return (
            <ServerContentBlock title="Plugins">
                <div className={styles.notInstalledContainer}>
                    <h2 className={styles.notInstalledTitle}>Feature Not Available</h2>
                    <p className={styles.notInstalledMessage}>
                       This addon is not installed. 
                    </p>
                </div>
            </ServerContentBlock>
        );
    }

    const handleDeleteInstalledFile = (fileName: string) => {
        setDeleteFileName(fileName);
        setDeleteModalVisible(true);
    };

    const confirmDeleteFile = async () => {
        if (!deleteFileName) return;

        setIsDeleting(true);
        clearFlashes('plugins');

        try {
            await deleteFiles(uuid, installFolder, [deleteFileName]);
            addFlash({
                key: 'plugins',
                type: 'success',
                message: `Successfully deleted ${deleteFileName}`,
            });
            fetchInstalledPlugins();
            setDeleteModalVisible(false);
            setDeleteFileName(null);
        } catch (error) {
            addError({ key: 'plugins', message: httpErrorToHuman(error) });
        } finally {
            setIsDeleting(false);
        }
    };

    const cancelDeleteFile = () => {
        setDeleteModalVisible(false);
        setDeleteFileName(null);
    };

    return (
        <ServerContentBlock title="Plugins">
            <FlashMessageRender byKey="plugins" css={tw`mb-4`} />

            <div className={styles.tabsContainer}>
                <button
                    className={`${styles.tab} ${activeTab === 'search' ? styles.active : ''}`}
                    onClick={() => setActiveTab('search')}
                >
                    <FontAwesomeIcon icon={faSearch} />
                    Search
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'installed' ? styles.active : ''}`}
                    onClick={() => setActiveTab('installed')}
                >
                    <FontAwesomeIcon icon={faCheckCircle} />
                    Installed
                    <span className={styles.tabCount}>{installedPlugins.length}</span>
                </button>
            </div>

            {activeTab === 'search' ? (
                <>
                    <div className={styles.filtersContainer}>
                        <div className={styles.filterGroup}>
                            <span className={styles.filterLabel}>Platform</span>
                            <Select
                                value={selectedPlatform}
                                onChange={(e) => {
                                    setSelectedPlatform(e.target.value as PluginPlatform);
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
                            <span className={styles.filterLabel}>Minecraft Version</span>
                            <Select
                                value={selectedVersion}
                                onChange={(e) => {
                                    setSelectedVersion(e.target.value);
                                    setPage(1);
                                }}
                            >
                                <option value="">All Versions</option>
                                {minecraftVersions.map((version) => (
                                    <option key={version} value={version}>
                                        {version}
                                    </option>
                                ))}
                            </Select>
                        </div>

                        <div className={styles.filterGroup}>
                            <span className={styles.filterLabel}>Loader</span>
                            <Select
                                value={selectedLoader}
                                onChange={(e) => {
                                    setSelectedLoader(e.target.value as PluginLoader | '');
                                    setPage(1);
                                }}
                            >
                                <option value="">All Loaders</option>
                                {PLUGIN_LOADERS.map((loader) => (
                                    <option key={loader.value} value={loader.value}>
                                        {loader.label}
                                    </option>
                                ))}
                            </Select>
                        </div>

                        <div className={`${styles.filterGroup} ${styles.searchGroup}`}>
                            <span className={styles.filterLabel}>Search</span>
                            <div style={{ position: 'relative' }}>
                                <Input
                                    type="text"
                                    placeholder="Search plugins..."
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
                    ) : plugins.length === 0 ? (
                        <div className={styles.emptyState}>
                            <FontAwesomeIcon icon={faPuzzlePiece} />
                            <h3 className={styles.emptyStateTitle}>No plugins found</h3>
                            <p className={styles.emptyStateMessage}>
                                Try adjusting your search filters or search term.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className={styles.pluginGrid} style={{ '--grid-columns': gridColumns } as React.CSSProperties}>
                                {plugins.map((plugin) => (
                                    <PluginCard
                                        key={`${plugin.platform}-${plugin.id}`}
                                        plugin={plugin}
                                        onInstall={handleInstall}
                                        onUninstall={handleUninstall}
                                        isInstalling={installing === `${plugin.platform}-${plugin.id}`}
                                        isInstalled={isPluginInstalled(plugin)}
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
                                            title="First page"
                                        >
                                            <FontAwesomeIcon icon={faAngleDoubleLeft} />
                                        </button>
                                        <button
                                            className={styles.pageButton}
                                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                                            disabled={page === 1}
                                        >
                                            <FontAwesomeIcon icon={faChevronLeft} />
                                            Previous
                                        </button>
                                    </div>
                                    <div className={styles.pageCenter}>
                                        <span className={styles.pageInfo}>
                                            Page {page} of {totalPages}
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
                                            <button type="submit" className={styles.pageGoButton}>Go</button>
                                        </form>
                                    </div>
                                    <div className={styles.paginationNav}>
                                        <button
                                            className={styles.pageButton}
                                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                            disabled={page >= totalPages}
                                        >
                                            Next
                                            <FontAwesomeIcon icon={faChevronRight} />
                                        </button>
                                        <button
                                            className={styles.pageButton}
                                            onClick={() => setPage(totalPages)}
                                            disabled={page >= totalPages}
                                            title="Last page"
                                        >
                                            <FontAwesomeIcon icon={faAngleDoubleRight} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </>
            ) : (
                <>
                    {installedPlugins.length === 0 ? (
                        <div className={styles.emptyState}>
                            <FontAwesomeIcon icon={faPuzzlePiece} />
                            <h3 className={styles.emptyStateTitle}>No plugins installed</h3>
                            <p className={styles.emptyStateMessage}>
                                Search and install plugins from the Search tab.
                            </p>
                        </div>
                    ) : (
                        <div className={styles.pluginGrid} style={{ '--grid-columns': gridColumns } as React.CSSProperties}>
                            {installedPlugins.map((file) => {
                                const matchedPlugin = getMatchingPlugin(file.name);
                                return (
                                    <div key={file.name} className={styles.pluginCard}>
                                        <div className={styles.pluginHeader}>
                                            {matchedPlugin?.iconUrl ? (
                                                <img
                                                    src={matchedPlugin.iconUrl}
                                                    alt={matchedPlugin.name}
                                                    className={styles.pluginIcon}
                                                />
                                            ) : (
                                                <div className={styles.pluginIconPlaceholder}>
                                                    <FontAwesomeIcon icon={faPuzzlePiece} />
                                                </div>
                                            )}
                                            <div className={styles.pluginInfo}>
                                                <span className={styles.pluginName}>
                                                    {matchedPlugin?.name || file.name.replace('.jar', '')}
                                                </span>
                                                <span className={styles.pluginAuthor}>
                                                    {matchedPlugin ? `by ${matchedPlugin.author}` : file.name}
                                                </span>
                                            </div>
                                        </div>
                                        <p className={styles.pluginDescription}>
                                            {matchedPlugin?.description || 'Installed plugin file'}
                                        </p>
                                        <div className={styles.pluginFooter}>
                                            <div className={styles.pluginMeta}>
                                                <span className={styles.pluginStat}>
                                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                                </span>
                                            </div>
                                            <div className={styles.pluginActions}>
                                                <button
                                                    className={`${styles.actionButton} ${styles.danger}`}
                                                    onClick={() => handleDeleteInstalledFile(file.name)}
                                                >
                                                    <FontAwesomeIcon icon={faTrash} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            <InstallPluginModal
                plugin={modalPlugin}
                versions={modalVersions}
                visible={modalVisible}
                installFolder={installFolder}
                onDismissed={() => {
                    setModalVisible(false);
                    setModalPlugin(null);
                    setModalVersions([]);
                    fetchInstalledPlugins();
                }}
            />

            <UninstallConfirmModal
                plugin={uninstallPlugin}
                fileName={uninstallFileName}
                visible={uninstallModalVisible}
                isUninstalling={isUninstalling}
                onConfirm={confirmUninstall}
                onCancel={cancelUninstall}
            />

            <Modal visible={deleteModalVisible} onDismissed={cancelDeleteFile} showSpinnerOverlay={isDeleting}>
                <div className={styles.uninstallModal}>
                    <h3 className={styles.uninstallTitle}>Delete Plugin?</h3>
                    <p className={styles.uninstallMessage}>
                        This will permanently delete the following file from your plugins folder:
                    </p>
                    <div className={styles.uninstallFileName}>
                        {deleteFileName}
                    </div>
                    <div className={styles.uninstallActions}>
                        <Button isSecondary onClick={cancelDeleteFile} disabled={isDeleting}>
                            Cancel
                        </Button>
                        <Button
                            color="red"
                            onClick={confirmDeleteFile}
                            disabled={isDeleting}
                            isLoading={isDeleting}
                        >
                            <FontAwesomeIcon icon={faTrash} style={{ marginRight: 8 }} />
                            Delete
                        </Button>
                    </div>
                </div>
            </Modal>
        </ServerContentBlock>
    );
};

export default PluginsContainer;
