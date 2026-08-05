import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faExternalLinkAlt, faCube, faSpinner, faTrash } from '@fortawesome/free-solid-svg-icons';
import styles from './mods.module.css';

const formatDownloads = (count) => {
    if (count >= 1000000) {
        return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
};

const ModCard = ({ mod, onInstall, onUninstall, isInstalling, isInstalled }) => {
    return (
        <div className={styles.modCard}>
            <div className={styles.modHeader}>
                {mod.iconUrl ? (
                    <img
                        src={mod.iconUrl}
                        alt={mod.name}
                        className={styles.modIcon}
                        onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextElementSibling?.classList.remove('hidden');
                        }}
                    />
                ) : (
                    <div className={styles.modIconPlaceholder}>
                        <FontAwesomeIcon icon={faCube} />
                    </div>
                )}
                <div className={styles.modInfo}>
                    <a
                        href={mod.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.modName}
                    >
                        {mod.name}
                    </a>
                    <span className={styles.modAuthor}>by {mod.author}</span>
                </div>
            </div>

            <p className={styles.modDescription}>{mod.description}</p>

            <div className={styles.modFooter}>
                <div className={styles.modMeta}>
                    <span className={styles.modStat}>
                        <FontAwesomeIcon icon={faDownload} />
                        {formatDownloads(mod.downloads)}
                    </span>
                </div>

                <div className={styles.modActions}>
                    <a
                        href={mod.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.actionButton}
                        title="View on website"
                    >
                        <FontAwesomeIcon icon={faExternalLinkAlt} />
                    </a>
                    {isInstalled ? (
                        <button
                            className={`${styles.actionButton} ${styles.danger}`}
                            onClick={() => onUninstall(mod)}
                            disabled={isInstalling}
                            title="Uninstall"
                        >
                            <FontAwesomeIcon icon={faTrash} />
                        </button>
                    ) : (
                        <button
                            className={`${styles.actionButton} ${styles.primary}`}
                            onClick={() => onInstall(mod)}
                            disabled={isInstalling}
                            title="Install"
                        >
                            {isInstalling ? (
                                <FontAwesomeIcon icon={faSpinner} spin />
                            ) : (
                                'Install'
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ModCard;
