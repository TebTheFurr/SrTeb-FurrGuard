import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faTrash } from '@fortawesome/free-solid-svg-icons';
import Modal from '@/components/elements/Modal';
import Button from '@/components/elements/Button';
import styles from './mods.module.css';

const UninstallConfirmModal = ({ mod, fileName, visible, isUninstalling, onConfirm, onCancel }) => {
    if (!mod) return null;

    return (
        <Modal visible={visible} onDismissed={onCancel} showSpinnerOverlay={isUninstalling}>
            <div className={styles.uninstallModal}>
                <div className={styles.uninstallIcon}>
                    <FontAwesomeIcon icon={faExclamationTriangle} />
                </div>
                <h3 className={styles.uninstallTitle}>Uninstall {mod.name}?</h3>
                <p className={styles.uninstallMessage}>
                    This will permanently delete the following file from your mods folder:
                </p>
                <div className={styles.uninstallFileName}>
                    {fileName}
                </div>
                <p className={styles.uninstallWarning}>
                    This action cannot be undone.
                </p>
                <div className={styles.uninstallActions}>
                    <Button isSecondary onClick={onCancel} disabled={isUninstalling}>
                        Cancel
                    </Button>
                    <Button
                        color="red"
                        onClick={onConfirm}
                        disabled={isUninstalling}
                        isLoading={isUninstalling}
                    >
                        <FontAwesomeIcon icon={faTrash} style={{ marginRight: 8 }} />
                        Uninstall
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default UninstallConfirmModal;
