import React from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faExternalLinkAlt, faCubes, faSpinner, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import styles from './modpacks.module.css';

const formatDownloads = (count) => {
    if (count >= 1000000) {
        return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
};

const getPlatformLabel = (platform) => {
    switch (platform) {
        case 'modrinth':
            return 'Modrinth';
        case 'curseforge':
            return 'CurseForge';
        default:
            return platform;
    }
};

const ModpackCard = ({ modpack, onInstall, onDetails, isInstalling }) => {
    const { t } = useTranslation('server');

    return (
        <div className={styles.modpackCard}>
            <div className={styles.modpackHeader}>
                {modpack.iconUrl ? (
                    <img
                        src={modpack.iconUrl}
                        alt={modpack.name}
                        className={styles.modpackIcon}
                        onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextElementSibling?.classList.remove('hidden');
                        }}
                    />
                ) : (
                    <div className={styles.modpackIconPlaceholder}>
                        <FontAwesomeIcon icon={faCubes} />
                    </div>
                )}
                <div className={styles.modpackInfo}>
                    <a
                        href={modpack.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.modpackName}
                    >
                        {modpack.name}
                    </a>
                    <span className={styles.modpackAuthor}>{t('modpacks.card.by', 'by')} {modpack.author}</span>
                    <span className={`${styles.platformTag} ${styles[modpack.platform]}`}>
                        {getPlatformLabel(modpack.platform)}
                    </span>
                </div>
            </div>

            <p className={styles.modpackDescription}>{modpack.description}</p>

            <div className={styles.modpackFooter}>
                <div className={styles.modpackMeta}>
                    <span className={styles.modpackStat}>
                        <FontAwesomeIcon icon={faDownload} />
                        {formatDownloads(modpack.downloads)}
                    </span>
                </div>

                <div className={styles.modpackActions}>
                    <a
                        href={modpack.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.actionButton}
                        title={t('modpacks.card.view_website', 'View on website')}
                    >
                        <FontAwesomeIcon icon={faExternalLinkAlt} />
                    </a>
                    <button
                        className={`${styles.actionButton} ${styles.details}`}
                        onClick={() => onDetails(modpack)}
                        title={t('modpacks.card.view_details', 'View details')}
                    >
                        <FontAwesomeIcon icon={faInfoCircle} />
                    </button>
                    <button
                        className={`${styles.actionButton} ${styles.primary}`}
                        onClick={() => onInstall(modpack)}
                        disabled={isInstalling}
                        title={t('modpacks.card.install', 'Install')}
                    >
                        {isInstalling ? (
                            <FontAwesomeIcon icon={faSpinner} spin />
                        ) : (
                            t('modpacks.card.install', 'Install')
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModpackCard;
