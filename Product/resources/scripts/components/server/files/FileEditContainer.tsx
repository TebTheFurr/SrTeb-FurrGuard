import React, { useCallback, useEffect, useState } from 'react';
import getFileContents from '@/api/server/files/getFileContents';
import { httpErrorToHuman } from '@/api/http';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import saveFileContents from '@/api/server/files/saveFileContents';
import FileManagerBreadcrumbs from '@/components/server/files/FileManagerBreadcrumbs';
import { useHistory, useLocation, useParams } from 'react-router';
import FileNameModal from '@/components/server/files/FileNameModal';
import Can from '@/components/elements/Can';
import FlashMessageRender from '@/components/FlashMessageRender';
import PageContentBlock from '@/components/elements/PageContentBlock';
import { ServerError } from '@/components/elements/ScreenBlock';
import tw from 'twin.macro';
import Button from '@/components/elements/Button';
import Select from '@/components/elements/Select';
import modes from '@/modes';
import useFlash from '@/plugins/useFlash';
import { ServerContext } from '@/state/server';
import ErrorBoundary from '@/components/elements/ErrorBoundary';
import { encodePathSegments, hashToPath } from '@/helpers';
import { dirname } from 'pathe';
import CodemirrorEditor from '@/components/elements/CodemirrorEditor';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTh } from '@fortawesome/free-solid-svg-icons';

const getNewFileDraftKey = (uuid: string, directory: string) => `pterodactyl:new-file:${uuid}:${directory}`;

export default () => {
    const [error, setError] = useState('');
    const { action } = useParams<{ action: 'new' | string }>();
    const [loading, setLoading] = useState(action === 'edit');
    const [content, setContent] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [mode, setMode] = useState('text/plain');

    const history = useHistory();
    const { hash, search } = useLocation();

    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const eggId = ServerContext.useStoreState((state) => state.server.data?.eggId);
    const setDirectory = ServerContext.useStoreActions((actions) => actions.files.setDirectory);
    const { addError, clearFlashes } = useFlash();
    const addonSettings = useStoreState((state: ApplicationStore) => state.settings.data?.addons?.serverPropertiesEditor);
    const environmentVariableManager = useStoreState((state: ApplicationStore) => state.settings.data?.addons?.environmentVariableManager);

    const filePath = hashToPath(hash);
    const fileDirectory = action === 'new' ? filePath : dirname(filePath);
    const draftKey = action === 'new' ? getNewFileDraftKey(uuid, fileDirectory) : undefined;
    const saveDraft = useCallback(
        (value: string) => {
            if (!draftKey) return;

            if (value.length > 0) {
                sessionStorage.setItem(draftKey, value);
            } else {
                sessionStorage.removeItem(draftKey);
            }
        },
        [draftKey]
    );

    let fetchFileContent: null | (() => Promise<string>) = null;

    useEffect(() => {
        setDirectory(fileDirectory);
    }, [fileDirectory, setDirectory]);

    useEffect(() => {
        if (!draftKey) return;

        setContent(sessionStorage.getItem(draftKey) || '');
    }, [draftKey]);

    useEffect(() => {
        if (action === 'new') return;

        const fileName = filePath.split('/').pop() || '';
        const directory = dirname(filePath);
        const forceFileView = new URLSearchParams(search).get('view') === 'file';

        const isServerPropertiesFile = fileName === 'server.properties' && directory === '/';
        const propertiesEditorEnabled = addonSettings?.enabled ?? false;
        const canAccessViaFile = addonSettings?.accessMode === 'file' || addonSettings?.accessMode === 'both';
        const allowedEggs = addonSettings?.allowedEggs ?? [];
        const isEggAllowed = allowedEggs.length === 0 || (eggId && allowedEggs.includes(eggId));

        const isEnvFile = fileName === '.env' || fileName.startsWith('.env.');
        const envManagerEnabled = environmentVariableManager?.enabled ?? false;
        const envManagerCanAccessViaFile = environmentVariableManager?.accessMode === 'file' || environmentVariableManager?.accessMode === 'both';
        const envManagerAllowedEggs = environmentVariableManager?.allowedEggs ?? [];
        const envManagerEggAllowed = envManagerAllowedEggs.length === 0 || (eggId && envManagerAllowedEggs.includes(eggId));

        if (!forceFileView && isServerPropertiesFile && propertiesEditorEnabled && canAccessViaFile && isEggAllowed) {
            history.replace(`/server/${id}/properties`);
            return;
        }

        if (!forceFileView && isEnvFile && envManagerEnabled && envManagerCanAccessViaFile && envManagerEggAllowed) {
            history.replace(`/server/${id}/environment-variables?path=${encodeURIComponent(filePath)}`);
            return;
        }

        setError('');
        setLoading(true);
        getFileContents(uuid, filePath)
            .then(setContent)
            .catch((error) => {
                console.error(error);
                setError(httpErrorToHuman(error));
            })
            .then(() => setLoading(false));
    }, [action, uuid, filePath, search, id, eggId, addonSettings, environmentVariableManager, history]);

    const save = async (name?: string) => {
        if (!fetchFileContent) {
            return;
        }

        setLoading(true);
        clearFlashes('files:view');

        let redirecting = false;

        try {
            const content = await fetchFileContent();

            await saveFileContents(uuid, name || filePath, content);

            if (name) {
                if (draftKey) {
                    sessionStorage.removeItem(draftKey);
                }

                history.push(`/server/${id}/files/edit#/${encodePathSegments(name)}`);
                redirecting = true;
                return;
            }
        } catch (error) {
            console.error(error);
            addError({ message: httpErrorToHuman(error), key: 'files:view' });
        } finally {
            if (!redirecting) {
                setLoading(false);
            }
        }
    };

    const closeFile = () => {
        const path = hashToPath(hash);
        const directory = path ? dirname(path) : '';
        const encodedDirectory =
            directory && directory !== '.' ? `#/${encodePathSegments(directory)}` : '';
        history.push(`/server/${id}/files${encodedDirectory}`);
    };

    const currentPath = hashToPath(hash);
    const fileName = currentPath.split('/').pop() || '';
    const directory = dirname(currentPath);
    const isServerPropertiesFile = fileName === 'server.properties' && directory === '/';
    const propertiesEditorEnabled = addonSettings?.enabled ?? false;
    const canAccessViaFile = addonSettings?.accessMode === 'file' || addonSettings?.accessMode === 'both';
    const allowedEggs = addonSettings?.allowedEggs ?? [];
    const isEggAllowed = allowedEggs.length === 0 || (eggId && allowedEggs.includes(eggId));
    const canShowUiViewButton = isServerPropertiesFile && propertiesEditorEnabled && canAccessViaFile && isEggAllowed && action === 'edit';

    const isEnvFile = fileName === '.env' || fileName.startsWith('.env.');
    const envManagerEnabled = environmentVariableManager?.enabled ?? false;
    const envManagerCanAccessViaFile = environmentVariableManager?.accessMode === 'file' || environmentVariableManager?.accessMode === 'both';
    const envManagerAllowedEggs = environmentVariableManager?.allowedEggs ?? [];
    const envManagerEggAllowed = envManagerAllowedEggs.length === 0 || (eggId && envManagerAllowedEggs.includes(eggId));
    const canShowEnvUiViewButton = isEnvFile && envManagerEnabled && envManagerCanAccessViaFile && envManagerEggAllowed && action === 'edit';

    if (error) {
        return <ServerError message={error} onBack={() => history.goBack()} />;
    }

    return (
        <PageContentBlock>
            <FlashMessageRender byKey={'files:view'} css={tw`mb-4`} />
            <ErrorBoundary>
                <div css={tw`mb-4`}>
                    <FileManagerBreadcrumbs withinFileEditor isNewFile={action !== 'edit'} />
                </div>
            </ErrorBoundary>
            {hash.replace(/^#/, '').endsWith('.pteroignore') && (
                <div
                    css={tw`mb-4 p-4 border-l-4`}
                    style={{
                        backgroundColor: 'var(--color-background-secondary)',
                        borderColor: 'var(--color-primary)',
                        borderRadius: 'var(--border-radius, 8px)',
                    }}
                >
                    <p css={tw`text-sm`} style={{ color: 'var(--color-muted)' }}>
                        You&apos;re editing a{' '}
                        <code
                            css={tw`font-mono py-px px-1`}
                            style={{
                                backgroundColor: 'var(--color-background-secondary)',
                                borderRadius: '4px',
                                color: 'var(--color-base)',
                            }}
                        >
                            .pteroignore
                        </code>{' '}
                        file. Any files or directories listed in here will be excluded from backups. Wildcards are
                        supported by using an asterisk (
                        <code
                            css={tw`font-mono py-px px-1`}
                            style={{
                                backgroundColor: 'var(--color-background-secondary)',
                                borderRadius: '4px',
                                color: 'var(--color-base)',
                            }}
                        >
                            *
                        </code>
                        ). You can negate a prior rule by prepending an exclamation point (
                        <code
                            css={tw`font-mono py-px px-1`}
                            style={{
                                backgroundColor: 'var(--color-background-secondary)',
                                borderRadius: '4px',
                                color: 'var(--color-base)',
                            }}
                        >
                            !
                        </code>
                        ).
                    </p>
                </div>
            )}
            <FileNameModal
                visible={modalVisible}
                onDismissed={() => setModalVisible(false)}
                onFileNamed={(name) => {
                    setModalVisible(false);
                    save(name);
                }}
            />
            <div css={tw`relative`}>
                <SpinnerOverlay visible={loading} />
                <CodemirrorEditor
                    mode={mode}
                    filename={hash.replace(/^#/, '')}
                    onModeChanged={setMode}
                    initialContent={content}
                    fetchContent={(value) => {
                        fetchFileContent = value;
                    }}
                    onContentSaved={() => {
                        if (action !== 'edit') {
                            setModalVisible(true);
                        } else {
                            save();
                        }
                    }}
                    onContentChanged={action === 'new' ? saveDraft : undefined}
                />
            </div>
            <div css={tw`flex flex-col sm:flex-row sm:justify-between gap-4 mt-4`}>
                <div css={tw`w-full sm:w-auto sm:flex-none sm:mr-4`}>
                    <Select value={mode} onChange={(e) => setMode(e.currentTarget.value)}>
                        {modes.map((mode) => (
                            <option key={`${mode.name}_${mode.mime}`} value={mode.mime}>
                                {mode.name}
                            </option>
                        ))}
                    </Select>
                </div>
                <div css={tw`w-full sm:w-auto sm:flex-none`}>
                    {action === 'edit' ? (
                        <div css={tw`flex items-center gap-2`}>
                            {canShowUiViewButton && (
                                <Button 
                                    css={tw`flex-1 sm:flex-none`} 
                                    isSecondary 
                                    onClick={() => history.push(`/server/${id}/properties`)}
                                >
                                    <FontAwesomeIcon icon={faTh} css={tw`mr-2`} />
                                    UI View
                                </Button>
                            )}
                            {canShowEnvUiViewButton && (
                                <Button 
                                    css={tw`flex-1 sm:flex-none`} 
                                    isSecondary 
                                    onClick={() => history.push(`/server/${id}/environment-variables?path=${encodeURIComponent(currentPath)}`)}
                                >
                                    <FontAwesomeIcon icon={faTh} css={tw`mr-2`} />
                                    UI View
                                </Button>
                            )}
                            <Button css={tw`flex-1 sm:flex-none`} isSecondary onClick={closeFile}>
                                Cancel
                            </Button>
                            <Can action={'file.update'}>
                                <Button style={{ border: 'none' }} css={tw`flex-1 sm:flex-none`} onClick={() => save()}>
                                    Save
                                </Button>
                            </Can>
                        </div>
                    ) : (
                        <Can action={'file.create'}>
                            <Button style={{ border: 'none' }} css={tw`w-full sm:w-auto`} onClick={() => setModalVisible(true)}>
                                Create File
                            </Button>
                        </Can>
                    )}
                </div>
            </div>
        </PageContentBlock>
    );
};
