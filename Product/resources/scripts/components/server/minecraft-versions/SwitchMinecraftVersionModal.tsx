import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCheck,
    faCircleNotch,
    faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';
import Modal from '@/components/elements/Modal';
import Button from '@/components/elements/Button';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';
import { ServerContext } from '@/state/server';
import { useStoreState } from '@/state/hooks';
import http from '@/api/http';
import deleteFiles from '@/api/server/files/deleteFiles';
import decompressFiles from '@/api/server/files/decompressFiles';
import loadDirectory from '@/api/server/files/loadDirectory';
import pullFile from '@/api/server/files/pullFile';
import renameFiles from '@/api/server/files/renameFiles';
import saveFileContents from '@/api/server/files/saveFileContents';
import getServer from '@/api/server/getServer';
import reinstallServer from '@/api/server/reinstallServer';
import {
    MINECRAFT_VERSION_MANAGER_SMART_CLEANUP,
    MinecraftBuildSummary,
    MinecraftDetectedState,
    MinecraftVersionFork,
    MinecraftVersionSummary,
    switchMinecraftVersion,
} from '@/api/server/minecraftVersions';
import styles from '../modpacks/modpacks.module.css';

const PROGRESS_STEP_IDS = ['download', 'stop', 'cleanup', 'eula', 'switch', 'start'] as const;
const LOADER_REINSTALL_FORKS = ['forge', 'neoforge'];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForEggReinstall = async (uuid: string, timeoutMs = 10 * 60 * 1000) => {
    const startedAt = Date.now();
    let sawInstalling = false;

    while (Date.now() - startedAt < timeoutMs) {
        const [server] = await getServer(uuid);

        if (server.status === 'install_failed' || server.status === 'reinstall_failed') {
            throw new Error('Egg reinstallation failed. Check the server console for installer output.');
        }

        if (server.status === 'installing') {
            sawInstalling = true;
            await sleep(3000);
            continue;
        }

        if (sawInstalling) {
            const rootFiles = await loadDirectory(uuid, '/');
            const hasLibraries = rootFiles.some((entry) => !entry.isFile && entry.name.toLowerCase() === 'libraries');
            const hasUnixArgs = rootFiles.some((entry) => entry.isFile && entry.name.toLowerCase() === 'unix_args.txt');
            const hasJar = rootFiles.some((entry) => entry.isFile && /\.jar$/i.test(entry.name));

            if (hasLibraries || hasUnixArgs || hasJar) {
                return;
            }
        }

        await sleep(3000);
    }

    throw new Error('Timed out waiting for the egg installer to finish.');
};

interface Props {
    fork: MinecraftVersionFork | null;
    version: MinecraftVersionSummary | null;
    build: MinecraftBuildSummary | null;
    visible: boolean;
    onDismissed: () => void;
    onSwitched: (result: { detected: MinecraftDetectedState; selection: { fork: string; minecraftVersion?: string | null; buildId?: string | null; buildName?: string | null } }) => void;
}

const SwitchMinecraftVersionModal = ({ fork, version, build, visible, onDismissed, onSwitched }: Props) => {
    const { t } = useTranslation('server');
    const server = ServerContext.useStoreState((state) => state.server.data);
    const uuid = server.uuid;
    const addonSettings = useStoreState((state) => state.settings.data?.addons?.minecraftVersionManager);
    const { clearFlashes, addError } = useFlash();

    const cleanupOptions = useMemo(() => ([
        {
            id: 'none' as const,
            title: t('minecraft_versions.switch_modal.cleanup.none_title', 'Keep Existing Files'),
            description: t('minecraft_versions.switch_modal.cleanup.none_description', 'Only update the panel egg and startup variables.'),
            warning: null as string | null,
        },
        {
            id: 'smart' as const,
            title: t('minecraft_versions.switch_modal.cleanup.smart_title', 'Smart Cleanup'),
            description: t('minecraft_versions.switch_modal.cleanup.smart_description', 'Delete common generated files, jars, worlds, logs, plugin folders, and loader directories before switching.'),
            warning: null as string | null,
        },
        {
            id: 'full' as const,
            title: t('minecraft_versions.switch_modal.cleanup.full_title', 'Full Cleanup'),
            description: t('minecraft_versions.switch_modal.cleanup.full_description', 'Delete everything in the server root before applying the new version.'),
            warning: t('minecraft_versions.switch_modal.cleanup.full_warning', 'This removes all server files in the root directory.'),
        },
    ]), [t]);

    const usesEggReinstall = !!fork && LOADER_REINSTALL_FORKS.indexOf(fork.id) !== -1;
    const stepLabels: Record<string, string> = useMemo(() => ({
        download: usesEggReinstall
            ? t('minecraft_versions.switch_modal.steps.egg_install', 'Running egg installer')
            : t('minecraft_versions.switch_modal.steps.download', 'Downloading server jar'),
        stop: t('minecraft_versions.switch_modal.steps.stop', 'Stopping server'),
        cleanup: t('minecraft_versions.switch_modal.steps.cleanup', 'Cleaning files'),
        eula: t('minecraft_versions.switch_modal.steps.eula', 'Writing EULA'),
        switch: t('minecraft_versions.switch_modal.steps.switch', 'Updating egg and startup variables'),
        start: t('minecraft_versions.switch_modal.steps.start', 'Starting server'),
    }), [t, usesEggReinstall]);
    const [cleanupMode, setCleanupMode] = useState<'none' | 'smart' | 'full'>(
        addonSettings?.defaultCleanupMode || 'smart'
    );
    const [writeEula, setWriteEula] = useState(addonSettings?.writeEula ?? true);
    const [currentStep, setCurrentStep] = useState<string | null>(null);
    const [completedSteps, setCompletedSteps] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const progressPercent = currentStep
        ? Math.round(((completedSteps.length + 1) / PROGRESS_STEP_IDS.length) * 100)
        : 0;
    const currentStepLabel = (currentStep && stepLabels[currentStep])
        || t('minecraft_versions.switch_modal.preparing', 'Preparing switch');

    const resetState = () => {
        setCleanupMode(addonSettings?.defaultCleanupMode || 'smart');
        setWriteEula(addonSettings?.writeEula ?? true);
        setCurrentStep(null);
        setCompletedSteps([]);
        setSubmitting(false);
        setError(null);
    };

    const completeStep = (step: string) => {
        setCompletedSteps((steps) => (steps.includes(step) ? steps : [...steps, step]));
    };

    const handleCleanup = async (preserveFile?: string) => {
        if (cleanupMode === 'none') {
            return;
        }

        if (cleanupMode === 'smart') {
            const files = await loadDirectory(uuid, '/');
            const names = new Set(files.map((file) => file.name));
            const targets = MINECRAFT_VERSION_MANAGER_SMART_CLEANUP.filter((name) => names.has(name));

            if (targets.length > 0) {
                await deleteFiles(uuid, '/', targets);
            }

            return;
        }

        const files = await loadDirectory(uuid, '/');
        const names = files.map((file) => file.name).filter((name) => name && name !== preserveFile);

        if (names.length > 0) {
            await deleteFiles(uuid, '/', names);
        }
    };

    const getServerJarName = () => {
        const jarVariable = server.variables.find(
            (variable) => ['SERVER_JARFILE', 'JARFILE', 'SERVER_JAR'].indexOf(variable.envVariable) !== -1
        );
        const value = jarVariable?.serverValue || jarVariable?.defaultValue || build?.downloadName || 'server.jar';
        const parts = value.replace(/\\/g, '/').split('/');

        return parts[parts.length - 1] || 'server.jar';
    };

    const getCurrentJavaVersion = () => {
        const sources = [
            server.image || '',
            ...(server.variables || [])
                .filter((variable) =>
                    ['JAVA_VERSION', 'JAVA', 'RUNTIME', 'JAVA_IMAGE'].indexOf(variable.envVariable) !== -1
                )
                .map((variable) => variable.serverValue || variable.defaultValue || ''),
        ].filter(Boolean);

        for (const source of sources) {
            const value = String(source).toLowerCase();
            const match = value.match(/java[^0-9]*([0-9]{1,2})|(?:^|[^0-9])j([0-9]{1,2})(?:[^0-9]|$)/);
            const parsed = Number(match?.[1] || match?.[2] || 0);
            if (parsed >= 8 && parsed <= 40) {
                return parsed;
            }
        }

        return null;
    };

    const handleSwitch = async () => {
        if (!fork || !build) {
            return;
        }

        clearFlashes('minecraft-version-manager');
        setSubmitting(true);
        setError(null);

        try {
            const currentJava = getCurrentJavaVersion();
            const requiredJava = build.javaVersion || version?.javaVersion || null;
            if (requiredJava && currentJava && currentJava < requiredJava) {
                window.alert(
                    t(
                        'minecraft_versions.switch_modal.java_warning',
                        `This build requires Java ${requiredJava}, but your server is currently on Java ${currentJava}. Please switch the server Java image before starting, or ensure the egg has a Java ${requiredJava} image available.`,
                        { required: requiredJava, current: currentJava },
                    )
                );
            }

            if (usesEggReinstall) {
                setCurrentStep('stop');
                await http.post(`/api/client/servers/${uuid}/power`, { signal: 'stop' });
                completeStep('stop');
                completeStep('cleanup');

                setCurrentStep('switch');
                const result = await switchMinecraftVersion(uuid, {
                    fork: fork.id,
                    minecraftVersion: version?.id || null,
                    versionName: version?.name || null,
                    buildId: build.id,
                    buildName: build.name,
                    downloadName: 'server.jar',
                    buildType: build.type,
                    javaVersion: build.javaVersion ?? version?.javaVersion ?? null,
                    targetEggId: addonSettings?.autoSwitchEgg === false ? null : fork.targetEggId || null,
                    cleanupMode,
                    writeEula,
                });
                completeStep('switch');

                setCurrentStep('download');
                await reinstallServer(uuid);
                await waitForEggReinstall(uuid);
                completeStep('download');

                setCurrentStep('eula');
                if (writeEula && fork.category !== 'proxy') {
                    await saveFileContents(uuid, 'eula.txt', 'eula=true\n');
                }
                completeStep('eula');

                setCurrentStep('start');
                await sleep(500);
                await http.post(`/api/client/servers/${uuid}/power`, { signal: 'start' });
                completeStep('start');

                setCurrentStep(null);
                onSwitched(result);
                resetState();
                onDismissed();
                return;
            }

            if (!build.downloadUrl) {
                throw new Error(t('minecraft_versions.switch_modal.errors.no_download', 'This build does not provide a direct server jar download.'));
            }

            const serverJarName = getServerJarName();
            let resolvedServerJarName = serverJarName;
            const isArchiveDownload = /\.zip$/i.test(build.downloadName || build.downloadUrl || '');
            const temporaryJarName = `luna-version-manager-${Date.now()}.${isArchiveDownload ? 'zip' : 'jar'}`;
            const filesBeforeDownload = await loadDirectory(uuid, '/');

            if (filesBeforeDownload.some((file) => file.name === temporaryJarName)) {
                await deleteFiles(uuid, '/', [temporaryJarName]);
            }

            setCurrentStep('download');
            await pullFile(uuid, {
                url: build.downloadUrl,
                directory: '/',
                filename: temporaryJarName,
                foreground: true,
            });
            completeStep('download');

            setCurrentStep('stop');
            await http.post(`/api/client/servers/${uuid}/power`, { signal: 'stop' });
            completeStep('stop');

            setCurrentStep('cleanup');
            await handleCleanup(temporaryJarName);
            completeStep('cleanup');

            setCurrentStep('eula');
            if (writeEula && fork.category !== 'proxy') {
                await saveFileContents(uuid, 'eula.txt', 'eula=true\n');
            }
            completeStep('eula');

            const rootFiles = await loadDirectory(uuid, '/');
            if (rootFiles.some((file) => file.name === serverJarName)) {
                await deleteFiles(uuid, '/', [serverJarName]);
            }

            if (isArchiveDownload) {
                await decompressFiles(uuid, '/', temporaryJarName);
                await deleteFiles(uuid, '/', [temporaryJarName]);

                const extractedFiles = await loadDirectory(uuid, '/');
                const extractedJar = extractedFiles.find((file) => file.isFile && file.name === 'server.jar')
                    || extractedFiles.find((file) => file.isFile && /\.jar$/i.test(file.name));

                if (!extractedJar) {
                    throw new Error(t('minecraft_versions.switch_modal.errors.archive_no_jar', 'Archive extracted but no runnable .jar file was found.'));
                }

                if (extractedJar.name !== serverJarName) {
                    if (extractedFiles.some((file) => file.isFile && file.name === serverJarName)) {
                        await deleteFiles(uuid, '/', [serverJarName]);
                    }
                    await renameFiles(uuid, '/', [{ from: extractedJar.name, to: serverJarName }]);
                }

                resolvedServerJarName = serverJarName;
            } else {
                await renameFiles(uuid, '/', [{ from: temporaryJarName, to: serverJarName }]);
            }

            setCurrentStep('switch');
            const result = await switchMinecraftVersion(uuid, {
                fork: fork.id,
                minecraftVersion: version?.id || null,
                versionName: version?.name || null,
                buildId: build.id,
                buildName: build.name,
                downloadName: resolvedServerJarName,
                buildType: build.type,
                javaVersion: build.javaVersion ?? version?.javaVersion ?? null,
                targetEggId: addonSettings?.autoSwitchEgg === false ? null : fork.targetEggId || null,
                cleanupMode,
                writeEula,
            });
            completeStep('switch');

            setCurrentStep('start');
            await sleep(500);
            await http.post(`/api/client/servers/${uuid}/power`, { signal: 'start' });
            completeStep('start');

            setCurrentStep(null);
            onSwitched(result);
            resetState();
            onDismissed();
        } catch (caught) {
            const message = caught instanceof Error && !('response' in (caught as object))
                ? caught.message
                : httpErrorToHuman(caught);
            setError(message);
            addError({ key: 'minecraft-version-manager', message });
            setSubmitting(false);
        }
    };

    if (!fork || !build) {
        return null;
    }

    return (
        <Modal
            visible={visible}
            onDismissed={() => {
                resetState();
                onDismissed();
            }}
        >
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    {fork.iconUrl ? (
                        <img src={fork.iconUrl} alt={fork.name} className={styles.modalModpackIcon} />
                    ) : (
                        <div className={styles.modpackIconPlaceholder} style={{ width: 48, height: 48 }}>
                            <FontAwesomeIcon icon={faCheck} />
                        </div>
                    )}
                    <div className={styles.modalModpackInfo}>
                        <h3>{t('minecraft_versions.switch_modal.title', `Switch to ${fork.name}`, { fork: fork.name })}</h3>
                        <p>
                            {version?.name || t('minecraft_versions.switch_modal.subtitle_latest', 'Latest')} {build.name}
                        </p>
                    </div>
                </div>

                {(submitting || error) ? (
                    <div className={styles.progressContainer}>
                        <div className={styles.progressStatusRow}>
                            <div className={`${styles.progressStepText} ${error ? styles.progressStepError : ''}`}>
                                <FontAwesomeIcon icon={error ? faExclamationTriangle : faCircleNotch} spin={!error} />
                                {currentStepLabel}
                            </div>
                            <div className={styles.progressPercent}>{progressPercent}%</div>
                        </div>
                        <div className={styles.progressBarTrack}>
                            <div
                                className={`${styles.progressBarFill} ${error ? styles.progressBarError : ''}`}
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        {error && (
                            <div className={`${styles.loaderNotice} ${styles.progressStepError}`}>
                                <FontAwesomeIcon icon={faExclamationTriangle} />
                                <span>{error}</span>
                            </div>
                        )}
                        <div className={styles.modalActions}>
                            <Button
                                isSecondary
                                onClick={() => {
                                    resetState();
                                    onDismissed();
                                }}
                                disabled={submitting}
                            >
                                {t('minecraft_versions.switch_modal.close', 'Close')}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className={styles.installOptionsContainer}>
                            {cleanupOptions.map((option) => (
                                <button
                                    key={option.id}
                                    type="button"
                                    className={`${styles.installOption} ${cleanupMode === option.id ? styles.selected : ''}`}
                                    onClick={() => setCleanupMode(option.id)}
                                >
                                    <div className={styles.installOptionRadio}>
                                        <div className={styles.installOptionRadioDot} />
                                    </div>
                                    <div className={styles.installOptionContent}>
                                        <div className={styles.installOptionTitle}>{option.title}</div>
                                        <div className={styles.installOptionDescription}>{option.description}</div>
                                        {option.warning && <div className={styles.installOptionWarning}>{option.warning}</div>}
                                    </div>
                                </button>
                            ))}
                        </div>

                        {fork.category !== 'proxy' && (
                            <button
                                type="button"
                                className={`${styles.installOption} ${writeEula ? styles.selected : ''}`}
                                onClick={() => setWriteEula((value) => !value)}
                            >
                                <div className={styles.installOptionRadio}>
                                    <div className={styles.installOptionRadioDot} />
                                </div>
                                <div className={styles.installOptionContent}>
                                    <div className={styles.installOptionTitle}>{t('minecraft_versions.switch_modal.eula_title', 'Automatically accept the EULA')}</div>
                                    <div className={styles.installOptionDescription}>
                                        {t('minecraft_versions.switch_modal.eula_description_prefix', 'Write')} <code>eula=true</code> {t('minecraft_versions.switch_modal.eula_description_suffix', 'before the server starts again.')}
                                    </div>
                                </div>
                            </button>
                        )}

                        <div className={styles.modalActions}>
                            <Button
                                isSecondary
                                onClick={() => {
                                    resetState();
                                    onDismissed();
                                }}
                            >
                                {t('minecraft_versions.switch_modal.cancel', 'Cancel')}
                            </Button>
                            <Button onClick={handleSwitch}>{t('minecraft_versions.switch_modal.apply', 'Apply Switch')}</Button>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};

export default SwitchMinecraftVersionModal;
