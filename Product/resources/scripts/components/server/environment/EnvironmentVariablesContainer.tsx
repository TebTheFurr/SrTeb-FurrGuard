import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ServerContext } from '@/state/server';
import PageContentBlock from '@/components/elements/PageContentBlock';
import tw from 'twin.macro';
import styled from 'styled-components/macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faChevronDown,
    faCopy,
    faDownload,
    faEllipsisV,
    faEye,
    faEyeSlash,
    faFileImport,
    faPen,
    faPlus,
    faSyncAlt,
    faTrash,
} from '@fortawesome/free-solid-svg-icons';
import http from '@/api/http';
import useFlash from '@/plugins/useFlash';
import FlashMessageRender from '@/components/FlashMessageRender';
import Spinner from '@/components/elements/Spinner';
import Button from '@/components/elements/Button';
import Modal from '@/components/elements/Modal';
import { ApplicationStore } from '@/state';
import { useStoreState } from 'easy-peasy';
import { useHistory, useLocation } from 'react-router-dom';
import { join } from 'pathe';
import { encodePathSegments } from '@/helpers';
import { useTranslation } from 'react-i18next';

type EnvironmentType = 'all' | 'production' | 'local' | 'test' | 'development' | 'other';

interface EnvFileData {
    name: string;
    type: Exclude<EnvironmentType, 'all'>;
    exists: boolean;
    variables: Record<string, string>;
}

interface ApiResponse {
    files: EnvFileData[];
    directory?: string;
    accessMode: {
        file: boolean;
        sidebar: boolean;
    };
}

const Card = styled.div`
    background: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 12px);
    padding: 1.25rem;
`;

const SectionTitle = styled.h2`
    ${tw`text-sm font-semibold mb-3`};
    color: var(--color-base);
`;

const Field = styled.input`
    width: 100%;
    min-height: 2.5rem;
    height: 2.5rem;
    background: var(--color-background);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    color: var(--color-base);
    padding: 0.625rem 0.75rem;
    font-size: 0.875rem;
    outline: none;
    transition: border-color 150ms ease;

    &:focus {
        border-color: var(--color-primary);
    }
`;

const FieldSelectWrap = styled.div`
    position: relative;
`;

const FieldSelect = styled.select`
    width: 100%;
    min-height: 2.5rem;
    height: 2.5rem;
    background: var(--color-background);
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    color: var(--color-base);
    padding: 0.625rem 0.75rem;
    font-size: 0.875rem;
    padding-right: 2.6rem;
    outline: none;
    transition: border-color 150ms ease;

    &:focus {
        border-color: var(--color-primary);
    }
`;

const FieldSelectIcon = styled(FontAwesomeIcon)`
    position: absolute;
    right: 0.9rem;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    color: var(--color-muted);
    font-size: 0.75rem;
`;

const SelectField = ({
    children,
    ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) => (
    <FieldSelectWrap>
        <FieldSelect {...props}>{children}</FieldSelect>
        <FieldSelectIcon icon={faChevronDown} />
    </FieldSelectWrap>
);

const FieldTextArea = styled.textarea`
    width: 100%;
    min-height: 9rem;
    background: var(--color-background);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    color: var(--color-base);
    padding: 0.75rem;
    font-size: 0.875rem;
    outline: none;
    resize: vertical;
    transition: border-color 150ms ease;

    &:focus {
        border-color: var(--color-primary);
    }
`;

const VariablesGrid = styled.div`
    display: grid;
    grid-template-columns: minmax(180px, 1fr) minmax(160px, 1fr) minmax(80px, 0.6fr) auto;
    gap: 0.75rem;
    align-items: center;

    @media (max-width: 960px) {
        grid-template-columns: 1fr;
    }
`;

const VariableRowContent = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    @media (min-width: 960px) {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
    }
`;

const VariableRowLeft = styled.div`
    min-width: 0;

    @media (min-width: 960px) {
        flex: 0 0 14rem;
    }
`;

const VariableRowMiddle = styled.div`
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    min-width: 0;

    @media (min-width: 960px) {
        flex: 1 1 auto;
        display: grid;
        grid-template-columns: minmax(240px, 1fr) minmax(130px, 10rem);
        gap: 0.7rem;
        align-items: center;
    }
`;

const VariableRowRight = styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;
    justify-content: flex-start;

    @media (min-width: 960px) {
        flex: 0 0 auto;
        justify-content: flex-end;
    }
`;

const Row = styled.div`
    border: 1px solid var(--color-neutral);
    background: var(--color-background);
    border-radius: var(--border-radius, 10px);
    padding: 0.85rem;
`;

const RowValue = styled.code`
    display: block;
    min-height: 2.5rem;
    height: 2.5rem;
    line-height: 1.2;
    background: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    color: var(--color-base);
    padding: 0.625rem 0.75rem;
    font-size: 0.8rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
`;

const ActionIconButton = styled.button`
    width: 2.5rem;
    height: 2.5rem;
    border-radius: var(--border-radius, 8px);
    border: 1px solid var(--color-neutral);
    background: var(--color-background-secondary);
    color: var(--color-muted);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 150ms ease;

    &:hover {
        color: var(--color-base);
        border-color: var(--color-primary);
    }
`;

const ActionsMenuWrap = styled.div`
    position: relative;
`;

const ActionsMenuButton = styled.button`
    width: 2.5rem;
    height: 2.5rem;
    border-radius: var(--border-radius, 8px);
    border: 1px solid var(--color-neutral);
    background: var(--color-background-secondary);
    color: var(--color-muted);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: all 150ms ease;

    &:hover {
        color: var(--color-base);
        border-color: var(--color-primary);
    }
`;

const ActionsMenu = styled.div`
    position: absolute;
    right: 0;
    top: calc(100% + 0.45rem);
    min-width: 9.5rem;
    z-index: 30;
    border-radius: var(--border-radius, 8px);
    border: 1px solid var(--color-neutral);
    background: var(--color-background-secondary);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.35);
    padding: 0.35rem;
`;

const ActionsMenuItem = styled.button<{ $danger?: boolean }>`
    width: 100%;
    min-height: 2.5rem;
    height: 2.5rem;
    border: none;
    background: transparent;
    color: ${(props) => (props.$danger ? '#f87171' : 'var(--color-base)')};
    border-radius: var(--border-radius, 7px);
    padding: 0.45rem 0.55rem;
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 0.5rem;
    transition: background-color 150ms ease;

    &:hover {
        background: var(--color-background);
    }
`;

const UniformButton = styled(Button)`
    min-height: 2.5rem;
    height: 2.5rem;
`;

const AddVariableRow = styled.div`
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;

    @media (min-width: 768px) {
        grid-template-columns: minmax(0, 9rem) minmax(0, 14rem) minmax(0, 1fr) minmax(0, 9rem);
        align-items: center;
    }
`;

const filterLabelMap: Record<EnvironmentType, string> = {
    all: 'All',
    production: 'Production',
    local: 'Local',
    test: 'Test',
    development: 'Development',
    other: 'Other',
};

const parseBulk = (content: string): Record<string, string> => {
    const output: Record<string, string> = {};
    const lines = content.split(/\r\n|\r|\n/);

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }

        const normalised = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
        const split = normalised.split('=');
        if (split.length < 2) {
            continue;
        }

        const key = split.shift()!.trim();
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
            continue;
        }

        const raw = split.join('=').trim();
        if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) {
            output[key] = raw.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t');
            continue;
        }
        if (raw.length >= 2 && raw.startsWith("'") && raw.endsWith("'")) {
            output[key] = raw.slice(1, -1);
            continue;
        }
        output[key] = raw;
    }

    return output;
};

const serialiseValue = (value: string): string => {
    if (value === '') {
        return '""';
    }
    const shouldQuote = /[\s#="]/.test(value) || value.includes('\n') || value.includes('\r');
    if (!shouldQuote) {
        return value;
    }
    const escaped = value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
    return `"${escaped}"`;
};

const buildExportFile = (file: EnvFileData): string => {
    return Object.entries(file.variables)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${serialiseValue(value)}`)
        .join('\n');
};

const directoryFromEnvPathParam = (p: string | null): string => {
    if (!p) {
        return '/';
    }
    const n = p.startsWith('/') ? p : `/${p}`;
    const t = n.replace(/\/+$/, '') || '/';
    const i = t.lastIndexOf('/');
    if (i <= 0) {
        return '/';
    }
    return t.slice(0, i) || '/';
};

const downloadText = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.URL.revokeObjectURL(url);
};

export default () => {
    const { t } = useTranslation('server');
    const history = useHistory();
    const location = useLocation();
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const eggId = ServerContext.useStoreState((state) => state.server.data?.eggId);
    const addonSettings = useStoreState((state: ApplicationStore) => state.settings.data?.addons?.environmentVariableManager);
    const { clearFlashes, clearAndAddHttpError, addFlash } = useFlash();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [files, setFiles] = useState<EnvFileData[]>([]);
    const [filter, setFilter] = useState<EnvironmentType>('all');
    const [targetFile, setTargetFile] = useState('.env');
    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');
    const [importText, setImportText] = useState(''); 
    const [importModalVisible, setImportModalVisible] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<{ fileName: string; key: string } | null>(null);
    const [deleteFileModalVisible, setDeleteFileModalVisible] = useState(false);
    const [targetFileToDelete, setTargetFileToDelete] = useState('.env');
    const [shownValues, setShownValues] = useState<Record<string, boolean>>({});
    const [openActionMenuKey, setOpenActionMenuKey] = useState<string | null>(null);
    const [editingRow, setEditingRow] = useState<{ file: string; key: string } | null>(null);
    const [editKey, setEditKey] = useState('');
    const [editValue, setEditValue] = useState('');

    const isEnabled = addonSettings?.enabled ?? false;
    const allowedEggs = addonSettings?.allowedEggs ?? [];
    const isEggAllowed = allowedEggs.length === 0 || (eggId && allowedEggs.includes(eggId));

    const pathFromQuery = useMemo(() => new URLSearchParams(location.search).get('path'), [location.search]);
    const clientDirectoryGuess = useMemo(() => directoryFromEnvPathParam(pathFromQuery), [pathFromQuery]);
    const [apiResolvedDirectory, setApiResolvedDirectory] = useState<string | null>(null);
    const activeDirectory = apiResolvedDirectory ?? clientDirectoryGuess;

    useEffect(() => {
        setApiResolvedDirectory(null);
    }, [pathFromQuery, uuid]);

    const preferredFileFromUrl = useMemo(() => {
        if (!pathFromQuery) {
            return null;
        }
        const normalised = pathFromQuery.startsWith('/') ? pathFromQuery : `/${pathFromQuery}`;
        const parts = normalised.split('/').filter(Boolean);
        const base = parts.length ? parts[parts.length - 1] : null;
        return base && base.length > 0 ? base : null;
    }, [pathFromQuery]);

    const loadVariables = useCallback(() => {
        setLoading(true);
        clearFlashes('server:environment-variables');
        http.get(`/api/client/servers/${uuid}/environment-variables`, {
            params: pathFromQuery ? { path: pathFromQuery } : {},
        })
            .then(({ data }: { data: ApiResponse }) => {
                if (typeof data.directory === 'string') {
                    setApiResolvedDirectory(data.directory);
                }
                setFiles(data.files);
                if (data.files.length > 0) {
                    setTargetFile((current) => {
                        if (preferredFileFromUrl && data.files.some((file) => file.name === preferredFileFromUrl)) {
                            return preferredFileFromUrl;
                        }
                        if (data.files.some((file) => file.name === current)) {
                            return current;
                        }
                        return data.files[0].name;
                    });
                    setTargetFileToDelete((current) => {
                        if (preferredFileFromUrl && data.files.some((file) => file.name === preferredFileFromUrl)) {
                            return preferredFileFromUrl;
                        }
                        if (data.files.some((file) => file.name === current)) {
                            return current;
                        }
                        return data.files[0].name;
                    });
                }
            })
            .catch((error) => clearAndAddHttpError({ key: 'server:environment-variables', error }))
            .finally(() => setLoading(false));
    }, [uuid, pathFromQuery, preferredFileFromUrl, clearFlashes, clearAndAddHttpError]);

    useEffect(() => {
        if (!isEnabled || !isEggAllowed) {
            setLoading(false);
            return;
        }
        loadVariables();
    }, [isEnabled, isEggAllowed, loadVariables]);

    useEffect(() => {
        const onMouseDown = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (target.closest('[data-env-actions-menu]')) {
                return;
            }
            setOpenActionMenuKey(null);
        };

        document.addEventListener('mousedown', onMouseDown);
        return () => document.removeEventListener('mousedown', onMouseDown);
    }, []);

    const persistFileVariables = (fileName: string, variables: Record<string, string>) => {
        return http.post(`/api/client/servers/${uuid}/environment-variables`, {
            file: fileName,
            variables,
            directory: activeDirectory,
        }).then(() => {
            setFiles((current) => current.map((file) => (
                file.name === fileName
                    ? { ...file, variables: { ...variables }, exists: true }
                    : file
            )));
        });
    };

    const saveFileVariables = (fileName: string, variables: Record<string, string>, successMessage: string) => {
        setSaving(true);
        clearFlashes('server:environment-variables');

        persistFileVariables(fileName, variables)
            .then(() => {
                addFlash({
                    key: 'server:environment-variables',
                    type: 'success',
                    message: successMessage,
                });
            })
            .catch((error) => clearAndAddHttpError({ key: 'server:environment-variables', error }))
            .finally(() => setSaving(false));
    };

    const fileOptions = useMemo(() => files.map((file) => file.name), [files]);

    const visibleFiles = useMemo(() => {
        if (filter === 'all') {
            return files;
        }
        return files.filter((file) => file.type === filter);
    }, [files, filter]);

    const rows = useMemo(() => {
        return visibleFiles.flatMap((file) =>
            Object.entries(file.variables)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, value]) => ({
                    fileName: file.name,
                    fileType: file.type,
                    key,
                    value,
                }))
        );
    }, [visibleFiles]);

    const handleAddVariable = () => {
        const key = newKey.trim();
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
            addFlash({
                key: 'server:environment-variables',
                type: 'error',
                message: t('environment_variables.errors.key_format', 'Variable keys must match the format A-Z, 0-9 and underscores only.'),
            });
            return;
        }

        const file = files.find((entry) => entry.name === targetFile);
        if (!file) {
            return;
        }

        const nextVariables = {
            ...file.variables,
            [key]: newValue,
        };

        saveFileVariables(file.name, nextVariables, t('environment_variables.success.saved', 'Saved {{key}} to {{file}}.', { key, file: file.name }));
        setNewKey('');
        setNewValue('');
    };

    const handleDelete = (fileName: string, key: string) => {
        setOpenActionMenuKey(null);
        setPendingDelete({ fileName, key });
        setDeleteModalVisible(true);
    };

    const confirmDelete = () => {
        if (!pendingDelete) {
            return;
        }

        const file = files.find((entry) => entry.name === pendingDelete.fileName);
        if (!file) {
            setDeleteModalVisible(false);
            setPendingDelete(null);
            return;
        }

        const nextVariables = { ...file.variables };
        delete nextVariables[pendingDelete.key];
        saveFileVariables(file.name, nextVariables, t('environment_variables.success.removed', 'Removed {{key}} from {{file}}.', { key: pendingDelete.key, file: file.name }));
        setDeleteModalVisible(false);
        setPendingDelete(null);
    };

    const startEdit = (fileName: string, key: string, value: string) => {
        setOpenActionMenuKey(null);
        setEditingRow({ file: fileName, key });
        setEditKey(key);
        setEditValue(value);
    };

    const cancelEdit = () => {
        setEditingRow(null);
        setEditKey('');
        setEditValue('');
    };

    const submitEdit = () => {
        if (!editingRow) {
            return;
        }

        const cleanedKey = editKey.trim();
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(cleanedKey)) {
            addFlash({
                key: 'server:environment-variables',
                type: 'error',
                message: t('environment_variables.errors.key_format', 'Variable keys must match the format A-Z, 0-9 and underscores only.'),
            });
            return;
        }

        const file = files.find((entry) => entry.name === editingRow.file);
        if (!file) {
            return;
        }

        const nextVariables = { ...file.variables };
        delete nextVariables[editingRow.key];
        nextVariables[cleanedKey] = editValue;
        saveFileVariables(file.name, nextVariables, t('environment_variables.success.updated', 'Updated {{key}} in {{file}}.', { key: cleanedKey, file: file.name }));
        cancelEdit();
    };

    const toggleShown = (fileName: string, key: string) => {
        const mapKey = `${fileName}:${key}`;
        setShownValues((current) => ({ ...current, [mapKey]: !current[mapKey] }));
    };

    const copyValue = (value: string) => {
        navigator.clipboard.writeText(value).catch(() => undefined);
    };

    const handleChangeVariableEnvironment = (sourceFileName: string, key: string, value: string, targetFileName: string) => {
        if (sourceFileName === targetFileName) {
            return;
        }

        const sourceFile = files.find((entry) => entry.name === sourceFileName);
        const targetFile = files.find((entry) => entry.name === targetFileName);
        if (!sourceFile || !targetFile) {
            return;
        }

        const sourceNextVariables = { ...sourceFile.variables };
        delete sourceNextVariables[key];
        const targetNextVariables = {
            ...targetFile.variables,
            [key]: value,
        };

        setSaving(true);
        clearFlashes('server:environment-variables');

        persistFileVariables(sourceFileName, sourceNextVariables)
            .then(() => persistFileVariables(targetFileName, targetNextVariables))
            .then(() => {
                addFlash({
                    key: 'server:environment-variables',
                    type: 'success',
                    message: t('environment_variables.success.moved', 'Moved {{key}} to {{file}}.', { key, file: targetFileName }),
                });
            })
            .catch((error) => {
                clearAndAddHttpError({ key: 'server:environment-variables', error });
                loadVariables();
            })
            .finally(() => setSaving(false));
    };

    const handleImport = () => {
        const parsed = parseBulk(importText);
        if (Object.keys(parsed).length === 0) {
            addFlash({
                key: 'server:environment-variables',
                type: 'error',
                message: t('environment_variables.errors.import_empty', 'No valid environment variables were found in your import.'),
            });
            return;
        }

        const file = files.find((entry) => entry.name === targetFile);
        if (!file) {
            return;
        }

        const nextVariables = {
            ...file.variables,
            ...parsed,
        };

        saveFileVariables(file.name, nextVariables, t('environment_variables.success.imported', 'Imported {{count}} variable(s) into {{file}}.', { count: Object.keys(parsed).length, file: file.name }));
        setImportText('');
        setImportModalVisible(false);
    };

    const handleExport = () => {
        if (visibleFiles.length === 0) {
            return;
        }

        if (filter !== 'all' && visibleFiles.length === 1) {
            downloadText(visibleFiles[0].name, buildExportFile(visibleFiles[0]));
            return;
        }

        const content = visibleFiles
            .map((file) => {
                const body = buildExportFile(file);
                return `# ${file.name}\n${body}`;
            })
            .join('\n\n');

        downloadText('environment-variables.export.env', content);
    };

    const deleteEnvironmentFile = () => {
        setSaving(true);
        clearFlashes('server:environment-variables');

        http.delete(`/api/client/servers/${uuid}/environment-variables`, {
            data: {
                file: targetFileToDelete,
                directory: activeDirectory,
            },
        })
            .then(({ data }) => {
                setFiles((current) => current.map((file) => (
                    file.name === targetFileToDelete
                        ? { ...file, exists: false, variables: {} }
                        : file
                )));
                addFlash({
                    key: 'server:environment-variables',
                    type: 'success',
                    message: data?.message || t('environment_variables.success.file_deleted', '{{file}} handled successfully.', { file: targetFileToDelete }),
                });
                setDeleteFileModalVisible(false);
            })
            .catch((error) => clearAndAddHttpError({ key: 'server:environment-variables', error }))
            .finally(() => setSaving(false));
    };

    const openFileView = () => {
        const target = targetFile || '.env';
        const filePath = join(activeDirectory, target);
        history.push(`/server/${id}/files/edit?view=file#${encodePathSegments(filePath)}`);
    };

    if (!isEnabled) {
        return (
            <PageContentBlock title={t('navigation.environment_variables', 'Environment Variables')}>
                <div css={tw`text-center py-12`}>
                    <p style={{ color: 'var(--color-muted)' }}>{t('environment_variables.disabled', 'The Environment Variable Manager addon is disabled.')}</p>
                </div>
            </PageContentBlock>
        );
    }

    if (!isEggAllowed) {
        return (
            <PageContentBlock title={t('navigation.environment_variables', 'Environment Variables')}>
                <div css={tw`text-center py-12`}>
                    <p style={{ color: 'var(--color-muted)' }}>{t('environment_variables.egg_not_allowed', 'This egg is not allowed to use Environment Variable Manager.')}</p>
                </div>
            </PageContentBlock>
        );
    }

    if (loading) {
        return (
            <PageContentBlock title={t('navigation.environment_variables', 'Environment Variables')}>
                <Spinner size="large" centered />
            </PageContentBlock>
        );
    }

    return (
        <PageContentBlock title={t('navigation.environment_variables', 'Environment Variables')}>
            <FlashMessageRender byKey="server:environment-variables" css={tw`mb-4`} />

            <Modal visible={importModalVisible} onDismissed={() => setImportModalVisible(false)} showSpinnerOverlay={saving}>
                <SectionTitle>{t('environment_variables.import.title', 'Import Variables')}</SectionTitle>
                <div css={tw`space-y-3`}>
                    <SelectField value={targetFile} onChange={(e) => setTargetFile(e.currentTarget.value)}>
                        {fileOptions.map((name) => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </SelectField>
                    <FieldTextArea
                        value={importText}
                        onChange={(e) => setImportText(e.currentTarget.value)}
                        placeholder={t('environment_variables.import.placeholder', 'Paste lines like:\nAPP_KEY=base64:...\nAPP_ENV=production')}
                    />
                    <div css={tw`flex items-center justify-between gap-3 flex-wrap pt-2`}>
                        <div css={tw`text-xs`} style={{ color: 'var(--color-muted)' }}>
                            {t('environment_variables.import.help', 'Paste a full .env block and import all variables at once.')}
                        </div>
                        <div css={tw`flex items-center gap-2`}>
                            <UniformButton isSecondary onClick={() => setImportModalVisible(false)} disabled={saving}>
                                {t('databases.cancel', 'Cancel')}
                            </UniformButton>
                            <UniformButton onClick={handleImport} disabled={saving || importText.trim().length === 0}>
                                <FontAwesomeIcon icon={faFileImport} className="mr-2" />
                                {t('environment_variables.import.submit', 'Import into {{file}}', { file: targetFile })}
                            </UniformButton>
                        </div>
                    </div>
                </div>

            </Modal>
            <Modal
                visible={deleteModalVisible}
                onDismissed={() => {
                    setDeleteModalVisible(false);
                    setPendingDelete(null);
                }}
                showSpinnerOverlay={saving}
            >
                <SectionTitle>{t('environment_variables.delete_variable.title', 'Delete Variable')}</SectionTitle>
                <div css={tw`space-y-4`}>
                    <div css={tw`text-sm`} style={{ color: 'var(--color-muted)' }}>
                        {pendingDelete
                            ? t('environment_variables.delete_variable.confirm_named', 'Are you sure you want to remove {{key}} from {{file}}?', { key: pendingDelete.key, file: pendingDelete.fileName })
                            : t('environment_variables.delete_variable.confirm', 'Are you sure you want to remove this variable?')}
                    </div>
                    <div css={tw`flex items-center justify-end gap-2`}>
                        <UniformButton
                            isSecondary
                            onClick={() => {
                                setDeleteModalVisible(false);
                                setPendingDelete(null);
                            }}
                            disabled={saving}
                        >
                            {t('databases.cancel', 'Cancel')}
                        </UniformButton>
                        <UniformButton onClick={confirmDelete} disabled={saving} color={'red'}>
                            {t('files.actions.delete', 'Delete')}
                        </UniformButton>
                    </div>
                </div>
            </Modal>
            <Modal
                visible={deleteFileModalVisible}
                onDismissed={() => setDeleteFileModalVisible(false)}
                showSpinnerOverlay={saving}
            >
                <SectionTitle>{t('environment_variables.delete_file.title', 'Delete Environment File')}</SectionTitle>
                <div css={tw`space-y-4`}>
                    <SelectField value={targetFileToDelete} onChange={(e) => setTargetFileToDelete(e.currentTarget.value)}>
                        {fileOptions.map((name) => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </SelectField>
                    <div css={tw`text-sm`} style={{ color: 'var(--color-muted)' }}>
                        {t('environment_variables.delete_file.warning', 'This will permanently delete the selected file from disk. If it does not exist, no error will be thrown.')}
                    </div>
                    <div css={tw`flex items-center justify-end gap-2`}>
                        <UniformButton isSecondary onClick={() => setDeleteFileModalVisible(false)} disabled={saving}>
                            {t('databases.cancel', 'Cancel')}
                        </UniformButton>
                        <UniformButton color={'red'} onClick={deleteEnvironmentFile} disabled={saving}>
                            {t('environment_variables.delete_file.submit', 'Delete File')}
                        </UniformButton>
                    </div>
                </div>
            </Modal>

            <div css={tw`mb-4`}>
                <Card>
                    <SectionTitle>{t('environment_variables.add.title', 'Add Variable')}</SectionTitle>
                    <AddVariableRow>
                        <SelectField value={targetFile} onChange={(e) => setTargetFile(e.currentTarget.value)}>
                            {fileOptions.map((name) => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </SelectField>
                        <Field
                            value={newKey}
                            onChange={(e) => setNewKey(e.currentTarget.value)}
                            placeholder="KEY"
                        />
                        <Field
                            value={newValue}
                            onChange={(e) => setNewValue(e.currentTarget.value)}
                            placeholder={t('environment_variables.add.value_placeholder', 'Value')}
                        />
                        <UniformButton onClick={handleAddVariable} disabled={saving} css={tw`w-full`}>
                            <FontAwesomeIcon icon={faPlus} className="mr-2" />
                            {t('environment_variables.add.submit', 'Add')}
                        </UniformButton>
                    </AddVariableRow>
                </Card>
            </div>

            <Card>
                <div css={tw`flex items-center justify-between gap-3 flex-wrap mb-4`}>
                    <SectionTitle css={tw`mb-0`}>{t('environment_variables.variables', 'Variables')}</SectionTitle>
                    <div css={tw`flex items-center gap-2 flex-wrap`}>
                        <div css={tw`w-40`}>
                            <SelectField value={filter} onChange={(e) => setFilter(e.currentTarget.value as EnvironmentType)}>
                                {(Object.keys(filterLabelMap) as EnvironmentType[]).map((value) => (
                                    <option key={value} value={value}>{t(`environment_variables.filters.${value}`, filterLabelMap[value])}</option>
                                ))}
                            </SelectField>
                        </div>
                        <div css={tw`w-40`}>
                            <SelectField
                                value={'ui'}
                                onChange={(e) => {
                                    if (e.currentTarget.value === 'file') {
                                        openFileView();
                                    }
                                }}
                            >
                                <option value={'ui'}>{t('environment_variables.views.ui', 'UI View')}</option>
                                <option value={'file'}>{t('environment_variables.views.file', 'File View')}</option>
                            </SelectField>
                        </div>
                        <UniformButton isSecondary onClick={() => setImportModalVisible(true)}>
                            <FontAwesomeIcon icon={faFileImport} className="mr-2" />
                            {t('environment_variables.actions.import', 'Import')}
                        </UniformButton>
                        <UniformButton isSecondary onClick={handleExport} disabled={rows.length === 0}>
                            <FontAwesomeIcon icon={faDownload} className="mr-2" />
                            {t('environment_variables.actions.export', 'Export')}
                        </UniformButton>
                        <UniformButton isSecondary onClick={loadVariables} disabled={saving}>
                            <FontAwesomeIcon icon={faSyncAlt} className="mr-2" />
                            {t('files.actions.refresh', 'Refresh')}
                        </UniformButton>
                        <UniformButton color={'red'} onClick={() => setDeleteFileModalVisible(true)}>
                            <FontAwesomeIcon icon={faTrash} className="mr-2" />
                            {t('environment_variables.delete_file.submit', 'Delete File')}
                        </UniformButton>
                    </div>
                </div>

                {rows.length === 0 ? (
                    <div css={tw`py-10 text-center text-sm`} style={{ color: 'var(--color-muted)' }}>
                        {t('environment_variables.empty', 'No variables in this filter yet.')}
                    </div>
                ) : (
                    <div css={tw`space-y-3`}>
                        {rows.map((row) => {
                            const mapKey = `${row.fileName}:${row.key}`;
                            const isShown = shownValues[mapKey];
                            const isEditing = editingRow?.file === row.fileName && editingRow.key === row.key;
                            const isActionMenuOpen = openActionMenuKey === mapKey;

                            return (
                                <Row key={mapKey}>
                                    {isEditing ? (
                                        <VariablesGrid>
                                            <Field value={editKey} onChange={(e) => setEditKey(e.currentTarget.value)} />
                                            <Field value={editValue} onChange={(e) => setEditValue(e.currentTarget.value)} />
                                            <SelectField value={row.fileName} disabled>
                                                <option>{row.fileName}</option>
                                            </SelectField>
                                            <div css={tw`flex items-center gap-2`}>
                                                <UniformButton onClick={submitEdit} disabled={saving}>{t('startup.save', 'Save')}</UniformButton>
                                                <UniformButton isSecondary onClick={cancelEdit} disabled={saving}>{t('databases.cancel', 'Cancel')}</UniformButton>
                                            </div>
                                        </VariablesGrid>
                                    ) : (
                                        <VariableRowContent>
                                            <VariableRowLeft>
                                                <div css={tw`text-sm font-semibold`} style={{ color: 'var(--color-base)' }}>{row.key}</div>
                                            </VariableRowLeft>
                                            <VariableRowMiddle>
                                                <RowValue>{isShown ? row.value || t('environment_variables.empty_value', '(empty)') : '*****************'}</RowValue>
                                                <div>
                                                    <SelectField
                                                        value={row.fileName}
                                                        onChange={(e) => handleChangeVariableEnvironment(row.fileName, row.key, row.value, e.currentTarget.value)}
                                                        disabled={saving}
                                                    >
                                                        {fileOptions.map((name) => (
                                                            <option key={`${row.key}-${name}`} value={name}>{name}</option>
                                                        ))}
                                                    </SelectField>
                                                </div>
                                            </VariableRowMiddle>
                                            <VariableRowRight>
                                                <ActionIconButton title={isShown ? t('environment_variables.actions.hide_value', 'Hide value') : t('environment_variables.actions.show_value', 'Show value')} onClick={() => toggleShown(row.fileName, row.key)}>
                                                    <FontAwesomeIcon icon={isShown ? faEyeSlash : faEye} />
                                                </ActionIconButton>
                                                <ActionIconButton title={t('environment_variables.actions.copy_value', 'Copy value')} onClick={() => copyValue(row.value)}>
                                                    <FontAwesomeIcon icon={faCopy} />
                                                </ActionIconButton>
                                                <ActionsMenuWrap data-env-actions-menu>
                                                    <ActionsMenuButton
                                                        title={t('environment_variables.actions.more', 'More actions')}
                                                        onClick={() => setOpenActionMenuKey((current) => current === mapKey ? null : mapKey)}
                                                    >
                                                        <FontAwesomeIcon icon={faEllipsisV} />
                                                    </ActionsMenuButton>
                                                    {isActionMenuOpen && (
                                                        <ActionsMenu>
                                                            <ActionsMenuItem onClick={() => startEdit(row.fileName, row.key, row.value)}>
                                                                <FontAwesomeIcon icon={faPen} />
                                                                {t('users.edit', 'Edit')}
                                                            </ActionsMenuItem>
                                                            <ActionsMenuItem $danger onClick={() => handleDelete(row.fileName, row.key)}>
                                                                <FontAwesomeIcon icon={faTrash} />
                                                                {t('files.actions.delete', 'Delete')}
                                                            </ActionsMenuItem>
                                                        </ActionsMenu>
                                                    )}
                                                </ActionsMenuWrap>
                                            </VariableRowRight>
                                        </VariableRowContent>
                                    )}
                                </Row>
                            );
                        })}
                    </div>
                )}
            </Card>
        </PageContentBlock>
    );
};
