import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import Modal from '@/components/elements/Modal';
import Button from '@/components/elements/Button';
import { Plugin } from '@/api/server/plugins/types';
import styles from './plugins.module.css';

interface UninstallConfirmModalProps {
    plugin: Plugin | null;
    fileName: string;
    visible: boolean;
    isUninstalling: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

const UninstallConfirmModal: React.FC<UninstallConfirmModalProps> = ({
    plugin,
    fileName,
    visible,
    isUninstalling,
    onConfirm,
    onCancel,
}) => {
    if (!plugin) return null;

    return (
        <Modal visible={visible} onDismissed={onCancel} showSpinnerOverlay={isUninstalling}>
            <div className={styles.uninstallModal}>
                <h3 className={styles.uninstallTitle}>Uninstall {plugin.name}?</h3>
                <p className={styles.uninstallMessage}>
                    This will permanently delete the following file from your plugins folder:
                </p>
                <div className={styles.uninstallFileName}>
                    {fileName}
                </div>
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
