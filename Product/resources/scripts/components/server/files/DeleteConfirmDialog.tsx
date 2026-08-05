import React, { useContext } from 'react';
import tw from 'twin.macro';
import styled from 'styled-components/macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { Button } from '@/components/elements/button/index';
import { Dialog, DialogContext } from '@/components/elements/dialog';
import { useDeepCompareEffect } from '@/plugins/useDeepCompareEffect';

interface DeleteConfirmDialogProps {
    visible: boolean;
    itemName: string;
    isFile: boolean;
    trashEnabled?: boolean;
    onMoveToTrash: () => void;
    onPermanentDelete: () => void;
    onCancel: () => void;
}

const CustomFooter = ({ children }: { children: React.ReactNode }) => {
    const { setFooter } = useContext(DialogContext);

    useDeepCompareEffect(() => {
        setFooter(
            <div 
                className={'px-6 py-4 flex items-center justify-between'} 
                style={{ 
                    backgroundColor: 'var(--color-neutral)', 
                    borderBottomLeftRadius: 'var(--border-radius, 12px)',
                    borderBottomRightRadius: 'var(--border-radius, 12px)'
                }}
            >
                {children}
            </div>
        );
    }, [children]);

    return null;
};

const Message = styled.p`
    ${tw`text-sm mt-4`};
    color: var(--color-muted);

    strong {
        color: var(--color-base);
        font-weight: 600;
    }
`;

const ActionButtons = styled.div`
    ${tw`flex items-center gap-2`};
`;

const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
    visible,
    itemName,
    isFile,
    trashEnabled = true,
    onMoveToTrash,
    onPermanentDelete,
    onCancel,
}) => {
    return (
        <Dialog
            open={visible}
            onClose={onCancel}
            title={`Delete ${isFile ? 'File' : 'Folder'}`}
        >
            <Message>
                Are you sure you want to delete <strong>{itemName}</strong>?
            </Message>
            <CustomFooter>
                <Button.Text onClick={onCancel}>Cancel</Button.Text>
                <ActionButtons>
                    <Button onClick={trashEnabled ? onMoveToTrash : onPermanentDelete}>
                        <FontAwesomeIcon icon={faTrash} className="mr-2" />
                        {trashEnabled ? 'Trash' : 'Delete'}
                    </Button>
                </ActionButtons>
            </CustomFooter>
        </Dialog>
    );
};

export default DeleteConfirmDialog;
