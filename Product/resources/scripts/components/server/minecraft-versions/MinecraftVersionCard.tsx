import React from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCubes,
    faInfoCircle,
    faSyncAlt,
} from '@fortawesome/free-solid-svg-icons';
import { MinecraftVersionFork } from '@/api/server/minecraftVersions';
import styles from '../modpacks/modpacks.module.css';

interface Props {
    fork: MinecraftVersionFork;
    current: {
        fork?: string | null;
    } | null;
    isSelected?: boolean;
    onDetails: (fork: MinecraftVersionFork) => void;
    onSelect: (fork: MinecraftVersionFork) => void;
}

const MinecraftVersionCard = ({ fork, current, isSelected, onDetails, onSelect }: Props) => {
    const { t } = useTranslation('server');
    const isCurrent = current?.fork === fork.id;
    const categoryLabel = fork.category === 'proxy'
        ? t('minecraft_versions.fork_category.proxy', 'Proxy software')
        : fork.category === 'modded'
            ? t('minecraft_versions.fork_category.modded', 'Mod loader')
            : t('minecraft_versions.fork_category.server', 'Server software');
    const supportLabel = fork.supportsExperimental
        ? t('minecraft_versions.fork_support.stable_experimental', 'Stable + experimental')
        : t('minecraft_versions.fork_support.stable_only', 'Stable builds');

    return (
        <div className={`${styles.modpackCard} ${isSelected ? styles.modpackCardSelected : ''}`}>
            <div className={styles.modpackHeader}>
                {fork.iconUrl ? (
                    <img src={fork.iconUrl} alt={fork.name} className={styles.modpackIcon} />
                ) : (
                    <div className={styles.modpackIconPlaceholder}>
                        <FontAwesomeIcon icon={faCubes} />
                    </div>
                )}
                <div className={styles.modpackInfo}>
                    <span className={styles.modpackName}>{fork.name}</span>
                    <span className={styles.modpackAuthor}>{categoryLabel}</span>
                    <span className={styles.platformTag}>{supportLabel}</span>
                </div>
            </div>

            <p className={styles.modpackDescription}>{fork.description}</p>

            <div className={`${styles.modpackFooter} ${styles.modpackFooterActionsOnly}`}>
                <div className={styles.modpackActions}>
                    <button
                        className={`${styles.actionButton} ${styles.details}`}
                        onClick={() => onDetails(fork)}
                        title={t('minecraft_versions.card.view_details', 'View details')}
                    >
                        <FontAwesomeIcon icon={faInfoCircle} />
                    </button>
                    <button
                        className={`${styles.actionButton} ${styles.primary} ${isCurrent ? styles.installedActionButton : ''}`}
                        onClick={() => onSelect(fork)}
                        title={t('minecraft_versions.card.browse_versions', 'Browse versions')}
                    >
                        <FontAwesomeIcon icon={faSyncAlt} />
                        {t('minecraft_versions.card.browse', 'Browse')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MinecraftVersionCard;
