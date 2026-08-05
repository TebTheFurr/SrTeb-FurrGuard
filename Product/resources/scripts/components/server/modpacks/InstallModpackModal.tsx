import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCubes,
    faDownload,
    faCalendar,
    faCheck,
    faSpinner,
    faTimesCircle,
    faInfoCircle,
    faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';
import Modal from '@/components/elements/Modal';
import Button from '@/components/elements/Button';
import Input from '@/components/elements/Input';
import {
    getModpackVersions,
    switchModpackEgg,
    getModpackJavaCompatibility,
    MODPACK_METADATA_FILE,
} from '@/api/server/modpacks';
import deleteFiles from '@/api/server/files/deleteFiles';
import decompressFiles from '@/api/server/files/decompressFiles';
import saveFileContents from '@/api/server/files/saveFileContents';
import reinstallServer from '@/api/server/reinstallServer';
import { ServerContext } from '@/state/server';
import { useStoreState } from '@/state/hooks';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';
import http from '@/api/http';
import styles from './modpacks.module.css';
import {
    applyExtractedModpackLayout,
    buildInstallStepError,
    cleanupServerFiles,
    downloadArchive,
    ensureEulaAccepted,
    ensureWritablePermissions,
    getLoaderFromVersion,
    installModrinthIndexIfPresent,
    normaliseLoader,
    prepareLoaderRuntime,
    resolveArchiveDownload,
    resolveInstalledLoader,
    waitForServerJar,
    withTimeout,
} from './installModpackHelpers';

const formatLoaderName = (value?: string | null) => {
    if (!value) return 'Mod loader';
    if (value === 'neoforge') return 'NeoForge';

    return value.charAt(0).toUpperCase() + value.slice(1);
};

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const getDefaultInstallOption = (mode) => {
    if (mode === 'update') {
        return 'mods_only';
    }

    if (mode === 'reinstall' || mode === 'downgrade') {
        return 'smart_replace';
    }

    return 'smart_replace';
};

const InstallModpackModal = ({
    modpack,
    visible,
    onDismissed,
    initialMode = 'install',
    preselectedVersionId = null,
    compatibility,
    preferredGameVersion = null,
    preferredLoader = null,
    installedMetadata,
    onInstalled,
}) => {
    const { t } = useTranslation('server');
    const server = ServerContext.useStoreState((state) => state.server.data);
    const uuid = server.uuid;
    const addonSettings = useStoreState((state) => state.settings.data?.addons?.minecraftModpackInstaller);
    const writeEula = useStoreState((state) => state.settings.data?.addons?.minecraftVersionManager?.writeEula ?? true);
    const { addFlash, clearFlashes } = useFlash();

    const [step, setStep] = useState('version');
    const [versions, setVersions] = useState([]);
    const [versionsLoading, setVersionsLoading] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState(null);
    const [versionSearch, setVersionSearch] = useState('');
    const [selectedOption, setSelectedOption] = useState(getDefaultInstallOption(initialMode));

    const [installing, setInstalling] = useState(false);
    const [currentProgressStep, setCurrentProgressStep] = useState(null);
    const [completedSteps, setCompletedSteps] = useState<string[]>([]);
    const [detectedLoader, setDetectedLoader] = useState(null);
    const [loaderMessage, setLoaderMessage] = useState(null);
    const [installComplete, setInstallComplete] = useState(false);
    const [installError, setInstallError] = useState(null);
    const [javaCheck, setJavaCheck] = useState<any>(null);

    const INSTALL_OPTIONS = useMemo(() => [
        {
            id: 'full_wipe',
            title: t('modpacks.install.options.full_wipe.title', 'Full Server Wipe'),
            description: t('modpacks.install.options.full_wipe.description', 'Deletes ALL files and reinstalls with the modpack. This gives you a completely clean server.'),
            warning: t('modpacks.install.options.full_wipe.warning', 'This will delete your worlds, configs, and everything else.'),
        },
        {
            id: 'smart_replace',
            title: t('modpacks.install.options.smart_replace.title', 'Smart Replace'),
            description: t('modpacks.install.options.smart_replace.description', 'Replaces everything except your worlds and core server configs (server.properties, whitelist, ops, bans, eula).'),
            warning: null,
        },
        {
            id: 'mods_only',
            title: t('modpacks.install.options.mods_only.title', 'Mods & Configs Only'),
            description: t('modpacks.install.options.mods_only.description', 'Only replaces modpack folders (mods, config, kubejs, defaultconfigs, scripts). Keeps everything else untouched.'),
            warning: null,
        },
    ], [t]);

    const PROGRESS_STEPS = useMemo(() => [
        { id: 'stop', label: t('modpacks.install.steps.stop', 'Stopping server') },
        { id: 'cleanup', label: t('modpacks.install.steps.cleanup', 'Cleaning up files') },
        { id: 'download', label: t('modpacks.install.steps.download', 'Downloading modpack') },
        { id: 'extract', label: t('modpacks.install.steps.extract', 'Extracting files') },
        { id: 'overrides', label: t('modpacks.install.steps.overrides', 'Applying overrides') },
        { id: 'index', label: t('modpacks.install.steps.index', 'Downloading modpack files') },
        { id: 'egg', label: t('modpacks.install.steps.egg', 'Configuring server egg') },
        { id: 'loader', label: t('modpacks.install.steps.loader', 'Setting up mod loader') },
        { id: 'start', label: t('modpacks.install.steps.start', 'Starting server') },
    ], [t]);

    const filteredVersions = useMemo(() => {
        if (!versionSearch.trim()) return versions;
        const query = versionSearch.toLowerCase();
        return versions.filter(
            (v) =>
                v.name.toLowerCase().includes(query) ||
                v.gameVersions.some((gv) => gv.toLowerCase().includes(query))
        );
    }, [versions, versionSearch]);

    useEffect(() => {
        if (!visible || !modpack) {
            setStep('version');
            setVersions([]);
            setSelectedVersion(null);
            setVersionSearch('');
            setSelectedOption(getDefaultInstallOption(initialMode));
            setInstalling(false);
            setCurrentProgressStep(null);
            setCompletedSteps([]);
            setDetectedLoader(null);
            setLoaderMessage(null);
            setInstallComplete(false);
            setInstallError(null);
            return;
        }

        setVersionsLoading(true);

        (async () => {
            let data = [];
            const requestedGameVersion = preferredGameVersion || undefined;
            const requestedLoader = normaliseLoader(preferredLoader || undefined) || undefined;
            try {
                data = await getModpackVersions(
                    uuid,
                    modpack.platform,
                    modpack.id,
                    requestedGameVersion,
                    requestedLoader
                );
            } catch (error) {
                data = [];
            }

            if (data.length === 0) {
                try {
                    data = await getModpackVersions(uuid, modpack.platform, modpack.id);
                } catch (error) {
                    data = [];
                }
            }

            if (modpack.platform === 'curseforge') {
                data = data.filter((version) => version?.isServerPack);
            }

            setVersions(data);
            if (data.length > 0) {
                const downgradeCandidate = initialMode === 'downgrade'
                    ? data.find((version) => version.id !== installedMetadata?.versionId)
                    : null;
                const preferredVersion = data.find((version) => version.id === preselectedVersionId)
                    || downgradeCandidate
                    || (initialMode === 'reinstall'
                        ? data.find((version) => version.id === installedMetadata?.versionId)
                        : null)
                    || data[0];
                setSelectedVersion(preferredVersion);
                setStep(data.length === 1 ? 'options' : 'version');
            } else {
                setSelectedVersion(null);
                setStep('version');
            }

            setVersionsLoading(false);
        })();
    }, [
        visible,
        modpack,
        uuid,
        preferredGameVersion,
        preferredLoader,
        initialMode,
        preselectedVersionId,
    ]);

    useEffect(() => {
        if (!visible || !selectedVersion || step !== 'options') {
            return;
        }

        const mcVersion = selectedVersion.gameVersions?.[0] || preferredGameVersion || '';
        const versionLoader = getLoaderFromVersion(selectedVersion);
        const loaderType = versionLoader.type || normaliseLoader(preferredLoader || null);
        const loaderEggMap = addonSettings?.loaderEggMap || {};
        const autoSwitchEgg = addonSettings?.autoSwitchEgg !== false;
        const targetEggId = loaderType ? loaderEggMap[loaderType] ?? null : null;
        const eggToCheck = autoSwitchEgg && targetEggId ? targetEggId : server.eggId;

        if (!eggToCheck || !mcVersion) {
            setJavaCheck(null);
            return;
        }

        let cancelled = false;
        setJavaCheck(null);
        (async () => {
            try {
                const result = await getModpackJavaCompatibility(uuid, eggToCheck, mcVersion, loaderType);
                if (!cancelled) {
                    setJavaCheck(result);
                }
            } catch (e) {
                if (!cancelled) {
                    setJavaCheck(null);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [visible, step, selectedVersion, preferredGameVersion, preferredLoader, addonSettings, server.eggId, uuid]);

    const markStepComplete = useCallback((stepId) => {
        setCompletedSteps((prev) => [...prev, stepId]);
    }, []);

    const sendPower = useCallback(async (action) => {
        await http.post(`/api/client/servers/${uuid}/power`, { signal: action });
    }, [uuid]);

    const waitForServerState = useCallback(async (targetState, timeoutMs = 30000) => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            try {
                const { data } = await http.get(`/api/client/servers/${uuid}/resources`);
                if (data?.attributes?.current_state === targetState) {
                    return true;
                }
            } catch (e) {}
            await new Promise((r) => setTimeout(r, 2000));
        }
        return false;
    }, [uuid]);

    const performInstall = useCallback(async () => {
        if (!selectedVersion || !modpack) return;

        setInstalling(true);
        setInstallError(null);
        clearFlashes('modpacks');

        try {
            const versionLoader = getLoaderFromVersion(selectedVersion);

            setCurrentProgressStep('stop');
            try {
                const { data } = await http.get(`/api/client/servers/${uuid}/resources`);
                const state = data?.attributes?.current_state;
                if (state === 'running' || state === 'starting') {
                    await sendPower('stop');
                    const stopped = await waitForServerState('offline', 30000);
                    if (!stopped) {
                        await sendPower('kill');
                        await waitForServerState('offline', 10000);
                    }
                }
            } catch (e) {}
            markStepComplete('stop');

            setCurrentProgressStep('cleanup');
            try {
                await cleanupServerFiles(uuid, selectedOption);
            } catch (error) {
                throw buildInstallStepError('Failed during cleanup.', error);
            }
            markStepComplete('cleanup');

            setCurrentProgressStep('download');
            const { archiveName, downloadUrl, useDownloadHeader } = await resolveArchiveDownload(uuid, modpack, selectedVersion);

            try {
                await downloadArchive(uuid, archiveName, downloadUrl, useDownloadHeader);
            } catch (error) {
                throw buildInstallStepError(`Failed to download the modpack archive (${archiveName}).`, error);
            }
            markStepComplete('download');

            setCurrentProgressStep('extract');
            try {
                await decompressFiles(uuid, '/', archiveName);
            } catch (error) {
                throw buildInstallStepError(`Failed to extract the modpack archive (${archiveName}).`, error);
            }
            try {
                await deleteFiles(uuid, '/', [archiveName]);
            } catch (e) {}
            markStepComplete('extract');

            setCurrentProgressStep('overrides');
            try {
                await applyExtractedModpackLayout(uuid);
            } catch (error) {
                throw buildInstallStepError('Failed while preparing extracted modpack files.', error);
            }
            markStepComplete('overrides');

            if (modpack.platform === 'modrinth') {
                setCurrentProgressStep('index');
                try {
                    await installModrinthIndexIfPresent(uuid, modpack.platform);
                } catch (error) {
                    throw buildInstallStepError('Failed while downloading modpack files from Modrinth.', error);
                }
                markStepComplete('index');
            } else {
                markStepComplete('index');
            }

            const requestedLoader = normaliseLoader(preferredLoader || compatibility?.loader || null);
            const requestedGameVersion = preferredGameVersion || compatibility?.gameVersion || null;
            const resolvedLoader = await resolveInstalledLoader(
                uuid,
                modpack.platform,
                selectedVersion,
                {
                    type: versionLoader.type || null,
                    version: versionLoader.version || compatibility?.loaderVersion || null,
                },
                requestedLoader,
                requestedGameVersion
            );
            const resolvedLoaderType = resolvedLoader.type;
            const resolvedLoaderVersion = resolvedLoader.version;
            const resolvedMcVersion = resolvedLoader.mcVersion;

            const resolvedLoaderLabel = resolvedLoaderType && resolvedLoaderVersion
                ? `${formatLoaderName(resolvedLoaderType)} ${resolvedLoaderVersion}`
                : resolvedLoaderType
                    ? formatLoaderName(resolvedLoaderType)
                    : selectedVersion.loaders?.length > 0
                        ? selectedVersion.loaders.join(', ')
                        : null;

            if (resolvedLoaderLabel) {
                setDetectedLoader(resolvedLoaderLabel);
            }

            setCurrentProgressStep('egg');
            let nextLoaderMessage = null;
            const loaderEggMap = addonSettings?.loaderEggMap || {};
            const autoSwitchEgg = addonSettings?.autoSwitchEgg !== false;
            const rawTargetEggId = resolvedLoaderType ? loaderEggMap[resolvedLoaderType] ?? null : null;
            const targetEggId = rawTargetEggId !== null && rawTargetEggId !== undefined ? Number(rawTargetEggId) : null;
            const currentEggId = Number(server.eggId);
            const serverAlreadyMatchesLoader = targetEggId !== null && currentEggId === targetEggId;

            if (resolvedLoaderLabel && !resolvedLoaderType) {
                throw new Error(`This modpack requires ${resolvedLoaderLabel}. Installation has been cancelled because the required loader could not be mapped to a supported server egg.`);
            }

            if (resolvedLoaderType && !autoSwitchEgg && !serverAlreadyMatchesLoader) {
                throw new Error(`This modpack requires ${formatLoaderName(resolvedLoaderType)}. Automatic egg switching is disabled and the current server egg does not match the configured loader egg.`);
            }

            if (resolvedLoaderType && autoSwitchEgg) {
                if (targetEggId) {
                    let switchResult;
                    try {
                        switchResult = await withTimeout(
                            switchModpackEgg(uuid, targetEggId, resolvedMcVersion, resolvedLoaderType, resolvedLoaderVersion),
                            30000,
                            `Timed out while switching to the configured ${formatLoaderName(resolvedLoaderType)} egg. Installation has been cancelled.`
                        );
                    } catch (error) {
                        const detail = httpErrorToHuman(error);
                        throw new Error(`Failed to switch to the configured ${formatLoaderName(resolvedLoaderType)} egg. ${detail}`);
                    }

                    if (!serverAlreadyMatchesLoader) {
                        nextLoaderMessage = resolvedLoaderLabel
                            ? `Configured ${resolvedLoaderLabel} automatically by switching to ${switchResult.new_egg_name}.`
                            : `Switched the server egg to ${switchResult.new_egg_name} automatically.`;
                    } else if (resolvedLoaderLabel) {
                        nextLoaderMessage = `Detected ${resolvedLoaderLabel}.`;
                    }
                } else if (!serverAlreadyMatchesLoader) {
                    throw new Error(`This modpack requires ${formatLoaderName(resolvedLoaderType)}. Configure a target egg for ${formatLoaderName(resolvedLoaderType)} in the modpack installer settings to switch automatically.`);
                } else if (resolvedLoaderLabel) {
                    nextLoaderMessage = `Detected ${resolvedLoaderLabel}.`;
                }
            }
            markStepComplete('egg');

            setCurrentProgressStep('loader');
            let needsLoaderBootstrap = false;
            try {
                needsLoaderBootstrap = await prepareLoaderRuntime(uuid, resolvedLoaderType, resolvedMcVersion, resolvedLoaderVersion);
            } catch (error) {
                throw buildInstallStepError('Failed while preparing loader runtime.', error);
            }

            try {
                await ensureWritablePermissions(uuid);
            } catch (error) {
            }

            if (resolvedLoaderLabel && nextLoaderMessage) {
                setLoaderMessage(nextLoaderMessage);
            }
            markStepComplete('loader');

            const metadata = {
                schemaVersion: 1,
                installedAt: new Date().toISOString(),
                platform: modpack.platform,
                modpackId: modpack.id,
                modpackName: modpack.name,
                externalUrl: modpack.externalUrl || null,
                iconUrl: modpack.iconUrl || null,
                versionId: selectedVersion.id,
                versionName: selectedVersion.name,
                fileName: selectedVersion.fileName || null,
                gameVersion: resolvedMcVersion,
                loader: resolvedLoaderType,
                loaderVersion: resolvedLoaderVersion,
                isServerPack: !!selectedVersion.isServerPack,
                installMode: initialMode,
            };

            try {
                await saveFileContents(uuid, MODPACK_METADATA_FILE, JSON.stringify(metadata, null, 2));
                onInstalled?.(metadata);
            } catch (error) {
                throw buildInstallStepError('Failed to save installation metadata.', error);
            }

            setCurrentProgressStep('start');
            if (writeEula) {
                try {
                    await ensureEulaAccepted(uuid);
                } catch (error) {
                }
            }
            if (needsLoaderBootstrap) {
                try {
                    await reinstallServer(uuid);
                    await waitForServerJar(uuid, resolvedLoaderType, resolvedMcVersion);
                    await ensureWritablePermissions(uuid);
                } catch (error) {
                    throw buildInstallStepError('Failed to trigger the loader installer.', error);
                }
                setLoaderMessage(
                    `${resolvedLoaderLabel || formatLoaderName(resolvedLoaderType || '')} runtime files were missing, so the server egg's installer has been triggered to generate them.`
                );
            } else {
                try {
                    await ensureWritablePermissions(uuid);
                    await sendPower('start');
                } catch (error) {
                    throw buildInstallStepError('Failed to start the server after installation.', error);
                }
            }
            markStepComplete('start');

            setInstallComplete(true);
            addFlash({
                key: 'modpacks',
                type: 'success',
                message: `Successfully ${initialMode === 'install' ? 'installed' : initialMode === 'update' ? 'updated' : initialMode === 'downgrade' ? 'downgraded' : 'reinstalled'} ${modpack.name}${selectedVersion.name ? ` (${selectedVersion.name})` : ''}`,
            });
        } catch (error) {
            setInstallError(httpErrorToHuman(error));
            addFlash({
                key: 'modpacks',
                type: 'error',
                message: httpErrorToHuman(error),
            });
        } finally {
            setInstalling(false);
        }
    }, [
        uuid,
        modpack,
        selectedVersion,
        selectedOption,
        sendPower,
        waitForServerState,
        markStepComplete,
        clearFlashes,
        addFlash,
        compatibility,
        preferredGameVersion,
        preferredLoader,
        initialMode,
        onInstalled,
        addonSettings,
        server.eggId,
        writeEula,
    ]);

    if (!modpack) return null;

    const totalSteps = PROGRESS_STEPS.length;
    const progressPercent = installComplete
        ? 100
        : Math.round(((completedSteps.length + (currentProgressStep ? 0.5 : 0)) / totalSteps) * 100);

    const currentStepLabel = installComplete
        ? t(`modpacks.install.complete.${initialMode}`, {
            install: 'Installation complete',
            update: 'Update complete',
            downgrade: 'Downgrade complete',
            reinstall: 'Reinstall complete'
        }[initialMode] || 'Installation complete')
        : installError
            ? t('modpacks.install.failed', 'Installation failed')
            : currentProgressStep
                ? PROGRESS_STEPS.find((s) => s.id === currentProgressStep)?.label ?? t('modpacks.install.installing', 'Installing...')
                : t('modpacks.install.preparing', 'Preparing...');

    const actionLabel = initialMode === 'install'
        ? t('modpacks.install.action.install', 'Install')
        : initialMode === 'update'
            ? t('modpacks.install.action.update', 'Update')
            : initialMode === 'downgrade'
                ? t('modpacks.install.action.downgrade', 'Downgrade')
                : t('modpacks.install.action.reinstall', 'Reinstall');
    const activeActionLabel = initialMode === 'install'
        ? t('modpacks.install.action.installing', 'Installing')
        : initialMode === 'update'
            ? t('modpacks.install.action.updating', 'Updating')
            : initialMode === 'downgrade'
                ? t('modpacks.install.action.downgrading', 'Downgrading')
                : t('modpacks.install.action.reinstalling', 'Reinstalling');

    return (
        <Modal visible={visible} onDismissed={installing ? undefined : onDismissed}>
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    {modpack.iconUrl ? (
                        <img src={modpack.iconUrl} alt={modpack.name} className={styles.modalModpackIcon} />
                    ) : (
                        <div className={styles.modpackIconPlaceholder} style={{ width: 48, height: 48 }}>
                            <FontAwesomeIcon icon={faCubes} />
                        </div>
                    )}
                    <div className={styles.modalModpackInfo}>
                        <h3>{modpack.name}</h3>
                        <p>
                            {step === 'version' && t('modpacks.install.select_version', 'Select a version to {{action}}', { action: actionLabel.toLowerCase() })}
                            {step === 'options' && t('modpacks.install.choose_method', 'Choose installation method')}
                            {step === 'progress' && t('modpacks.install.installing', '{{action}} modpack...', { action: activeActionLabel })}
                        </p>
                    </div>
                </div>

                {step === 'version' && (
                    <>
                        {versionsLoading ? (
                            <div className={styles.loadingContainer} style={{ padding: '24px' }}>
                                <FontAwesomeIcon icon={faSpinner} spin size="2x" style={{ color: 'var(--color-muted)' }} />
                            </div>
                        ) : versions.length === 0 ? (
                            <div className={styles.emptyState} style={{ padding: '24px' }}>
                                <p className={styles.emptyStateTitle}>{t('modpacks.install.no_versions.title', 'No versions available')}</p>
                                <p className={styles.emptyStateMessage}>
                                    {t('modpacks.install.no_versions.message', 'No compatible versions found for this modpack.')}
                                </p>
                            </div>
                        ) : (
                            <>
                                <Input
                                    type="text"
                                    placeholder={t('modpacks.install.search_versions', 'Search versions...')}
                                    value={versionSearch}
                                    onChange={(e) => setVersionSearch(e.target.value)}
                                    className={styles.versionSearch}
                                />
                                <div className={styles.versionList}>
                                    {filteredVersions.map((version) => (
                                        <div
                                            key={version.id}
                                            className={`${styles.versionItem} ${selectedVersion?.id === version.id ? styles.selected : ''}`}
                                            onClick={() => setSelectedVersion(version)}
                                        >
                                            <div className={styles.versionInfo}>
                                                <span className={styles.versionName}>{version.name}</span>
                                                <div className={styles.versionMeta}>
                                                    {version.releaseDate && (
                                                        <span>
                                                            <FontAwesomeIcon icon={faCalendar} style={{ marginRight: 4 }} />
                                                            {formatDate(version.releaseDate)}
                                                        </span>
                                                    )}
                                                    {version.downloads !== undefined && typeof version.downloads === 'number' && (
                                                        <span>
                                                            <FontAwesomeIcon icon={faDownload} style={{ marginRight: 4 }} />
                                                            {version.downloads.toLocaleString()}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className={styles.versionGameVersions}>
                                                    {version.loaders && version.loaders.length > 0 && (
                                                        <span className={styles.loaderTag}>
                                                            {version.loaders.join(', ')}
                                                        </span>
                                                    )}
                                                    {[...version.gameVersions]
                                                        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
                                                        .slice(0, 5)
                                                        .map((v) => (
                                                            <span key={v} className={styles.gameVersionTag}>
                                                                {v}
                                                            </span>
                                                        ))}
                                                    {version.gameVersions.length > 5 && (
                                                        <span className={styles.gameVersionTag}>
                                                            +{version.gameVersions.length - 5}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {selectedVersion?.id === version.id && (
                                                <FontAwesomeIcon
                                                    icon={faCheck}
                                                    style={{ color: 'var(--color-primary)' }}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        <div className={styles.modalActions}>
                            <Button isSecondary onClick={onDismissed}>
                                {t('modpacks.install.cancel', 'Cancel')}
                            </Button>
                            <Button
                                onClick={() => setStep('options')}
                                disabled={!selectedVersion}
                            >
                                {t('modpacks.install.next', 'Next')}
                            </Button>
                        </div>
                    </>
                )}

                {step === 'options' && (
                    <>
                        {javaCheck && !javaCheck.sufficient && (
                            <div className={styles.javaWarning}>
                                <div className={styles.javaWarningIcon}>
                                    <FontAwesomeIcon icon={faExclamationTriangle} />
                                </div>
                                <div className={styles.javaWarningBody}>
                                    <strong>{t('modpacks.install.java_warning.title', 'Java version may be insufficient')}</strong>
                                    <span>
                                        {t('modpacks.install.java_warning.message', 'This modpack targets Minecraft {{version}}, which generally needs Java {{java}} or newer. The target egg{{eggName}} only offers {{available}}. Modern NeoForge/Forge builds for newer Minecraft releases may require a higher Java version than listed (e.g. Java 25). If the server fails to start with a class version error, add a newer Java image to this egg in the admin panel.', {
                                            version: selectedVersion?.gameVersions?.[0] || '?',
                                            java: `Java ${javaCheck.minimum_java}`,
                                            eggName: javaCheck.egg_name ? ` (${javaCheck.egg_name})` : '',
                                            available: javaCheck.available_java.length > 0 ? `Java ${javaCheck.available_java.join(', ')}` : t('modpacks.install.java_warning.no_images', 'no detectable Java images')
                                        })}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className={styles.installOptionsContainer}>
                            {INSTALL_OPTIONS.map((option) => (
                                <div
                                    key={option.id}
                                    className={`${styles.installOption} ${selectedOption === option.id ? styles.selected : ''}`}
                                    onClick={() => setSelectedOption(option.id)}
                                >
                                    <div className={styles.installOptionRadio}>
                                        <div className={styles.installOptionRadioDot} />
                                    </div>
                                    <div className={styles.installOptionContent}>
                                        <div className={styles.installOptionTitle}>{option.title}</div>
                                        <div className={styles.installOptionDescription}>{option.description}</div>
                                        {option.warning && selectedOption === option.id && (
                                            <div className={styles.installOptionWarning}>{option.warning}</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className={styles.modalActions}>
                            <Button isSecondary onClick={() => setStep('version')}>
                                {t('modpacks.install.back', 'Back')}
                            </Button>
                            <Button onClick={() => { setStep('progress'); performInstall(); }}>
                                {actionLabel}
                            </Button>
                        </div>
                    </>
                )}

                {step === 'progress' && (
                    <>
                        <div className={styles.progressContainer}>
                            <div className={styles.progressStatusRow}>
                                <span className={`${styles.progressStepText} ${installError ? styles.progressStepError : installComplete ? styles.progressStepDone : ''}`}>
                                    {installing && !installError && <FontAwesomeIcon icon={faSpinner} spin />}
                                    {currentStepLabel}
                                </span>
                                <span className={styles.progressPercent}>{progressPercent}%</span>
                            </div>
                            <div className={styles.progressBarTrack}>
                                <div
                                    className={`${styles.progressBarFill} ${installError ? styles.progressBarError : installComplete ? styles.progressBarDone : ''}`}
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>

                            {detectedLoader && loaderMessage && (
                                <div className={styles.loaderNotice}>
                                    <FontAwesomeIcon icon={faInfoCircle} />
                                    <span>
                                        {loaderMessage}
                                    </span>
                                </div>
                            )}


                            {installError && (
                                <div className={styles.loaderNotice} style={{
                                    borderColor: 'color-mix(in srgb, #ef4444 25%, transparent)',
                                    backgroundColor: 'color-mix(in srgb, #ef4444 8%, transparent)',
                                }}>
                                    <FontAwesomeIcon icon={faTimesCircle} style={{ color: '#ef4444' }} />
                                    <span>{installError}</span>
                                </div>
                            )}
                        </div>

                        <div className={styles.modalActions}>
                            <Button
                                isSecondary
                                onClick={onDismissed}
                                disabled={installing}
                            >
                                {installComplete ? t('modpacks.install.done', 'Done') : t('modpacks.install.close', 'Close')}
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};

export default InstallModpackModal;
