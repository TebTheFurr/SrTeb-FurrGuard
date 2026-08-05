import React from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCalendar,
    faCodeBranch,
    faCoffee,
    faDownload,
    faServer,
} from '@fortawesome/free-solid-svg-icons';
import Modal from '@/components/elements/Modal';
import Button from '@/components/elements/Button';
import {
    MinecraftBuildSummary,
    MinecraftVersionFork,
    MinecraftVersionSummary,
} from '@/api/server/minecraftVersions';
import styles from '../modpacks/modpacks.module.css';

interface Props {
    fork: MinecraftVersionFork | null;
    version: MinecraftVersionSummary | null;
    build: MinecraftBuildSummary | null;
    visible: boolean;
    onDismissed: () => void;
    onSwitch: () => void;
}

const MinecraftVersionDetailsModal = ({ fork, version, build, visible, onDismissed, onSwitch }: Props) => {
    const { t } = useTranslation('server');

    if (!fork) {
        return null;
    }

    const unknown = t('minecraft_versions.details_modal.unknown', 'Unknown');
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
                    <div className={styles.modpackIconPlaceholder} style={{ width: 48, height: 48 }}>
                        <FontAwesomeIcon icon={faServer} />
                    </div>
                    <div className={styles.modalModpackInfo}>
                        <h3>{fork.name}</h3>
                        <p>{fork.description}</p>
                    </div>
                </div>

                <div className={styles.detailsMeta}>
                    <div className={styles.detailsMetaItem}>
                        <span className={styles.detailsMetaLabel}>{t('minecraft_versions.details_modal.category', 'Category')}</span>
                        <span className={styles.detailsMetaValue}>
                            <FontAwesomeIcon icon={faCodeBranch} />
                            {fork.category}
                        </span>
                    </div>
                    <div className={styles.detailsMetaItem}>
                        <span className={styles.detailsMetaLabel}>{t('minecraft_versions.details_modal.version', 'Version')}</span>
                        <span className={styles.detailsMetaValue}>
                            <FontAwesomeIcon icon={faDownload} />
                            {version?.name || t('minecraft_versions.details_modal.select_version', 'Select a version')}
                        </span>
                    </div>
                    <div className={styles.detailsMetaItem}>
                        <span className={styles.detailsMetaLabel}>{t('minecraft_versions.details_modal.build', 'Build')}</span>
                        <span className={styles.detailsMetaValue}>
                            <FontAwesomeIcon icon={faServer} />
                            {build?.name || t('minecraft_versions.details_modal.select_build', 'Select a build')}
                        </span>
                    </div>
                    <div className={styles.detailsMetaItem}>
                        <span className={styles.detailsMetaLabel}>{t('minecraft_versions.details_modal.java', 'Java')}</span>
                        <span className={styles.detailsMetaValue}>
                            <FontAwesomeIcon icon={faCoffee} />
                            {build?.javaVersion || version?.javaVersion || unknown}
                        </span>
                    </div>
                    <div className={styles.detailsMetaItem}>
                        <span className={styles.detailsMetaLabel}>{t('minecraft_versions.details_modal.release_date', 'Release date')}</span>
                        <span className={styles.detailsMetaValue}>
                            <FontAwesomeIcon icon={faCalendar} />
                            {formatDate(build?.releaseDate || version?.releaseDate)}
                        </span>
                    </div>
                </div>

                {build?.notes && (
                    <div className={styles.detailsBody}>
                        <p>{build.notes}</p>
                    </div>
                )}

                <div className={styles.modalActions}>
                    <Button isSecondary onClick={onDismissed}>{t('minecraft_versions.details_modal.close', 'Close')}</Button>
                    <Button onClick={onSwitch} disabled={!version || !build}>
                        {t('minecraft_versions.details_modal.switch_version', 'Switch Version')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default MinecraftVersionDetailsModal;
