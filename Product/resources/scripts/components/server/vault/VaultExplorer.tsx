import React, { useEffect, useState } from 'react';
import useVaultTranslation from '@/components/server/vault/useVaultTranslation';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight, faDownload, faLevelUpAlt, faSyncAlt, faUndoAlt } from '@fortawesome/free-solid-svg-icons';
import { httpErrorToHuman } from '@/api/http';
import {
    Backup,
    Carpeta,
    Cursor,
    deleteVaultBackup,
    Entrada,
    getVaultDownloadUrl,
    getVaultZipUrl,
    listVault,
    pinVaultBackup,
} from '@/api/server/vault';
import { Button } from '@/components/elements/button/index';
import { Dialog } from '@/components/elements/dialog';
import Input from '@/components/elements/Input';
import Spinner from '@/components/elements/Spinner';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import EmptyState from '@/components/elements/EmptyState';
import Panel from '@/components/elements/ui/Panel';
import { useVault } from '@/components/server/vault/VaultContext';
import { BackupRow, EntryRow } from '@/components/server/vault/VaultExplorerRows';
import { isBackupFolder, joinPath, parentPath, pathSegments, splitBackupPath } from '@/components/server/vault/vaultRules';
import {
    ButtonLabel,
    CenterCell,
    DateCell,
    Footer,
    Notice,
    NoticeBody,
    PlainButton,
    SizeCell,
    TableHeader,
    Toolbar,
    ToolbarGroup,
} from '@/components/server/vault/vaultStyles';

const PAGE_SIZE = 200;

const Crumbs = styled.nav`
    ${tw`flex flex-wrap items-center gap-1 min-w-0 text-sm`};
    color: var(--color-muted);

    svg {
        font-size: 0.6rem;
    }
`;

const Crumb = styled.button<{ $current?: boolean }>`
    ${tw`px-1 truncate`};
    max-width: 16rem;
    color: ${({ $current }) => ($current ? 'var(--color-base)' : 'var(--color-muted)')};
    font-weight: ${({ $current }) => ($current ? 600 : 400)};

    &:hover:not(:disabled) {
        color: var(--color-primary);
    }
`;

const Body = styled.div`
    ${tw`relative`};
    min-height: 8rem;
`;

const Padded = styled.div`
    ${tw`p-4`};
`;

interface ListingState {
    status: 'loading' | 'ready' | 'error';
    entradas: Entrada[];
    total: number;
    siguiente: Cursor | null;
    error: string | null;
}

const EMPTY_LISTING: ListingState = { status: 'loading', entradas: [], total: 0, siguiente: null, error: null };

interface Props {
    carpeta: Carpeta;
    /** Folder relative to the carpeta; in Backups / M-Backups it starts with the copy name. */
    ruta: string;
    onNavigate: (ruta: string) => void;
}

const VaultExplorer = ({ carpeta, ruta, onNavigate }: Props) => {
    const { t } = useVaultTranslation();
    const vault = useVault();
    const { uuid, canRestore, canManage, isVaultAdmin, jobActive, listingVersion, interceptError, reportError } = vault;

    const [listing, setListing] = useState<ListingState>(EMPTY_LISTING);
    const [selected, setSelected] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [retry, setRetry] = useState(0);
    const [pendingDelete, setPendingDelete] = useState<Backup | null>(null);
    // Metadata of copies seen at the root, to know the type of the copy being browsed.
    const [knownBackups, setKnownBackups] = useState<Record<string, Backup>>({});

    const copies = isBackupFolder(carpeta);
    const atCopiesRoot = copies && ruta === '';
    const { backup: currentBackup, rest: pathInCopy } = copies ? splitBackupPath(ruta) : { backup: null, rest: ruta };
    const currentBackupMeta = currentBackup ? knownBackups[currentBackup] : undefined;
    const importedCopy = currentBackupMeta?.tipo === 'importada';

    const rememberBackups = (entradas: Entrada[]) => {
        const found = entradas.filter((entry) => entry.backup !== null);
        if (found.length === 0) return;

        setKnownBackups((current) =>
            found.reduce((all, entry) => ({ ...all, [entry.nombre]: entry.backup as Backup }), current)
        );
    };

    useEffect(() => {
        let cancelled = false;
        setSelected([]);
        setListing((current) => ({ ...current, status: 'loading', error: null }));

        listVault(uuid, { carpeta, ruta, limite: PAGE_SIZE })
            .then((result) => {
                if (cancelled) return;
                rememberBackups(result.entradas);
                setListing({ status: 'ready', entradas: result.entradas, total: result.total, siguiente: result.siguiente, error: null });
            })
            .catch((error) => {
                if (cancelled || interceptError(error)) return;
                setListing({ ...EMPTY_LISTING, status: 'error', error: httpErrorToHuman(error) });
            });

        return () => {
            cancelled = true;
        };
    }, [uuid, carpeta, ruta, listingVersion, retry]);

    const loadMore = () => {
        if (listing.siguiente === null) return;

        setLoadingMore(true);
        listVault(uuid, { carpeta, ruta, cursor: listing.siguiente, limite: PAGE_SIZE })
            .then((result) => {
                rememberBackups(result.entradas);
                setListing((current) => ({
                    ...current,
                    entradas: [...current.entradas, ...result.entradas],
                    total: result.total,
                    siguiente: result.siguiente,
                }));
            })
            .catch(reportError)
            .then(() => setLoadingMore(false));
    };

    const startDownload = (request: () => Promise<string>) => {
        setBusy(true);
        request()
            .then((url) => {
                window.location.href = url;
            })
            .catch(reportError)
            .then(() => setBusy(false));
    };

    const downloadEntry = (entry: Entrada) => {
        const target = joinPath(ruta, entry.nombre);
        startDownload(() =>
            entry.tipo === 'carpeta'
                ? getVaultZipUrl(uuid, { carpeta, ruta: target })
                : getVaultDownloadUrl(uuid, carpeta, target)
        );
    };

    const downloadSelection = () => {
        const single = selected.length === 1 ? listing.entradas.find((entry) => entry.nombre === selected[0]) : undefined;
        if (single && single.tipo === 'archivo') {
            downloadEntry(single);
            return;
        }

        startDownload(() => getVaultZipUrl(uuid, { carpeta, ruta, nombres: selected }));
    };

    /** Opens the restore dialog for names inside the current folder ([] = the folder itself). */
    const restore = (names: string[]) => {
        const base = copies ? pathInCopy : ruta;
        const rutas = names.length > 0 ? names.map((name) => joinPath(base, name)) : base ? [base] : [];

        vault.openRestore({
            carpeta,
            backup: copies ? currentBackup : null,
            backupType: currentBackupMeta?.tipo ?? null,
            rutas,
        });
    };

    const updateBackup = (updated: Backup) =>
        setListing((current) => ({
            ...current,
            entradas: current.entradas.map((entry) =>
                entry.nombre === updated.nombre ? { ...entry, backup: updated } : entry
            ),
        }));

    const togglePin = (backup: Backup) => {
        if (!isBackupFolder(carpeta)) return;

        setBusy(true);
        pinVaultBackup(uuid, carpeta, backup.nombre, !backup.fijada)
            .then(updateBackup)
            .catch(reportError)
            .then(() => setBusy(false));
    };

    const confirmDelete = () => {
        const backup = pendingDelete;
        setPendingDelete(null);
        if (!backup || !isBackupFolder(carpeta)) return;

        setBusy(true);
        deleteVaultBackup(uuid, carpeta, backup.nombre)
            .then(() => {
                setListing((current) => ({
                    ...current,
                    entradas: current.entradas.filter((entry) => entry.nombre !== backup.nombre),
                    total: Math.max(0, current.total - 1),
                }));
                vault.refresh();
            })
            .catch(reportError)
            .then(() => setBusy(false));
    };

    const canDeleteHere = carpeta === 'M-Backups' ? canManage : carpeta === 'Backups' ? isVaultAdmin : false;
    const restoreAllowed = canRestore && !jobActive && !vault.serverLocked;
    const selectable = !atCopiesRoot;
    const allSelected = listing.entradas.length > 0 && selected.length === listing.entradas.length;

    const folderLabel: Record<Carpeta, string> = {
        Global: t('vault.tabs.global', 'Global'),
        Mundos: t('vault.tabs.mundos', 'Mundos'),
        Backups: t('vault.tabs.backups', 'Backups'),
        'M-Backups': t('vault.tabs.m_backups', 'M-Backups'),
    };

    const segments = pathSegments(ruta);

    return (
        <Panel>
            <Toolbar>
                <Crumbs aria-label={t('vault.explorer.location', 'Ubicación')}>
                    <Crumb type={'button'} $current={segments.length === 0} onClick={() => onNavigate('')}>
                        {folderLabel[carpeta]}
                    </Crumb>
                    {segments.map((segment, index) => (
                        <React.Fragment key={`${index}:${segment}`}>
                            <FontAwesomeIcon icon={faChevronRight} />
                            <Crumb
                                type={'button'}
                                $current={index === segments.length - 1}
                                onClick={() => onNavigate(segments.slice(0, index + 1).join('/'))}
                            >
                                {segment}
                            </Crumb>
                        </React.Fragment>
                    ))}
                </Crumbs>
                <ToolbarGroup>
                    {selected.length > 0 ? (
                        <>
                            <PlainButton type={'button'} onClick={() => setSelected([])}>
                                {t('vault.explorer.selected', 'Seleccionados: {{count}}', { count: selected.length })}
                            </PlainButton>
                            <Button size={Button.Sizes.Small} variant={Button.Variants.Secondary} onClick={downloadSelection}>
                                <FontAwesomeIcon icon={faDownload} />
                                <ButtonLabel>{t('vault.explorer.download', 'Descargar')}</ButtonLabel>
                            </Button>
                            {restoreAllowed && !importedCopy && (
                                <Button size={Button.Sizes.Small} onClick={() => restore(selected)}>
                                    <FontAwesomeIcon icon={faUndoAlt} />
                                    <ButtonLabel>{t('vault.explorer.restore_selected', 'Restaurar selección')}</ButtonLabel>
                                </Button>
                            )}
                        </>
                    ) : (
                        !atCopiesRoot && (
                            <>
                                <Button
                                    size={Button.Sizes.Small}
                                    variant={Button.Variants.Secondary}
                                    onClick={() => startDownload(() => getVaultZipUrl(uuid, { carpeta, ruta }))}
                                    disabled={listing.entradas.length === 0}
                                >
                                    <FontAwesomeIcon icon={faDownload} />
                                    <ButtonLabel>{t('vault.explorer.download_folder', 'Descargar carpeta')}</ButtonLabel>
                                </Button>
                                {restoreAllowed && (!importedCopy || pathInCopy === '') && (
                                    <Button size={Button.Sizes.Small} onClick={() => restore([])}>
                                        <FontAwesomeIcon icon={faUndoAlt} />
                                        <ButtonLabel>
                                            {(copies ? pathInCopy : ruta) === ''
                                                ? copies
                                                    ? t('vault.backup.restore', 'Restaurar copia')
                                                    : t('vault.explorer.restore_all', 'Restaurar todo')
                                                : t('vault.explorer.restore_folder', 'Restaurar esta carpeta')}
                                        </ButtonLabel>
                                    </Button>
                                )}
                            </>
                        )
                    )}
                    <PlainButton
                        type={'button'}
                        onClick={() => setRetry((value) => value + 1)}
                        title={t('vault.explorer.refresh', 'Actualizar')}
                        aria-label={t('vault.explorer.refresh', 'Actualizar')}
                    >
                        <FontAwesomeIcon icon={faSyncAlt} spin={listing.status === 'loading'} />
                    </PlainButton>
                </ToolbarGroup>
            </Toolbar>

            {importedCopy && (
                <Padded>
                    <Notice $tone={'info'}>
                        <NoticeBody>
                            {t('vault.backup.imported_whole', 'Las copias importadas solo se pueden restaurar enteras.')}
                        </NoticeBody>
                    </Notice>
                </Padded>
            )}

            <Body>
                <SpinnerOverlay visible={busy} />
                {listing.status === 'loading' && listing.entradas.length === 0 ? (
                    <Padded>
                        <Spinner centered={false} size={'base'} />
                    </Padded>
                ) : listing.status === 'error' ? (
                    <Padded>
                        <Notice $tone={'danger'}>
                            <NoticeBody>{listing.error}</NoticeBody>
                            <Button size={Button.Sizes.Small} onClick={() => setRetry((value) => value + 1)}>
                                {t('vault.actions.retry', 'Reintentar')}
                            </Button>
                        </Notice>
                    </Padded>
                ) : (
                    <>
                        <TableHeader>
                            <CenterCell>
                                {selectable && listing.entradas.length > 0 && (
                                    <Input
                                        type={'checkbox'}
                                        checked={allSelected}
                                        onChange={() =>
                                            setSelected(allSelected ? [] : listing.entradas.map((entry) => entry.nombre))
                                        }
                                        aria-label={t('vault.explorer.select_all', 'Seleccionar todo')}
                                    />
                                )}
                            </CenterCell>
                            <div>{t('vault.explorer.name', 'Nombre')}</div>
                            <SizeCell>{t('vault.explorer.size', 'Tamaño')}</SizeCell>
                            <DateCell>
                                {atCopiesRoot ? t('vault.explorer.created', 'Creada') : t('vault.explorer.modified', 'Modificado')}
                            </DateCell>
                            <div />
                        </TableHeader>
                        {ruta !== '' && (
                            <PlainButton type={'button'} onClick={() => onNavigate(parentPath(ruta))} css={tw`w-full px-4 py-2`}>
                                <FontAwesomeIcon icon={faLevelUpAlt} />
                                {t('vault.explorer.up', 'Subir un nivel')}
                            </PlainButton>
                        )}
                        {listing.entradas.length === 0 ? (
                            <Padded>
                                <EmptyState
                                    title={
                                        atCopiesRoot
                                            ? t('vault.explorer.no_backups_title', 'Todavía no hay copias')
                                            : t('vault.explorer.empty_title', 'Carpeta vacía')
                                    }
                                    message={
                                        atCopiesRoot
                                            ? carpeta === 'Backups'
                                                ? t('vault.explorer.no_daily', 'Las copias diarias aparecerán aquí tras la primera ejecución nocturna.')
                                                : t('vault.explorer.no_manual', 'Aquí aparecerán las M-Backups que crees.')
                                            : t('vault.explorer.empty_message', 'No hay nada en esta carpeta.')
                                    }
                                />
                            </Padded>
                        ) : (
                            listing.entradas.map((entry) =>
                                atCopiesRoot && entry.backup ? (
                                    <BackupRow
                                        key={entry.nombre}
                                        entry={entry}
                                        backup={entry.backup}
                                        onOpen={() => onNavigate(entry.nombre)}
                                        onDownload={() => startDownload(() => getVaultZipUrl(uuid, { carpeta, ruta: entry.nombre }))}
                                        onRestore={
                                            restoreAllowed
                                                ? () =>
                                                      vault.openRestore({
                                                          carpeta,
                                                          backup: entry.nombre,
                                                          backupType: entry.backup ? entry.backup.tipo : null,
                                                          rutas: [],
                                                      })
                                                : undefined
                                        }
                                        onTogglePin={canManage ? () => entry.backup && togglePin(entry.backup) : undefined}
                                        onDelete={canDeleteHere ? () => setPendingDelete(entry.backup) : undefined}
                                    />
                                ) : (
                                    <EntryRow
                                        key={entry.nombre}
                                        entry={entry}
                                        selectable={selectable}
                                        selected={selected.indexOf(entry.nombre) !== -1}
                                        onToggle={() =>
                                            setSelected((current) =>
                                                current.indexOf(entry.nombre) !== -1
                                                    ? current.filter((name) => name !== entry.nombre)
                                                    : [...current, entry.nombre]
                                            )
                                        }
                                        onOpen={() => onNavigate(joinPath(ruta, entry.nombre))}
                                        onDownload={() => downloadEntry(entry)}
                                        onRestore={restoreAllowed && !importedCopy ? () => restore([entry.nombre]) : undefined}
                                    />
                                )
                            )
                        )}
                    </>
                )}
            </Body>

            {listing.status === 'ready' && listing.entradas.length > 0 && (
                <Footer>
                    <span>
                        {t('vault.explorer.showing', 'Mostrando {{shown}} de {{total}}', {
                            shown: listing.entradas.length,
                            total: Math.max(listing.total, listing.entradas.length),
                        })}
                    </span>
                    {listing.siguiente !== null && (
                        <Button size={Button.Sizes.Small} variant={Button.Variants.Secondary} onClick={loadMore} disabled={loadingMore}>
                            {t('vault.explorer.load_more', 'Cargar más')}
                        </Button>
                    )}
                </Footer>
            )}

            <Dialog.Confirm
                open={pendingDelete !== null}
                onClose={() => setPendingDelete(null)}
                title={t('vault.backup.delete_title', 'Borrar copia')}
                confirm={t('vault.backup.delete', 'Borrar')}
                onConfirmed={confirmDelete}
            >
                {t(
                    'vault.backup.delete_confirm',
                    '¿Borrar {{name}} para siempre? Una copia borrada no se puede recuperar.',
                    { name: pendingDelete ? pendingDelete.nombre : '' }
                )}
            </Dialog.Confirm>
        </Panel>
    );
};

export default VaultExplorer;
