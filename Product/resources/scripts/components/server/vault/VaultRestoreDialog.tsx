import React, { useEffect, useState } from 'react';
import useVaultTranslation from '@/components/server/vault/useVaultTranslation';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { httpErrorToHuman } from '@/api/http';
import { Carpeta, restoreVault, vaultErrorCode } from '@/api/server/vault';
import { Dialog } from '@/components/elements/dialog';
import { Button } from '@/components/elements/button/index';
import Input from '@/components/elements/Input';
import { ServerContext } from '@/state/server';
import { useVault } from '@/components/server/vault/VaultContext';
import {
    buildRestoreRequest,
    normalizeDestination,
    restoreRules,
    RestoreSource,
    StopReason,
    WipeScope,
} from '@/components/server/vault/vaultRules';
import {
    CheckRow,
    CheckText,
    ErrorText,
    FormLabel,
    HelpText,
    Mono,
    Notice,
    NoticeBody,
    Stack,
} from '@/components/server/vault/vaultStyles';

const PATHS_PREVIEW = 5;

const Summary = styled.div`
    ${tw`p-3 text-sm`};
    color: var(--color-base);
    background-color: var(--color-background);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);

    ul {
        ${tw`mt-2 flex flex-col gap-1 text-xs`};
    }
`;

const Form = styled(Stack)`
    ${tw`mt-4 gap-3`};
`;

interface Props {
    source: RestoreSource | null;
    onClose: () => void;
}

const VaultRestoreDialog = ({ source, onClose }: Props) => {
    const { t } = useVaultTranslation();
    const { uuid, resumen, startJob, interceptError, refresh } = useVault();
    const getServer = ServerContext.useStoreActions((actions) => actions.server.getServer);

    const [destino, setDestino] = useState('/');
    const [detener, setDetener] = useState(true);
    const [vaciar, setVaciar] = useState(false);
    const [encender, setEncender] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Every opening starts from the safe defaults.
    useEffect(() => {
        if (!source) return;
        setDestino('/');
        setDetener(true);
        setVaciar(false);
        setEncender(true);
        setError(null);
        setSubmitting(false);
    }, [source]);

    if (!source) {
        return <Dialog open={false} onClose={onClose} />;
    }

    const destinationValid = normalizeDestination(destino) !== null;
    const rules = restoreRules(source, destinationValid ? destino : '/', vaciar, resumen.mundos);
    const wiping = rules.canWipe && vaciar;

    const folderNames: Record<Carpeta, string> = {
        Global: t('vault.tabs.global', 'Global'),
        Mundos: t('vault.tabs.mundos', 'Mundos'),
        Backups: t('vault.tabs.backups', 'Backups'),
        'M-Backups': t('vault.tabs.m_backups', 'M-Backups'),
    };

    const stopReasons: Record<StopReason, string> = {
        worlds: t('vault.restore.stop_worlds', 'Obligatorio: se restauran mundos.'),
        whole_backup: t('vault.restore.stop_whole', 'Obligatorio: se restaura una copia entera.'),
        wipe: t('vault.restore.stop_wipe', 'Obligatorio: se borran archivos antes de restaurar.'),
    };

    const exclusions = resumen.exclusiones.length > 0 ? resumen.exclusiones.join(', ') : t('vault.restore.none', 'ninguna');
    const worlds = resumen.mundos.length > 0 ? resumen.mundos.join(', ') : t('vault.restore.none', 'ninguna');

    const wipeWarnings: Record<WipeScope, string> = {
        todo: t(
            'vault.restore.wipe_todo',
            'Se borrará TODO el servidor antes de restaurar, salvo los archivos que coinciden con las exclusiones ({{exclusions}}).',
            { exclusions }
        ),
        sin_mundos: t(
            'vault.restore.wipe_sin_mundos',
            'Se borrará todo el servidor antes de restaurar, salvo los mundos ({{worlds}}) y los archivos que coinciden con las exclusiones ({{exclusions}}).',
            { worlds, exclusions }
        ),
        mundos: t(
            'vault.restore.wipe_mundos',
            'Se borrarán las carpetas de mundo que trae la copia antes de restaurar. Mundos conocidos: {{worlds}}.',
            { worlds }
        ),
    };

    const submit = () => {
        const request = buildRestoreRequest(source, { destino, detener, vaciar, encender }, resumen.mundos);
        if (!request) {
            setError(t('vault.restore.invalid_destination', 'Indica una carpeta dentro del servidor, como / o /restaurado.'));
            return;
        }

        setSubmitting(true);
        setError(null);
        restoreVault(uuid, request)
            .then((job) => {
                startJob(job);
                onClose();
                // The panel marks the server `restoring_backup` when it stops it; pick that up.
                if (request.detener) {
                    getServer(uuid).catch((reloadError) => console.error(reloadError));
                }
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

    const origin = source.backup ? `${folderNames[source.carpeta]} › ${source.backup}` : folderNames[source.carpeta];

    return (
        <Dialog open onClose={onClose} title={t('vault.restore.title', 'Restaurar desde el Vault')} preventExternalClose={submitting}>
            <Summary>
                <strong>{origin}</strong>
                {rules.restoresEverything ? (
                    <p>
                        {source.backup
                            ? t('vault.restore.whole_backup', 'Se restaurará la copia entera.')
                            : t('vault.restore.whole_folder', 'Se restaurará todo el contenido de esta carpeta.')}
                    </p>
                ) : (
                    <ul>
                        {rules.rutas.slice(0, PATHS_PREVIEW).map((ruta) => (
                            <li key={ruta}>
                                <Mono>{ruta}</Mono>
                            </li>
                        ))}
                        {rules.rutas.length > PATHS_PREVIEW && (
                            <li>{t('vault.restore.more', 'y {{count}} más', { count: rules.rutas.length - PATHS_PREVIEW })}</li>
                        )}
                    </ul>
                )}
            </Summary>

            <Form>
                {rules.wholeOnly && source.rutas.length > 0 && (
                    <Notice $tone={'info'}>
                        <FontAwesomeIcon icon={faInfoCircle} />
                        <NoticeBody>{t('vault.backup.imported_whole', 'Las copias importadas solo se pueden restaurar enteras.')}</NoticeBody>
                    </Notice>
                )}

                <div>
                    <FormLabel htmlFor={'vault-restore-destination'}>{t('vault.restore.destination', 'Destino')}</FormLabel>
                    <Input
                        id={'vault-restore-destination'}
                        value={destino}
                        onChange={(event) => setDestino(event.currentTarget.value)}
                        hasError={!destinationValid}
                        spellCheck={false}
                    />
                    {destinationValid ? (
                        <HelpText>
                            {t(
                                'vault.restore.destination_help',
                                'Carpeta del servidor donde se escriben los archivos. Con / cada archivo vuelve a su sitio original.'
                            )}
                        </HelpText>
                    ) : (
                        <ErrorText>
                            {t('vault.restore.invalid_destination', 'Indica una carpeta dentro del servidor, como / o /restaurado.')}
                        </ErrorText>
                    )}
                </div>

                <CheckRow $disabled={rules.stopForced}>
                    <Input
                        type={'checkbox'}
                        checked={rules.stopForced || detener}
                        disabled={rules.stopForced}
                        onChange={() => setDetener((value) => !value)}
                    />
                    <CheckText>
                        {t('vault.restore.stop', 'Detener el servidor antes de restaurar')}
                        <small>
                            {rules.stopReason
                                ? stopReasons[rules.stopReason]
                                : t('vault.restore.stop_help', 'Recomendado: los plugins en marcha pueden sobrescribir lo restaurado.')}
                        </small>
                    </CheckText>
                </CheckRow>

                {rules.canWipe && (
                    <CheckRow>
                        <Input type={'checkbox'} checked={vaciar} onChange={() => setVaciar((value) => !value)} />
                        <CheckText>
                            {t('vault.restore.wipe', 'Borrar antes los archivos del servidor')}
                            <small>{t('vault.restore.wipe_help', 'Elimina los archivos que no están en la copia.')}</small>
                        </CheckText>
                    </CheckRow>
                )}

                {rules.wipeScope && wiping ? (
                    <Notice $tone={'danger'}>
                        <FontAwesomeIcon icon={faExclamationTriangle} />
                        <NoticeBody>
                            <strong>{t('vault.restore.wipe_warning_title', 'Se borrarán archivos')}</strong>
                            <p>{wipeWarnings[rules.wipeScope]}</p>
                        </NoticeBody>
                    </Notice>
                ) : (
                    <HelpText>
                        {t(
                            'vault.restore.overwrite_note',
                            'Los archivos con la misma ruta se sobrescriben; el resto de archivos del servidor se conserva.'
                        )}
                    </HelpText>
                )}

                <CheckRow>
                    <Input type={'checkbox'} checked={encender} onChange={() => setEncender((value) => !value)} />
                    <CheckText>
                        {t('vault.restore.start', 'Encender el servidor al terminar')}
                        <small>{t('vault.restore.start_help', 'Solo si estaba encendido al empezar la restauración.')}</small>
                    </CheckText>
                </CheckRow>

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
                {wiping ? (
                    <Button.Danger onClick={submit} disabled={submitting || !destinationValid}>
                        {t('vault.restore.confirm_wipe', 'Borrar y restaurar')}
                    </Button.Danger>
                ) : (
                    <Button onClick={submit} disabled={submitting || !destinationValid}>
                        {t('vault.restore.confirm', 'Restaurar')}
                    </Button>
                )}
            </Dialog.Footer>
        </Dialog>
    );
};

export default VaultRestoreDialog;
