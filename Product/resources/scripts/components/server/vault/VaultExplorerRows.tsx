import React from 'react';
import useVaultTranslation from '@/components/server/vault/useVaultTranslation';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArchive,
    faDownload,
    faEllipsisH,
    faFileAlt,
    faFileArchive,
    faFileImport,
    faFolder,
    faFolderOpen,
    faHistory,
    faThumbtack,
    faTrashAlt,
    faUndoAlt,
} from '@fortawesome/free-solid-svg-icons';
import { AlcanceBackup, Backup, Entrada, TipoBackup } from '@/api/server/vault';
import Input from '@/components/elements/Input';
import DropdownMenu from '@/components/elements/DropdownMenu';
import { formatCount, formatDateTime, formatRelative, formatBytes } from '@/components/server/vault/vaultFormat';
import {
    CenterCell,
    Chip,
    DateCell,
    EntryIcon,
    EntryName,
    KebabButton,
    MenuItem,
    Muted,
    NameButton,
    SizeCell,
    TableRow,
} from '@/components/server/vault/vaultStyles';

const NameCell = styled.div`
    ${tw`flex flex-col gap-1 min-w-0 pr-2`};
`;

const MetaLine = styled.div`
    ${tw`flex flex-wrap items-center gap-2 text-xs`};
    color: var(--color-muted);
`;

const Note = styled.span`
    ${tw`truncate italic`};
    max-width: 28rem;
`;

interface MenuProps {
    children: React.ReactNode;
    label: string;
}

const RowMenu = ({ children, label }: MenuProps) => (
    <DropdownMenu
        renderToggle={(onClick) => (
            <KebabButton type={'button'} onClick={onClick} aria-label={label} title={label}>
                <FontAwesomeIcon icon={faEllipsisH} />
            </KebabButton>
        )}
    >
        {children}
    </DropdownMenu>
);

interface EntryRowProps {
    entry: Entrada;
    selected: boolean;
    selectable: boolean;
    onToggle: () => void;
    onOpen: () => void;
    onDownload: () => void;
    /** Omitted when the user cannot restore from this place. */
    onRestore?: () => void;
}

export const EntryRow = ({ entry, selected, selectable, onToggle, onOpen, onDownload, onRestore }: EntryRowProps) => {
    const { t, locale } = useVaultTranslation();
    const isFolder = entry.tipo === 'carpeta';

    return (
        <TableRow $selected={selected}>
            <CenterCell>
                {selectable && (
                    <Input
                        type={'checkbox'}
                        checked={selected}
                        onChange={onToggle}
                        aria-label={t('vault.explorer.select', 'Seleccionar {{name}}', { name: entry.nombre })}
                    />
                )}
            </CenterCell>
            <NameButton type={'button'} onClick={isFolder ? onOpen : onDownload} title={entry.nombre}>
                <EntryIcon $folder={isFolder}>
                    <FontAwesomeIcon icon={isFolder ? faFolder : faFileAlt} />
                </EntryIcon>
                <EntryName>{entry.nombre}</EntryName>
            </NameButton>
            <SizeCell>{!isFolder || entry.bytes > 0 ? formatBytes(entry.bytes, locale) : '—'}</SizeCell>
            <DateCell title={entry.mtime ? formatDateTime(entry.mtime, locale) : undefined}>
                {entry.mtime ? formatRelative(entry.mtime, locale) : '—'}
            </DateCell>
            <CenterCell>
                <RowMenu label={t('vault.explorer.actions', 'Acciones')}>
                    {isFolder && (
                        <MenuItem type={'button'} onClick={onOpen}>
                            <FontAwesomeIcon icon={faFolderOpen} />
                            {t('vault.explorer.open', 'Abrir')}
                        </MenuItem>
                    )}
                    <MenuItem type={'button'} onClick={onDownload}>
                        <FontAwesomeIcon icon={isFolder ? faFileArchive : faDownload} />
                        {isFolder ? t('vault.explorer.download_zip', 'Descargar en ZIP') : t('vault.explorer.download', 'Descargar')}
                    </MenuItem>
                    {onRestore && (
                        <MenuItem type={'button'} onClick={onRestore}>
                            <FontAwesomeIcon icon={faUndoAlt} />
                            {t('vault.explorer.restore', 'Restaurar')}
                        </MenuItem>
                    )}
                </RowMenu>
            </CenterCell>
        </TableRow>
    );
};

interface BackupRowProps {
    entry: Entrada;
    backup: Backup;
    onOpen: () => void;
    onDownload: () => void;
    onRestore?: () => void;
    onTogglePin?: () => void;
    onDelete?: () => void;
}

export const BackupRow = ({ entry, backup, onOpen, onDownload, onRestore, onTogglePin, onDelete }: BackupRowProps) => {
    const { t, locale } = useVaultTranslation();

    const types: Record<TipoBackup, string> = {
        diaria: t('vault.backup.types.diaria', 'Diaria'),
        manual: t('vault.backup.types.manual', 'Manual'),
        importada: t('vault.backup.types.importada', 'Importada'),
    };

    const scopes: Record<AlcanceBackup, string> = {
        completa: t('vault.backup.scopes.completa', 'Servidor completo'),
        sin_mundos: t('vault.backup.scopes.sin_mundos', 'Sin mundos'),
        mundos: t('vault.backup.scopes.mundos', 'Solo mundos'),
        rutas: t('vault.backup.scopes.rutas', 'Archivos elegidos'),
    };

    const icon = backup.tipo === 'importada' ? faFileImport : backup.tipo === 'diaria' ? faHistory : faArchive;
    const size = backup.bytes || entry.bytes;

    return (
        <TableRow>
            <CenterCell>
                <EntryIcon $folder>
                    <FontAwesomeIcon icon={icon} />
                </EntryIcon>
            </CenterCell>
            <NameCell>
                <NameButton type={'button'} onClick={onOpen} title={backup.nombre}>
                    <EntryName>{backup.nombre}</EntryName>
                </NameButton>
                <MetaLine>
                    <Chip>{types[backup.tipo]}</Chip>
                    <Chip>{scopes[backup.alcance]}</Chip>
                    {backup.fijada && (
                        <Chip $tone={'info'}>
                            <FontAwesomeIcon icon={faThumbtack} />
                            {t('vault.backup.pinned', 'Fijada')}
                        </Chip>
                    )}
                    {backup.archivos > 0 && (
                        <Muted>{t('vault.backup.files', '{{files}} archivos', { files: formatCount(backup.archivos, locale) })}</Muted>
                    )}
                    {backup.autor && <Muted>{backup.autor.nombre}</Muted>}
                    {backup.nota && <Note title={backup.nota}>“{backup.nota}”</Note>}
                </MetaLine>
            </NameCell>
            <SizeCell>{size > 0 ? formatBytes(size, locale) : '—'}</SizeCell>
            <DateCell title={formatDateTime(backup.creado_ts, locale)}>{formatRelative(backup.creado_ts, locale)}</DateCell>
            <CenterCell>
                <RowMenu label={t('vault.explorer.actions', 'Acciones')}>
                    <MenuItem type={'button'} onClick={onOpen}>
                        <FontAwesomeIcon icon={faFolderOpen} />
                        {t('vault.backup.browse', 'Explorar')}
                    </MenuItem>
                    {onRestore && (
                        <MenuItem type={'button'} onClick={onRestore}>
                            <FontAwesomeIcon icon={faUndoAlt} />
                            {t('vault.backup.restore', 'Restaurar copia')}
                        </MenuItem>
                    )}
                    <MenuItem type={'button'} onClick={onDownload}>
                        <FontAwesomeIcon icon={faFileArchive} />
                        {t('vault.explorer.download_zip', 'Descargar en ZIP')}
                    </MenuItem>
                    {onTogglePin && (
                        <MenuItem type={'button'} onClick={onTogglePin}>
                            <FontAwesomeIcon icon={faThumbtack} />
                            {backup.fijada ? t('vault.backup.unpin', 'Desfijar') : t('vault.backup.pin', 'Fijar')}
                        </MenuItem>
                    )}
                    {onDelete && (
                        <MenuItem
                            type={'button'}
                            $danger
                            onClick={onDelete}
                            disabled={backup.fijada}
                            title={backup.fijada ? t('vault.backup.unpin_first', 'Desfíjala antes de borrarla') : undefined}
                        >
                            <FontAwesomeIcon icon={faTrashAlt} />
                            {t('vault.backup.delete', 'Borrar')}
                        </MenuItem>
                    )}
                </RowMenu>
            </CenterCell>
        </TableRow>
    );
};
