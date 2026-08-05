import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faCubes, faDownload } from '@fortawesome/free-solid-svg-icons';
import Modal from '@/components/elements/Modal';
import Button from '@/components/elements/Button';
import Input from '@/components/elements/Input';
import Select from '@/components/elements/Select';
import Spinner from '@/components/elements/Spinner';
import { MinecraftBuildSummary, MinecraftVersionFork, MinecraftVersionSummary } from '@/api/server/minecraftVersions';
import styles from '../modpacks/modpacks.module.css';

interface Props {
    fork: MinecraftVersionFork | null;
    versions: MinecraftVersionSummary[];
    version: MinecraftVersionSummary | null;
    selectedVersionId: string;
    builds: MinecraftBuildSummary[];
    selectedBuildId: string;
    loadingVersions: boolean;
    loadingBuilds: boolean;
    visible: boolean;
    onDismissed: () => void;
    onSelectVersion: (versionId: string) => void;
    onSelectBuild: (buildId: string) => void;
    onSwitch: () => void;
}

const MinecraftBuildPickerModal = ({
    fork,
    versions,
    version,
    selectedVersionId,
    builds,
    selectedBuildId,
    loadingVersions,
    loadingBuilds,
    visible,
    onDismissed,
    onSelectVersion,
    onSelectBuild,
    onSwitch,
}: Props) => {
    const { t } = useTranslation('server');
    const [buildSearch, setBuildSearch] = useState('');

    useEffect(() => {
        if (!visible) {
            setBuildSearch('');
        }
    }, [visible]);

    const filteredBuilds = useMemo(() => {
        if (!buildSearch.trim()) {
            return builds.slice(0, 20);
        }

        const query = buildSearch.toLowerCase();

        return builds.filter(
            (build) =>
                build.name.toLowerCase().includes(query) ||
                build.id.toLowerCase().includes(query) ||
                (build.notes || '').toLowerCase().includes(query)
        );
    }, [buildSearch, builds]);
    const selectedBuild = builds.find((build) => build.id === selectedBuildId);

    if (!fork) {
        return null;
    }

    const canSwitch = !!selectedBuild && (
        !!selectedBuild.downloadUrl
        || fork.id === 'forge'
        || fork.id === 'neoforge'
    );

    const unknown = t('minecraft_versions.build_picker.unknown_java', 'Unknown');
    const formatDate = (value?: string | null) => {
        if (!value) {
            return unknown;
        }

        return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    };

    return (
        <Modal visible={visible} onDismissed={onDismissed}>
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    {fork.iconUrl ? (
                        <img src={fork.iconUrl} alt={fork.name} className={styles.modalModpackIcon} />
                    ) : (
                        <div className={styles.modpackIconPlaceholder} style={{ width: 48, height: 48 }}>
                            <FontAwesomeIcon icon={faCubes} />
                        </div>
                    )}
                    <div className={styles.modalModpackInfo}>
                        <h3>{version?.name || fork.name}</h3>
                        <p>{fork.name} {t('minecraft_versions.build_picker.builds_suffix', 'builds')}</p>
                    </div>
                </div>

                {fork.requiresMinecraftVersion && (
                    <div className={styles.filterGroup}>
                        <span className={styles.filterLabel}>{t('minecraft_versions.build_picker.minecraft_version', 'Minecraft Version')}</span>
                        <Select value={selectedVersionId} onChange={(e) => onSelectVersion(e.target.value)} disabled={loadingVersions}>
                            {versions.map((entry) => (
                                <option key={entry.id} value={entry.id}>
                                    {entry.name}
                                </option>
                            ))}
                        </Select>
                    </div>
                )}

                {loadingVersions || loadingBuilds ? (
                    <div className={styles.loadingContainer}>
                        <Spinner size="large" />
                    </div>
                ) : !version && fork.requiresMinecraftVersion ? (
                    <div className={styles.emptyState}>
                        <FontAwesomeIcon icon={faCubes} />
                        <h3 className={styles.emptyStateTitle}>{t('minecraft_versions.build_picker.select_a_version_title', 'Select a version')}</h3>
                        <p className={styles.emptyStateMessage}>{t('minecraft_versions.build_picker.select_a_version_message', 'Choose a Minecraft version to browse compatible builds.')}</p>
                    </div>
                ) : builds.length === 0 ? (
                    <div className={styles.emptyState}>
                        <FontAwesomeIcon icon={faCubes} />
                        <h3 className={styles.emptyStateTitle}>{t('minecraft_versions.build_picker.no_builds_title', 'No builds found')}</h3>
                        <p className={styles.emptyStateMessage}>{t('minecraft_versions.build_picker.no_builds_message', 'No compatible builds were returned for this version.')}</p>
                    </div>
                ) : (
                    <>
                        <Input
                            type="text"
                            placeholder={t('minecraft_versions.build_picker.search_placeholder', 'Search builds...')}
                            value={buildSearch}
                            onChange={(e) => setBuildSearch(e.target.value)}
                            className={styles.versionSearch}
                        />
                        <div className={styles.versionList}>
                            {filteredBuilds.map((build) => (
                                <div
                                    key={build.id}
                                    className={`${styles.versionItem} ${selectedBuildId === build.id ? styles.selected : ''}`}
                                    onClick={() => onSelectBuild(build.id)}
                                >
                                    <div className={styles.versionInfo}>
                                        <span className={styles.versionName}>{build.name}</span>
                                        <span className={styles.versionMeta}>
                                            <span>{t('minecraft_versions.build_picker.java_label', 'Java')} {build.javaVersion || unknown}</span>
                                            <span>{build.stable ? t('minecraft_versions.build_picker.stable', 'Stable') : t('minecraft_versions.build_picker.experimental', 'Experimental')}</span>
                                            <span>{formatDate(build.releaseDate)}</span>
                                        </span>
                                        {build.notes && <span className={styles.modpackAuthor}>{build.notes}</span>}
                                    </div>
                                    {selectedBuildId === build.id ? (
                                        <FontAwesomeIcon icon={faCheck} style={{ color: 'var(--color-primary)' }} />
                                    ) : (
                                        <FontAwesomeIcon icon={faDownload} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}

                <div className={styles.modalActions}>
                    <Button isSecondary onClick={onDismissed}>{t('minecraft_versions.build_picker.close', 'Close')}</Button>
                    <Button onClick={onSwitch} disabled={!canSwitch || loadingVersions || loadingBuilds || builds.length === 0}>
                        {t('minecraft_versions.build_picker.switch_version', 'Switch Version')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default MinecraftBuildPickerModal;
