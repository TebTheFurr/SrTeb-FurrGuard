import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCubes,
    faInfoCircle,
    faSyncAlt,
} from '@fortawesome/free-solid-svg-icons';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import FlashMessageRender from '@/components/FlashMessageRender';
import Spinner from '@/components/elements/Spinner';
import { ServerContext } from '@/state/server';
import { useStoreState } from '@/state/hooks';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';
import {
    getMinecraftVersionBuilds,
    getMinecraftVersionCompatibility,
    getMinecraftVersionForks,
    getMinecraftVersionManagerStatus,
    getMinecraftVersionVersions,
    MinecraftBuildSummary,
    MinecraftVersionFork,
    MinecraftVersionSummary,
} from '@/api/server/minecraftVersions';
import MinecraftBuildPickerModal from './MinecraftBuildPickerModal';
import MinecraftVersionCard from './MinecraftVersionCard';
import MinecraftVersionDetailsModal from './MinecraftVersionDetailsModal';
import SwitchMinecraftVersionModal from './SwitchMinecraftVersionModal';
import styles from '../modpacks/modpacks.module.css';

const MinecraftVersionsContainer = () => {
    const { t } = useTranslation('server');
    const server = ServerContext.useStoreState((state) => state.server.data);
    const uuid = ServerContext.useStoreState((state) => state.server.data.uuid);
    const addonSettings = useStoreState((state) => state.settings.data?.addons?.minecraftVersionManager);
    const compatibility = useMemo(() => getMinecraftVersionCompatibility(server), [server]);
    const enabledForks = addonSettings?.platforms;
    const isForkEnabled = (forkId: string) => {
        if (!enabledForks) {
            return true;
        }

        return enabledForks[forkId as keyof typeof enabledForks] ?? true;
    };
    const { clearFlashes, addError } = useFlash();
    const [checkingStatus, setCheckingStatus] = useState(true);
    const [isInstalled, setIsInstalled] = useState(false);
    const [forks, setForks] = useState<MinecraftVersionFork[]>([]);
    const [selectedForkId, setSelectedForkId] = useState<string>('');
    const [versions, setVersions] = useState<MinecraftVersionSummary[]>([]);
    const [selectedVersionId, setSelectedVersionId] = useState<string>('');
    const [builds, setBuilds] = useState<MinecraftBuildSummary[]>([]);
    const [selectedBuildId, setSelectedBuildId] = useState<string>('');
    const [loadingVersions, setLoadingVersions] = useState(false);
    const [loadingBuilds, setLoadingBuilds] = useState(false);
    const [currentSelection, setCurrentSelection] = useState<{
        fork?: string | null;
        minecraftVersion?: string | null;
        buildId?: string | null;
        buildName?: string | null;
    } | null>(null);
    const [buildPickerVisible, setBuildPickerVisible] = useState(false);
    const [detailsVisible, setDetailsVisible] = useState(false);
    const [switchVisible, setSwitchVisible] = useState(false);

    useEffect(() => {
        let active = true;

        setCheckingStatus(true);
        clearFlashes('minecraft-version-manager');

        Promise.all([getMinecraftVersionManagerStatus(uuid), getMinecraftVersionForks(uuid)])
            .then(([status, availableForks]) => {
                if (!active) {
                    return;
                }

                const filteredForks = availableForks.filter((fork) => isForkEnabled(fork.id));
                const detectedFork = filteredForks.find((fork) => fork.id === status.detected?.fork);

                setIsInstalled(status.installed && status.enabled);
                setForks(filteredForks);

                const defaultFork =
                    detectedFork?.id ||
                    filteredForks[0]?.id ||
                    '';

                setCurrentSelection(
                    status.detected?.fork || status.detected?.minecraftVersion || status.detected?.buildId
                        ? {
                              fork: status.detected?.fork,
                              minecraftVersion: status.detected?.minecraftVersion,
                              buildId: status.detected?.buildId || null,
                              buildName: status.detected?.buildId || null,
                          }
                        : null
                );
                setSelectedForkId(defaultFork);
            })
            .catch((error) => {
                if (!active) {
                    return;
                }

                setIsInstalled(false);
                addError({ key: 'minecraft-version-manager', message: httpErrorToHuman(error) });
            })
            .finally(() => {
                if (active) {
                    setCheckingStatus(false);
                }
            });

        return () => {
            active = false;
        };
    }, [uuid, enabledForks]);

    const detectedForkMatch = currentSelection?.fork === selectedForkId;
    const detectedMinecraftVersion = detectedForkMatch ? currentSelection?.minecraftVersion ?? null : null;
    const detectedBuildId = detectedForkMatch ? currentSelection?.buildId ?? null : null;
    const compatibilityFork = compatibility.fork;
    const compatibilityVersion = compatibility.minecraftVersion;

    useEffect(() => {
        let active = true;

        if (!selectedForkId) {
            setVersions([]);
            setSelectedVersionId('');
            setLoadingVersions(false);
            return;
        }

        setLoadingVersions(true);
        getMinecraftVersionVersions(uuid, selectedForkId)
            .then((data) => {
                if (!active) {
                    return;
                }

                setVersions(data);

                const candidates = [
                    detectedMinecraftVersion,
                    compatibilityFork === selectedForkId ? compatibilityVersion : null,
                    data[0]?.id || '',
                ].filter(Boolean) as string[];
                const fallbackVersion = candidates.find((versionId) =>
                    data.some((version) => version.id === versionId)
                ) || data[0]?.id || '';

                setSelectedVersionId(fallbackVersion);
            })
            .catch((error) => {
                if (active) {
                    addError({ key: 'minecraft-version-manager', message: httpErrorToHuman(error) });
                }
            })
            .finally(() => {
                if (active) {
                    setLoadingVersions(false);
                }
            });

        return () => {
            active = false;
        };
    }, [uuid, selectedForkId, detectedMinecraftVersion, compatibilityFork, compatibilityVersion]);

    useEffect(() => {
        let active = true;

        const selectedFork = forks.find((fork) => fork.id === selectedForkId) || null;

        if (!selectedFork || (selectedFork.requiresMinecraftVersion && !selectedVersionId)) {
            setBuilds([]);
            setSelectedBuildId('');
            setLoadingBuilds(false);
            return;
        }

        setLoadingBuilds(true);
        getMinecraftVersionBuilds(uuid, selectedForkId, selectedVersionId || null)
            .then((data) => {
                if (!active) {
                    return;
                }

                setBuilds(data);

                const fallbackBuild = data.some((build) => build.id === detectedBuildId)
                    ? detectedBuildId || ''
                    : data[0]?.id || '';

                setSelectedBuildId(fallbackBuild);
            })
            .catch((error) => {
                if (active) {
                    addError({ key: 'minecraft-version-manager', message: httpErrorToHuman(error) });
                }
            })
            .finally(() => {
                if (active) {
                    setLoadingBuilds(false);
                }
            });

        return () => {
            active = false;
        };
    }, [uuid, selectedForkId, selectedVersionId, forks, detectedBuildId]);

    const selectedFork = forks.find((fork) => fork.id === selectedForkId) || null;
    const selectedVersion = versions.find((version) => version.id === selectedVersionId) || null;
    const selectedBuild = builds.find((build) => build.id === selectedBuildId) || null;
    const detectedForkId = currentSelection?.fork || compatibility.fork || null;
    const detectedFork = forks.find((fork) => fork.id === detectedForkId) || null;

    const pageTitle = t('minecraft_versions.page_title', 'Version Manager');

    if (checkingStatus) {
        return (
            <ServerContentBlock title={pageTitle}>
                <div className={styles.loadingContainer}>
                    <Spinner size="large" />
                </div>
            </ServerContentBlock>
        );
    }

    if (!isInstalled) {
        return (
            <ServerContentBlock title={pageTitle}>
                <div className={styles.notInstalledContainer}>
                    <h2 className={styles.notInstalledTitle}>{t('minecraft_versions.not_installed_title', 'Feature Not Available')}</h2>
                    <p className={styles.notInstalledMessage}>{t('minecraft_versions.not_installed_message', 'This addon is not installed or is currently disabled.')}</p>
                </div>
            </ServerContentBlock>
        );
    }

    if (!compatibility.shouldShow && !currentSelection?.fork && !currentSelection?.minecraftVersion) {
        return (
            <ServerContentBlock title={pageTitle}>
                <div className={styles.emptyState}>
                    <FontAwesomeIcon icon={faCubes} />
                    <h3 className={styles.emptyStateTitle}>{t('minecraft_versions.unsupported_title', 'Unsupported server')}</h3>
                    <p className={styles.emptyStateMessage}>
                        {compatibility.message || t('minecraft_versions.unsupported_message', 'This server does not appear to use a supported Minecraft fork or proxy.')}
                    </p>
                </div>
            </ServerContentBlock>
        );
    }

    return (
        <ServerContentBlock title={pageTitle}>
            <FlashMessageRender byKey="minecraft-version-manager" className="mb-4" />

            {(currentSelection || compatibility.fork || compatibility.minecraftVersion) && (
                <div className={styles.installedBanner}>
                    <div className={styles.installedBannerBody}>
                        <div className={styles.installedBannerIcon}>
                            {detectedFork?.iconUrl ? (
                                <img src={detectedFork.iconUrl} alt={detectedFork.name} className={styles.installedBannerImage} />
                            ) : (
                                <FontAwesomeIcon icon={faSyncAlt} />
                            )}
                        </div>
                        <div className={styles.installedBannerText}>
                            <strong>
                                {detectedFork?.name || currentSelection?.fork || compatibility.fork || t('minecraft_versions.detected_fallback', 'Detected')}{' '}
                                {currentSelection?.minecraftVersion || compatibility.minecraftVersion || ''}
                            </strong>
                            <span>
                                {currentSelection?.buildName || currentSelection?.buildId || t('minecraft_versions.no_detected_build', 'No detected build yet')}
                            </span>
                        </div>
                    </div>
                    <div className={styles.installedBannerActions}>
                        <button className={styles.bannerButton} onClick={() => setDetailsVisible(true)} disabled={!selectedFork}>
                            <FontAwesomeIcon icon={faInfoCircle} />
                            {t('minecraft_versions.banner_details', 'Details')}
                        </button>
                        <button
                            className={`${styles.bannerButton} ${styles.bannerButtonPrimary}`}
                            onClick={() => {
                                const targetForkId = detectedForkId || selectedForkId;
                                if (targetForkId && targetForkId !== selectedForkId) {
                                    setSelectedForkId(targetForkId);
                                    setSelectedVersionId('');
                                    setVersions([]);
                                    setSelectedBuildId('');
                                    setBuilds([]);
                                }
                                setBuildPickerVisible(true);
                            }}
                            disabled={!detectedForkId && !selectedFork}
                        >
                            <FontAwesomeIcon icon={faSyncAlt} />
                            {t('minecraft_versions.banner_switch', 'Switch')}
                        </button>
                    </div>
                </div>
            )}

            <div className={styles.filterGroup} style={{ marginBottom: 12 }}>
                <span className={styles.filterLabel}>{t('minecraft_versions.forks_label', 'Forks')}</span>
            </div>

            <div className={styles.modpackGrid} style={{ '--grid-columns': 3, marginBottom: 16 } as React.CSSProperties}>
                {forks.map((fork) => (
                    <MinecraftVersionCard
                        key={fork.id}
                        fork={fork}
                        current={currentSelection}
                        isSelected={selectedForkId === fork.id}
                        onDetails={(selected) => {
                            setSelectedForkId(selected.id);
                            setDetailsVisible(true);
                        }}
                        onSelect={(selected) => {
                            if (selected.id !== selectedForkId) {
                                setSelectedForkId(selected.id);
                                setSelectedVersionId('');
                                setVersions([]);
                                setSelectedBuildId('');
                                setBuilds([]);
                            }
                            setBuildPickerVisible(true);
                        }}
                    />
                ))}
            </div>

            <MinecraftVersionDetailsModal
                fork={selectedFork}
                version={selectedVersion}
                build={selectedBuild}
                visible={detailsVisible}
                onDismissed={() => setDetailsVisible(false)}
                onSwitch={() => {
                    setDetailsVisible(false);
                    setSwitchVisible(true);
                }}
            />

            <MinecraftBuildPickerModal
                fork={selectedFork}
                versions={versions}
                version={selectedVersion}
                selectedVersionId={selectedVersionId}
                builds={builds}
                selectedBuildId={selectedBuildId}
                loadingVersions={loadingVersions}
                loadingBuilds={loadingBuilds}
                visible={buildPickerVisible}
                onDismissed={() => setBuildPickerVisible(false)}
                onSelectVersion={setSelectedVersionId}
                onSelectBuild={setSelectedBuildId}
                onSwitch={() => {
                    setBuildPickerVisible(false);
                    setSwitchVisible(true);
                }}
            />

            <SwitchMinecraftVersionModal
                fork={selectedFork}
                version={selectedVersion}
                build={selectedBuild}
                visible={switchVisible}
                onDismissed={() => setSwitchVisible(false)}
                onSwitched={(result) => {
                    setCurrentSelection({
                        fork: result.selection.fork || result.detected.fork,
                        minecraftVersion: result.selection.minecraftVersion || result.detected.minecraftVersion,
                        buildId: result.selection.buildId || result.detected.buildId || null,
                        buildName: result.selection.buildName || selectedBuild?.name || result.detected.buildId || null,
                    });
                }}
            />
        </ServerContentBlock>
    );
};

export default MinecraftVersionsContainer;
