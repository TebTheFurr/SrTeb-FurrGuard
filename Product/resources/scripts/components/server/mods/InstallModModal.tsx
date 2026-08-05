import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCube, faDownload, faCalendar, faCheck } from '@fortawesome/free-solid-svg-icons';
import Modal from '@/components/elements/Modal';
import Button from '@/components/elements/Button';
import Input from '@/components/elements/Input';
import pullFile from '@/api/server/files/pullFile';
import createDirectory from '@/api/server/files/createDirectory';
import { ServerContext } from '@/state/server';
import useFlash from '@/plugins/useFlash';
import { httpErrorToHuman } from '@/api/http';
import styles from './mods.module.css';

const cleanVersionName = (name) => {
    const match = name.match(/^[a-zA-Z]+-(.+)$/);
    return match ? match[1] : name;
};

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const InstallModModal = ({ mod, versions, visible, onDismissed, modsDirectory, flashKey = 'mods' }) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data.uuid);
    const { addFlash, clearFlashes } = useFlash();
    const [installing, setInstalling] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState(null);
    const [versionSearch, setVersionSearch] = useState('');

    const filteredVersions = (() => {
        if (!versionSearch.trim()) return versions;
        const query = versionSearch.toLowerCase();
        return versions.filter(
            (v) =>
                v.name.toLowerCase().includes(query) ||
                v.gameVersions.some((gv) => gv.toLowerCase().includes(query))
        );
    })();

    useEffect(() => {
        if (!visible) {
            setSelectedVersion(null);
            setVersionSearch('');
            return;
        }

        if (versions.length > 0) {
            setSelectedVersion(versions[0]);
        }
    }, [visible, versions]);

    const handleInstall = async () => {
        if (!selectedVersion || !mod) return;

        setInstalling(true);
        clearFlashes(flashKey);

        try {
            await createDirectory(uuid, '/', modsDirectory.replace(/^\//, ''));
            await pullFile(uuid, {
                url: selectedVersion.downloadUrl,
                directory: modsDirectory,
                filename: selectedVersion.fileName,
                foreground: true,
            });

            addFlash({
                key: flashKey,
                type: 'success',
                message: `Successfully installed ${mod.name} (${selectedVersion.name})`,
            });
            onDismissed();
        } catch (error) {
            addFlash({
                key: flashKey,
                type: 'error',
                message: httpErrorToHuman(error),
            });
            onDismissed();
        } finally {
            setInstalling(false);
        }
    };

    if (!mod) return null;

    return (
        <Modal visible={visible} onDismissed={onDismissed} showSpinnerOverlay={installing}>
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    {mod.iconUrl ? (
                        <img src={mod.iconUrl} alt={mod.name} className={styles.modalModIcon} />
                    ) : (
                        <div className={styles.modIconPlaceholder} style={{ width: 40, height: 40 }}>
                            <FontAwesomeIcon icon={faCube} />
                        </div>
                    )}
                    <div className={styles.modalModInfo}>
                        <h3>{mod.name}</h3>
                        <p>Select a version to install</p>
                    </div>
                </div>

                {versions.length === 0 ? (
                    <div className={styles.emptyState}>
                        <p className={styles.emptyStateTitle}>No versions available</p>
                        <p className={styles.emptyStateMessage}>
                            No compatible versions found for the selected filters.
                        </p>
                    </div>
                ) : (
                    <>
                        <Input
                            type="text"
                            placeholder="Search versions..."
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
                                    <span className={styles.versionName}>{mod.name} - {cleanVersionName(version.name)}</span>
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
                                    {version.gameVersions.length > 0 && (
                                        <div className={styles.versionGameVersions}>
                                            {[...version.gameVersions].sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).slice(0, 5).map((v) => (
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
                                    )}
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
                    <Button isSecondary onClick={onDismissed} disabled={installing}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleInstall}
                        disabled={!selectedVersion || installing}
                        isLoading={installing}
                    >
                        Install
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default InstallModModal;
