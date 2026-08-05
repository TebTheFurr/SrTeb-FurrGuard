import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCube, faChevronLeft, faChevronRight, faAngleDoubleLeft, faAngleDoubleRight, faSearch, faCheckCircle, faTrash } from '@fortawesome/free-solid-svg-icons';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import FlashMessageRender from '@/components/FlashMessageRender';
import Spinner from '@/components/elements/Spinner';
import Input from '@/components/elements/Input';
import Select from '@/components/elements/Select';
import Modal from '@/components/elements/Modal';
import Button from '@/components/elements/Button';
import ModCard from './ModCard';
import InstallModModal from './InstallModModal';
import UninstallConfirmModal from './UninstallConfirmModal';
import {
    searchMods,
    getModVersions,
    getModInstallerStatus,
    getGameVersions,
    getModCategories,
    MOD_LOADERS,
    MOD_PLATFORMS,
    CURSEFORGE_LOADERS,
    ModGame,
} from '@/api/server/mods';
import pullFile from '@/api/server/files/pullFile';
import loadDirectory from '@/api/server/files/loadDirectory';
import deleteFiles from '@/api/server/files/deleteFiles';
import createDirectory from '@/api/server/files/createDirectory';
import { ServerContext } from '@/state/server';
import { useStoreState } from '@/state/hooks';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';
import tw from 'twin.macro';
import styles from './mods.module.css';

export type ModsContainerProps = {
    game: ModGame;
};

const GAME_CONFIG = {
    minecraft: {
        title: 'Minecraft Mods',
        versionLabel: 'Minecraft Version',
        showPlatformFilter: true,
        filterMode: 'loader' as const,
        fileExtensions: ['.jar'],
        flashKey: 'minecraft-mods',
    },
    hytale: {
        title: 'Hytale Mods',
        versionLabel: 'Hytale Version',
        showPlatformFilter: false,
        filterMode: 'category' as const,
        fileExtensions: ['.jar', '.zip'],
        flashKey: 'hytale-mods',
    },
};

const getStoredFilters = (storageKey: string) => {
    try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {}
    return {};
};

const isAllowedInstalledFile = (fileName: string, extensions: string[]) => {
    const lower = fileName.toLowerCase();
    return extensions.some((ext) => lower.endsWith(ext));
};

const ModsContainer = ({ game }: ModsContainerProps) => {
    const config = GAME_CONFIG[game];
    const storageKey = `pterodactyl_mod_filters_${game}`;
    const flashKey = config.flashKey;

    const uuid = ServerContext.useStoreState((state) => state.server.data.uuid);
    const addonSettings = useStoreState((state) => state.settings.data?.addons?.minecraftModInstaller);
    const installFolder = game === 'hytale'
        ? (addonSettings?.hytaleInstallFolder || '/mods')
        : (addonSettings?.installFolder || '/mods');
    const gridColumns = addonSettings?.gridColumns || 3;
    const platforms = addonSettings?.platforms || { modrinth: true, curseforge: true };
    const enabledPlatforms = MOD_PLATFORMS.filter((p) => platforms[p.value as keyof typeof platforms]);

    const { clearFlashes, addFlash, addError } = useFlash();
    const [loading, setLoading] = useState(false);
    const [installing, setInstalling] = useState(null);
    const [mods, setMods] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [page, setPage] = useState(1);
    const pageSize = 18;

    const [isInstalled, setIsInstalled] = useState(null);
    const [checkingStatus, setCheckingStatus] = useState(true);

    const [gameVersions, setGameVersions] = useState([]);
    const [loadingVersions, setLoadingVersions] = useState(true);
    const [categories, setCategories] = useState([]);

    const storedFilters = getStoredFilters(storageKey);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [selectedPlatform, setSelectedPlatform] = useState(
        game === 'hytale' ? 'curseforge' : (storedFilters.platform || 'modrinth')
    );
    const [selectedVersion, setSelectedVersion] = useState(storedFilters.version || '');
    const [selectedLoader, setSelectedLoader] = useState(storedFilters.loader || '');
    const [selectedCategory, setSelectedCategory] = useState(storedFilters.category || '');

    const [modalMod, setModalMod] = useState(null);
    const [modalVersions, setModalVersions] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);

    const [installedMods, setInstalledMods] = useState([]);

    const [uninstallMod, setUninstallMod] = useState(null);
    const [uninstallFileName, setUninstallFileName] = useState('');
    const [uninstallModalVisible, setUninstallModalVisible] = useState(false);
    const [isUninstalling, setIsUninstalling] = useState(false);
    const [pageInput, setPageInput] = useState('');
    const [activeTab, setActiveTab] = useState('search');
    const [deleteFileName, setDeleteFileName] = useState(null);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        setCheckingStatus(true);
        getModInstallerStatus(uuid)
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
        getGameVersions(uuid, game)
            .then((versions) => {
                setGameVersions(versions);
            })
            .catch((error) => {
                console.error('Failed to fetch game versions:', error);
                setGameVersions([]);
            })
            .finally(() => {
                setLoadingVersions(false);
            });

        if (game === 'hytale') {
            getModCategories(uuid, 'hytale')
                .then((items) => {
                    setCategories(items);
                })
                .catch(() => {
                    setCategories([]);
                });
        }
    }, [uuid, game]);

    const fetchInstalledMods = async () => {
        try {
            const files = await loadDirectory(uuid, installFolder);
            setInstalledMods(files.filter((f) => f.isFile && isAllowedInstalledFile(f.name, config.fileExtensions)));
        } catch (error) {
            console.error('Failed to fetch installed mods:', error);
        }
    };

    useEffect(() => {
        if (isInstalled) {
            fetchInstalledMods();
        }
    }, [uuid, installFolder, isInstalled, game]);

    const matchesMod = (mod, fileName) => {
        const fileNameLower = fileName.toLowerCase().replace(/\.(jar|zip)$/, '');
        const fileNameClean = fileNameLower.replace(/[^a-z0-9]/g, '');
        const modNameClean = mod.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const modIdClean = mod.id.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (fileNameClean.includes(modNameClean) || modNameClean.includes(fileNameClean)) {
            return true;
        }

        if (fileNameClean.includes(modIdClean) || modIdClean.includes(fileNameClean)) {
            return true;
        }

        const modWords = mod.name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
        const fileWords = fileNameLower.split(/[^a-z0-9]+/).filter((w) => w.length > 2);

        if (modWords.length > 0) {
            const matchedWords = modWords.filter((pw) =>
                fileWords.some((fw) => fw.includes(pw) || pw.includes(fw))
            );
            if (matchedWords.length >= Math.ceil(modWords.length * 0.6)) {
                return true;
            }
        }

        return false;
    };

    const isModInstalled = (mod) => {
        return installedMods.some((file) => matchesMod(mod, file.name));
    };

    const getInstalledFileName = (mod) => {
        const found = installedMods.find((file) => matchesMod(mod, file.name));
        return found?.name;
    };

    const getMatchingMod = (fileName) => {
        return mods.find((mod) => matchesMod(mod, fileName));
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery);
            setPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        localStorage.setItem(storageKey, JSON.stringify({
            platform: selectedPlatform,
            version: selectedVersion,
            loader: selectedLoader,
            category: selectedCategory,
        }));
    }, [storageKey, selectedPlatform, selectedVersion, selectedLoader, selectedCategory]);

    const fetchMods = async () => {
        const platformsForSearch = game === 'hytale' ? ['curseforge'] : [selectedPlatform];
        const safeGameVersion = selectedVersion && gameVersions.includes(selectedVersion) ? selectedVersion : undefined;
        const safeLoader = game === 'minecraft'
            && selectedLoader
            && (selectedPlatform !== 'curseforge' || CURSEFORGE_LOADERS.includes(selectedLoader))
            ? selectedLoader
            : undefined;
        const safeCategory = game === 'hytale' && selectedCategory ? Number(selectedCategory) : undefined;

        setLoading(true);
        clearFlashes(flashKey);

        try {
            const result = await searchMods(uuid, {
                game,
                query: debouncedQuery,
                platforms: platformsForSearch,
                gameVersion: safeGameVersion,
                loader: safeLoader,
                category: safeCategory,
                page,
                pageSize,
            });

            setMods(result.mods);
            setTotalCount(result.totalCount);
        } catch (error) {
            console.error('Failed to search mods:', error);
            addError({ key: flashKey, message: httpErrorToHuman(error) });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isInstalled) {
            fetchMods();
        }
    }, [uuid, game, debouncedQuery, selectedPlatform, selectedVersion, selectedLoader, selectedCategory, page, isInstalled, gameVersions]);

    const handleInstall = async (mod) => {
        const modKey = `${mod.platform}-${mod.id}`;
        const safeGameVersion = selectedVersion && gameVersions.includes(selectedVersion) ? selectedVersion : undefined;
        const safeLoader = game === 'minecraft'
            && selectedLoader
            && (mod.platform !== 'curseforge' || CURSEFORGE_LOADERS.includes(selectedLoader))
            ? selectedLoader
            : undefined;
        setInstalling(modKey);
        clearFlashes(flashKey);

        try {
            const versions = await getModVersions(
                uuid,
                mod.platform,
                mod.id,
                safeGameVersion,
                safeLoader,
                game
            );

            if (versions.length === 0) {
                addError({ key: flashKey, message: 'No compatible versions found for this mod.' });
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
                    key: flashKey,
                    type: 'success',
                    message: `Successfully installed ${mod.name} (${version.name})`,
                });
                fetchInstalledMods();
            } else {
                setModalMod(mod);
                setModalVersions(versions);
                setModalVisible(true);
            }
        } catch (error) {
            addError({ key: flashKey, message: httpErrorToHuman(error) });
        } finally {
            setInstalling(null);
        }
    };

    const handleUninstall = (mod) => {
        const fileName = getInstalledFileName(mod);
        if (!fileName) {
            addError({ key: flashKey, message: 'Could not find installed mod file.' });
            return;
        }

        setUninstallMod(mod);
        setUninstallFileName(fileName);
        setUninstallModalVisible(true);
    };

    const confirmUninstall = async () => {
        if (!uninstallMod || !uninstallFileName) return;

        setIsUninstalling(true);
        clearFlashes(flashKey);

        try {
            await deleteFiles(uuid, installFolder, [uninstallFileName]);
            addFlash({
                key: flashKey,
                type: 'success',
                message: `Successfully uninstalled ${uninstallMod.name}`,
            });
            fetchInstalledMods();
            setUninstallModalVisible(false);
            setUninstallMod(null);
            setUninstallFileName('');
        } catch (error) {
            addError({ key: flashKey, message: httpErrorToHuman(error) });
        } finally {
            setIsUninstalling(false);
        }
    };

    const cancelUninstall = () => {
        setUninstallModalVisible(false);
        setUninstallMod(null);
        setUninstallFileName('');
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
            <ServerContentBlock title={config.title}>
                <div className={styles.loadingContainer}>
                    <Spinner size="large" />
                </div>
            </ServerContentBlock>
        );
    }

    if (!isInstalled) {
        return (
            <ServerContentBlock title={config.title}>
                <div className={styles.notInstalledContainer}>
                    <h2 className={styles.notInstalledTitle}>Feature Not Available</h2>
                    <p className={styles.notInstalledMessage}>
                       This addon is not installed.
                    </p>
                </div>
            </ServerContentBlock>
        );
    }

    const handleDeleteInstalledFile = (fileName) => {
        setDeleteFileName(fileName);
        setDeleteModalVisible(true);
    };

    const confirmDeleteFile = async () => {
        if (!deleteFileName) return;

        setIsDeleting(true);
        clearFlashes(flashKey);

        try {
            await deleteFiles(uuid, installFolder, [deleteFileName]);
            addFlash({
                key: flashKey,
                type: 'success',
                message: `Successfully deleted ${deleteFileName}`,
            });
            fetchInstalledMods();
            setDeleteModalVisible(false);
            setDeleteFileName(null);
        } catch (error) {
            addError({ key: flashKey, message: httpErrorToHuman(error) });
        } finally {
            setIsDeleting(false);
        }
    };

    const cancelDeleteFile = () => {
        setDeleteModalVisible(false);
        setDeleteFileName(null);
    };

    return (
        <ServerContentBlock title={config.title}>
            <FlashMessageRender byKey={flashKey} css={tw`mb-4`} />

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
                    <span className={styles.tabCount}>{installedMods.length}</span>
                </button>
            </div>

            {activeTab === 'search' ? (
                <>
                    <div className={styles.filtersContainer}>
                        {config.showPlatformFilter && (
                            <div className={styles.filterGroup}>
                                <span className={styles.filterLabel}>Platform</span>
                                <Select
                                    value={selectedPlatform}
                                    onChange={(e) => {
                                        const newPlatform = e.target.value;
                                        setSelectedPlatform(newPlatform);
                                        if (newPlatform === 'curseforge' && selectedLoader && !CURSEFORGE_LOADERS.includes(selectedLoader)) {
                                            setSelectedLoader('');
                                        }
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
                        )}

                        <div className={styles.filterGroup}>
                            <span className={styles.filterLabel}>{config.versionLabel}</span>
                            <Select
                                value={selectedVersion}
                                onChange={(e) => {
                                    setSelectedVersion(e.target.value);
                                    setPage(1);
                                }}
                                disabled={loadingVersions}
                            >
                                <option value="">All Versions</option>
                                {gameVersions.map((version) => (
                                    <option key={version} value={version}>
                                        {version}
                                    </option>
                                ))}
                            </Select>
                        </div>

                        {config.filterMode === 'loader' ? (
                            <div className={styles.filterGroup}>
                                <span className={styles.filterLabel}>Loader</span>
                                <Select
                                    value={selectedLoader}
                                    onChange={(e) => {
                                        setSelectedLoader(e.target.value);
                                        setPage(1);
                                    }}
                                >
                                    <option value="">All Loaders</option>
                                    {MOD_LOADERS
                                        .filter((loader) => selectedPlatform !== 'curseforge' || CURSEFORGE_LOADERS.includes(loader.value))
                                        .map((loader) => (
                                            <option key={loader.value} value={loader.value}>
                                                {loader.label}
                                            </option>
                                        ))}
                                </Select>
                            </div>
                        ) : (
                            <div className={styles.filterGroup}>
                                <span className={styles.filterLabel}>Category</span>
                                <Select
                                    value={selectedCategory}
                                    onChange={(e) => {
                                        setSelectedCategory(e.target.value);
                                        setPage(1);
                                    }}
                                >
                                    <option value="">All Categories</option>
                                    {categories.map((category) => (
                                        <option key={category.id} value={String(category.id)}>
                                            {category.name}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                        )}

                        <div className={`${styles.filterGroup} ${styles.searchGroup}`}>
                            <span className={styles.filterLabel}>Search</span>
                            <div style={{ position: 'relative' }}>
                                <Input
                                    type="text"
                                    placeholder="Search mods..."
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
                    ) : mods.length === 0 ? (
                        <div className={styles.emptyState}>
                            <FontAwesomeIcon icon={faCube} />
                            <h3 className={styles.emptyStateTitle}>No mods found</h3>
                            <p className={styles.emptyStateMessage}>
                                Try adjusting your search filters or search term.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className={styles.modGrid} style={{ '--grid-columns': gridColumns } as React.CSSProperties}>
                                {mods.map((mod) => (
                                    <ModCard
                                        key={`${mod.platform}-${mod.id}`}
                                        mod={mod}
                                        onInstall={handleInstall}
                                        onUninstall={handleUninstall}
                                        isInstalling={installing === `${mod.platform}-${mod.id}`}
                                        isInstalled={isModInstalled(mod)}
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
                    {installedMods.length === 0 ? (
                        <div className={styles.emptyState}>
                            <FontAwesomeIcon icon={faCube} />
                            <h3 className={styles.emptyStateTitle}>No mods installed</h3>
                            <p className={styles.emptyStateMessage}>
                                Search and install mods from the Search tab.
                            </p>
                        </div>
                    ) : (
                        <div className={styles.modGrid} style={{ '--grid-columns': gridColumns } as React.CSSProperties}>
                            {installedMods.map((file) => {
                                const matchedMod = getMatchingMod(file.name);
                                return (
                                    <div key={file.name} className={styles.modCard}>
                                        <div className={styles.modHeader}>
                                            {matchedMod?.iconUrl ? (
                                                <img
                                                    src={matchedMod.iconUrl}
                                                    alt={matchedMod.name}
                                                    className={styles.modIcon}
                                                />
                                            ) : (
                                                <div className={styles.modIconPlaceholder}>
                                                    <FontAwesomeIcon icon={faCube} />
                                                </div>
                                            )}
                                            <div className={styles.modInfo}>
                                                <span className={styles.modName}>
                                                    {matchedMod?.name || file.name.replace(/\.(jar|zip)$/i, '')}
                                                </span>
                                                <span className={styles.modAuthor}>
                                                    {matchedMod ? `by ${matchedMod.author}` : file.name}
                                                </span>
                                            </div>
                                        </div>
                                        <p className={styles.modDescription}>
                                            {matchedMod?.description || 'Installed mod file'}
                                        </p>
                                        <div className={styles.modFooter}>
                                            <div className={styles.modMeta}>
                                                <span className={styles.modStat}>
                                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                                </span>
                                            </div>
                                            <div className={styles.modActions}>
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

            <InstallModModal
                mod={modalMod}
                versions={modalVersions}
                visible={modalVisible}
                modsDirectory={installFolder}
                flashKey={flashKey}
                onDismissed={() => {
                    setModalVisible(false);
                    setModalMod(null);
                    setModalVersions([]);
                    fetchInstalledMods();
                }}
            />

            <UninstallConfirmModal
                mod={uninstallMod}
                fileName={uninstallFileName}
                visible={uninstallModalVisible}
                isUninstalling={isUninstalling}
                onConfirm={confirmUninstall}
                onCancel={cancelUninstall}
            />

            <Modal visible={deleteModalVisible} onDismissed={cancelDeleteFile} showSpinnerOverlay={isDeleting}>
                <div className={styles.uninstallModal}>
                    <h3 className={styles.uninstallTitle}>Delete Mod?</h3>
                    <p className={styles.uninstallMessage}>
                        This will permanently delete the following file from your mods folder:
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

export default ModsContainer;
