import React, { useEffect, useState } from 'react';
import useVaultTranslation from '@/components/server/vault/useVaultTranslation';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { httpErrorToHuman } from '@/api/http';
import { AlcanceBackup, createVaultBackup, vaultErrorCode } from '@/api/server/vault';
import { Dialog } from '@/components/elements/dialog';
import { Button } from '@/components/elements/button/index';
import Input, { Textarea } from '@/components/elements/Input';
import { useVault } from '@/components/server/vault/VaultContext';
import { CheckRow, CheckText, FormLabel, HelpText, Notice, NoticeBody, Stack } from '@/components/server/vault/vaultStyles';

/** Notes are short labels; the vault keeps similar free-text fields at 200 characters. */
export const MAX_NOTE_LENGTH = 200;

type WholeScope = Exclude<AlcanceBackup, 'rutas'>;

const Form = styled(Stack)`
    ${tw`mt-2 gap-3`};
`;

interface Props {
    open: boolean;
    onClose: () => void;
}

const VaultCreateBackupDialog = ({ open, onClose }: Props) => {
    const { t } = useVaultTranslation();
    const { uuid, resumen, startJob, interceptError, refresh } = useVault();
    const [alcance, setAlcance] = useState<WholeScope>('completa');
    const [nota, setNota] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setAlcance('completa');
        setNota('');
        setError(null);
        setSubmitting(false);
    }, [open]);

    const scopes: Array<{ id: WholeScope; label: string; help: string }> = [
        {
            id: 'completa',
            label: t('vault.create.scope_completa', 'Servidor completo'),
            help: t('vault.create.scope_completa_help', 'Todos los archivos del servidor, mundos incluidos.'),
        },
        {
            id: 'sin_mundos',
            label: t('vault.create.scope_sin_mundos', 'Sin mundos'),
            help: t('vault.create.scope_sin_mundos_help', 'Plugins, configuración y todo lo demás, sin las carpetas de mundo.'),
        },
        {
            id: 'mundos',
            label: t('vault.create.scope_mundos', 'Solo mundos'),
            help: t('vault.create.scope_mundos_help', 'Solo las carpetas de mundo.'),
        },
    ];

    const submit = () => {
        setSubmitting(true);
        setError(null);
        const note = nota.trim();

        createVaultBackup(uuid, { alcance, nota: note || undefined })
            .then((job) => {
                startJob(job);
                onClose();
            })
            .catch((requestError) => {
                setSubmitting(false);
                if (interceptError(requestError)) {
                    onClose();
                    return;
                }
                if (vaultErrorCode(requestError) === 'ocupado') refresh();
                setError(httpErrorToHuman(requestError));
            });
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            title={t('vault.create.title', 'Crear una M-Backup')}
            description={t(
                'vault.create.description',
                'Una copia manual que se guarda en M-Backups hasta que alguien con nivel Gestionar la borre.'
            )}
            preventExternalClose={submitting}
        >
            <Form>
                {resumen.cuota.superada && (
                    <Notice $tone={'danger'}>
                        <FontAwesomeIcon icon={faExclamationTriangle} />
                        <NoticeBody>
                            {t('vault.create.quota_exceeded', 'La cuota de almacenamiento está superada, así que el Vault rechazará copias nuevas.')}
                        </NoticeBody>
                    </Notice>
                )}
                <div role={'radiogroup'} aria-label={t('vault.create.scope', 'Qué copiar')}>
                    <FormLabel as={'span'}>{t('vault.create.scope', 'Qué copiar')}</FormLabel>
                    <Stack css={tw`gap-2`}>
                        {scopes.map((scope) => (
                            <CheckRow key={scope.id}>
                                <Input
                                    type={'radio'}
                                    name={'vault-backup-scope'}
                                    value={scope.id}
                                    checked={alcance === scope.id}
                                    onChange={() => setAlcance(scope.id)}
                                />
                                <CheckText>
                                    {scope.label}
                                    <small>{scope.help}</small>
                                </CheckText>
                            </CheckRow>
                        ))}
                    </Stack>
                </div>
                <div>
                    <FormLabel htmlFor={'vault-backup-note'}>{t('vault.create.note', 'Nota (opcional)')}</FormLabel>
                    <Textarea
                        id={'vault-backup-note'}
                        rows={2}
                        maxLength={MAX_NOTE_LENGTH}
                        value={nota}
                        onChange={(event) => setNota(event.currentTarget.value)}
                        placeholder={t('vault.create.note_placeholder', 'Antes de actualizar a la 1.21')}
                    />
                    <HelpText>
                        {nota.length} / {MAX_NOTE_LENGTH}
                    </HelpText>
                </div>
                {error && (
                    <Notice $tone={'danger'}>
                        <FontAwesomeIcon icon={faExclamationTriangle} />
                        <NoticeBody>{error}</NoticeBody>
                    </Notice>
                )}
            </Form>
            <Dialog.Footer>
                <Button.Text onClick={onClose} disabled={submitting}>
                    {t('vault.actions.cancel', 'Cancelar')}
                </Button.Text>
                <Button onClick={submit} disabled={submitting}>
                    {t('vault.create.submit', 'Crear M-Backup')}
                </Button>
            </Dialog.Footer>
        </Dialog>
    );
};

export default VaultCreateBackupDialog;
