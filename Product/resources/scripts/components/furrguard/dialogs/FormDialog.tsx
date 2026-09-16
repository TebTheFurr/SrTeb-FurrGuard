import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { Dialog } from '@/components/elements/dialog';
import { Button } from '@/components/elements/button/index';
import { FormLabel, HelpText, ErrorText, Notice, NoticeBody, Stack } from '@/components/server/vault/vaultStyles';
import { PendingConfirm } from '@/components/furrguard/hooks';
import { errorMessage } from '@/components/furrguard/lib/format';

/*
 * The one dialog shape of the FurrGuard page: a form with fields, an error line and a
 * cancel/submit footer. `onSubmit` may throw: its message is shown inside the dialog.
 */

export interface FormDialogProps {
    open: boolean;
    title: string;
    description?: string;
    submitLabel?: string;
    danger?: boolean;
    /** Disables the submit button (client-side validation). */
    invalid?: boolean;
    onClose: () => void;
    onSubmit: () => Promise<void>;
    children: React.ReactNode;
}

export const FormDialog = ({ open, title, description, submitLabel = 'Guardar', danger, invalid, onClose, onSubmit, children }: FormDialogProps) => {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        if (saving || invalid) return;
        setSaving(true);
        setError(null);
        onSubmit()
            .catch((e) => setError(errorMessage(e, 'No se pudo guardar.')))
            .then(() => setSaving(false));
    };

    const close = () => {
        if (saving) return;
        setError(null);
        onClose();
    };

    const SubmitButton = danger ? Button.Danger : Button;

    return (
        <Dialog open={open} onClose={close} title={title} description={description} preventExternalClose={saving}>
            <form onSubmit={submit} noValidate>
                <Stack className={'mt-2'}>
                    {children}
                    {error && (
                        <Notice $tone={'danger'} role={'alert'}>
                            <FontAwesomeIcon icon={faExclamationTriangle} />
                            <NoticeBody>{error}</NoticeBody>
                        </Notice>
                    )}
                </Stack>
                <Dialog.Footer>
                    <Button.Text type={'button'} onClick={close} disabled={saving}>
                        Cancelar
                    </Button.Text>
                    <SubmitButton type={'submit'} disabled={saving || invalid}>
                        {saving ? 'Guardando…' : submitLabel}
                    </SubmitButton>
                </Dialog.Footer>
            </form>
        </Dialog>
    );
};

export interface FieldProps {
    label: string;
    htmlFor?: string;
    help?: string;
    error?: string | null;
    optional?: boolean;
    children: React.ReactNode;
}

/** Label + control + help/error line. */
export const Field = ({ label, htmlFor, help, error, optional, children }: FieldProps) => (
    <div>
        <FormLabel htmlFor={htmlFor}>
            {label}
            {optional && <span className={'ml-1 normal-case tracking-normal font-normal opacity-70'}>(opcional)</span>}
        </FormLabel>
        {children}
        {error ? <ErrorText role={'alert'}>{error}</ErrorText> : help ? <HelpText>{help}</HelpText> : null}
    </div>
);

/** The confirmation dialog of `useConfirm()`. */
export const ConfirmDialog = ({ pending, onSettle }: { pending: PendingConfirm | null; onSettle: (confirmed: boolean) => void }) => (
    <Dialog.Confirm
        open={pending !== null}
        title={pending?.title ?? ''}
        confirm={pending?.confirmText ?? 'Confirmar'}
        onClose={() => onSettle(false)}
        onConfirmed={() => onSettle(true)}
    >
        {pending?.message ?? ''}
    </Dialog.Confirm>
);
