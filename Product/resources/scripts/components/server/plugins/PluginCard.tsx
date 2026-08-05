import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faExternalLinkAlt, faPuzzlePiece, faSpinner, faTrash } from '@fortawesome/free-solid-svg-icons';
import { Plugin } from '@/api/server/plugins/types';
import styles from './plugins.module.css';

interface PluginCardProps {
    plugin: Plugin;
    onInstall: (plugin: Plugin) => void;
    onUninstall: (plugin: Plugin) => void;
    isInstalling?: boolean;
    isInstalled?: boolean;
}

const formatDownloads = (count: number): string => {
    if (count >= 1000000) {
        return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
};

const PluginCard: React.FC<PluginCardProps> = ({ plugin, onInstall, onUninstall, isInstalling, isInstalled }) => {
    return (
        <div className={styles.pluginCard}>
            <div className={styles.pluginHeader}>
                {plugin.iconUrl ? (
                    <img
                        src={plugin.iconUrl}
                        alt={plugin.name}
                        className={styles.pluginIcon}
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                        }}
                    />
                ) : (
                    <div className={styles.pluginIconPlaceholder}>
                        <FontAwesomeIcon icon={faPuzzlePiece} />
                    </div>
                )}
                <div className={styles.pluginInfo}>
                    <a
                        href={plugin.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.pluginName}
                    >
                        {plugin.name}
                    </a>
                    <span className={styles.pluginAuthor}>by {plugin.author}</span>
                </div>
            </div>

            <p className={styles.pluginDescription}>{plugin.description}</p>

            <div className={styles.pluginFooter}>
                <div className={styles.pluginMeta}>
                    <span className={styles.pluginStat}>
                        <FontAwesomeIcon icon={faDownload} />
                        {formatDownloads(plugin.downloads)}
                    </span>
                </div>

                <div className={styles.pluginActions}>
                    <a
                        href={plugin.externalUrl}
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
                            onClick={() => onUninstall(plugin)}
                            disabled={isInstalling}
                            title="Uninstall"
                        >
                            <FontAwesomeIcon icon={faTrash} />
                        </button>
                    ) : (
                        <button
                            className={`${styles.actionButton} ${styles.primary}`}
                            onClick={() => onInstall(plugin)}
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

export default PluginCard;
