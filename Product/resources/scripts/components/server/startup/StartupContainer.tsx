import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import tw from 'twin.macro';
import { useStoreState } from 'easy-peasy';
import VariableBox from '@/components/server/startup/VariableBox';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import getServerStartup from '@/api/swr/getServerStartup';
import Spinner from '@/components/elements/Spinner';
import { ServerError } from '@/components/elements/ScreenBlock';
import { httpErrorToHuman } from '@/api/http';
import { ServerContext } from '@/state/server';
import { useDeepCompareEffect } from '@/plugins/useDeepCompareEffect';
import Select from '@/components/elements/Select';
import isEqual from 'react-fast-compare';
import Input from '@/components/elements/Input';
import setSelectedDockerImage from '@/api/server/setSelectedDockerImage';
import updateStartupCommand from '@/api/server/updateStartupCommand';
import InputSpinner from '@/components/elements/InputSpinner';
import PageHeader from '@/components/elements/ui/PageHeader';
import useFlash from '@/plugins/useFlash';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTerminal, faCube, faInfoCircle, faBox, faSave, faUndo } from '@fortawesome/free-solid-svg-icons';
import styled from 'styled-components/macro';
import CopyOnClick from '@/components/elements/CopyOnClick';
import FlashMessageRender from '@/components/FlashMessageRender';
import { ApplicationStore } from '@/state';
import Button from '@/components/elements/button/Button';

const CommandDisplay = styled.div`
    ${tw`relative`};
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    overflow: hidden;
`;

const CommandHeader = styled.div`
    ${tw`flex items-center justify-between px-4 py-2`};
    background-color: var(--color-background);
    border-bottom: 1px solid var(--color-neutral);
`;

const CommandBody = styled.div`
    ${tw`p-4 font-mono text-sm overflow-x-auto`};
    color: var(--color-base);
    white-space: pre-wrap;
    word-break: break-all;
`;

const Card = styled.div`
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    overflow: hidden;
`;

const CardHeader = styled.div`
    ${tw`flex items-center px-4 py-3`};
    border-bottom: 1px solid var(--color-neutral);
`;

const CardBody = styled.div`
    ${tw`p-4`};
`;

const CopyButton = styled.button`
    ${tw`text-xs px-3 py-1 rounded transition-all duration-150`};
    background-color: var(--color-neutral);
    color: var(--color-muted);

    &:hover {
        background-color: var(--color-primary);
        color: var(--color-base);
    }
`;

const CommandTextarea = styled.textarea`
    ${tw`w-full p-4 font-mono text-sm resize-y min-h-[120px]`};
    background-color: var(--color-background);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    color: var(--color-base);

    &:focus {
        outline: none;
        border-color: var(--color-primary);
    }

    &:disabled {
        opacity: 0.7;
        cursor: not-allowed;
    }
`;

const StartupContainer = () => {
    const { t } = useTranslation('server');
    const [loading, setLoading] = useState(false);
    const [commandSaving, setCommandSaving] = useState(false);
    const [commandValue, setCommandValue] = useState<string | undefined>(undefined);
    const { clearFlashes, clearAndAddHttpError, addFlash } = useFlash();
    const allowStartupCommandEdit = useStoreState(
        (state: ApplicationStore) => state.settings.data?.components?.allowStartupCommandEdit ?? true
    );
    const allowStartupCommandEditEggs = useStoreState(
        (state: ApplicationStore) => state.settings.data?.components?.allowStartupCommandEditEggs ?? []
    );
    const allowStartupVariablesEdit = useStoreState(
        (state: ApplicationStore) => state.settings.data?.components?.allowStartupVariablesEdit ?? true
    );
    const allowStartupVariablesEditEggs = useStoreState(
        (state: ApplicationStore) => state.settings.data?.components?.allowStartupVariablesEditEggs ?? []
    );
    const allowDockerImageEdit = useStoreState(
        (state: ApplicationStore) => state.settings.data?.components?.allowDockerImageEdit ?? true
    );

    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const eggId = ServerContext.useStoreState((state) => state.server.data!.eggId);
    const variables = ServerContext.useStoreState(
        ({ server }) => ({
            variables: server.data!.variables,
            invocation: server.data!.invocation,
            dockerImage: server.data!.dockerImage,
        }),
        isEqual
    );

    const { data, error, isValidating, mutate } = getServerStartup(uuid, {
        ...variables,
        rawStartupCommand: variables.invocation ?? '',
        dockerImages: { [variables.dockerImage]: variables.dockerImage },
    });

    const setServerFromState = ServerContext.useStoreActions((actions) => actions.server.setServerFromState);
    const isCustomImage =
        data &&
        !Object.values(data.dockerImages)
            .map((v) => v.toLowerCase())
            .includes(variables.dockerImage.toLowerCase());
    const startupCommandEditEggs = allowStartupCommandEditEggs.map((value) => Number(value)).filter((value) => !Number.isNaN(value));
    const startupVariablesEditEggs = allowStartupVariablesEditEggs
        .map((value) => Number(value))
        .filter((value) => !Number.isNaN(value));
    const isStartupCommandEggAllowed = startupCommandEditEggs.length === 0 || startupCommandEditEggs.includes(eggId);
    const isStartupVariablesEggAllowed =
        startupVariablesEditEggs.length === 0 || startupVariablesEditEggs.includes(eggId);
    const canEditStartupCommand = allowStartupCommandEdit && isStartupCommandEggAllowed;
    const canEditStartupVariables = allowStartupVariablesEdit && isStartupVariablesEggAllowed;

    useEffect(() => {
        mutate();
    }, []);

    useDeepCompareEffect(() => {
        if (!data) return;

        setServerFromState((s) => ({
            ...s,
            invocation: data.invocation,
            variables: data.variables,
        }));
        setCommandValue(data.rawStartupCommand);
    }, [data]);

    const updateSelectedDockerImage = useCallback(
        (v: React.ChangeEvent<HTMLSelectElement>) => {
            setLoading(true);
            clearFlashes('startup:image');

            const image = v.currentTarget.value;
            setSelectedDockerImage(uuid, image)
                .then(() => setServerFromState((s) => ({ ...s, dockerImage: image })))
                .catch((error) => {
                    console.error(error);
                    clearAndAddHttpError({ key: 'startup:image', error });
                })
                .then(() => setLoading(false));
        },
        [uuid]
    );

    const displayCommandValue = commandValue ?? data?.rawStartupCommand ?? '';
    const resetStartupCommand = useCallback(() => {
        clearFlashes('startup:command');
        setCommandValue(data?.eggStartupCommand ?? '');
    }, [data, clearFlashes]);

    const saveStartupCommand = useCallback(() => {
        if (displayCommandValue.trim().length === 0) {
            clearFlashes('startup:command');
            addFlash({ key: 'startup:command', type: 'error', message: 'Startup command cannot be empty.' });
            return;
        }

        setCommandSaving(true);
        clearFlashes('startup:command');
        updateStartupCommand(uuid, displayCommandValue)
            .then(() => mutate())
            .catch((err) => {
                clearAndAddHttpError({ key: 'startup:command', error: err });
            })
            .then(() => setCommandSaving(false));
    }, [uuid, displayCommandValue, mutate, clearFlashes, clearAndAddHttpError, addFlash]);

    return !data ? (
        !error || (error && isValidating) ? (
            <Spinner centered size={Spinner.Size.LARGE} />
        ) : (
            <ServerError title={'Oops!'} message={httpErrorToHuman(error)} onRetry={() => mutate()} />
        )
    ) : (
        <ServerContentBlock title={t('startup.title')} showFlashKey="startup:image">
            <PageHeader title={t('startup.title')} description={t('startup.subtitle')} />
            <CommandDisplay>
                <CommandHeader>
                    <div className="flex items-center">
                        <FontAwesomeIcon
                            icon={faTerminal}
                            className="mr-3"
                            style={{ color: 'var(--color-primary)' }}
                        />
                        <span className="font-medium" style={{ color: 'var(--color-base)' }}>
                            {t('startup.command')}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {canEditStartupCommand ? (
                            <InputSpinner visible={commandSaving}>
                                <div className="flex items-stretch gap-2">
                                    <Button.Text
                                        size={Button.Sizes.Small}
                                        className="min-w-[150px] justify-center"
                                        onClick={resetStartupCommand}
                                        disabled={displayCommandValue === data.eggStartupCommand}
                                    >
                                        <FontAwesomeIcon icon={faUndo} className="mr-2" />
                                        {t('startup.reset_to_egg')}
                                    </Button.Text>
                                    <Button
                                        size={Button.Sizes.Small}
                                        className="min-w-[150px] justify-center"
                                        onClick={saveStartupCommand}
                                        disabled={displayCommandValue === data.rawStartupCommand}
                                    >
                                        <FontAwesomeIcon icon={faSave} className="mr-2" />
                                        {t('startup.save')}
                                    </Button>
                                </div>
                            </InputSpinner>
                        ) : (
                            <CopyOnClick text={data.invocation}>
                                <CopyButton>{t('startup.copy')}</CopyButton>
                            </CopyOnClick>
                        )}
                    </div>
                </CommandHeader>
                {canEditStartupCommand ? (
                    <div className="p-4">
                        <FlashMessageRender byKey="startup:command" className="mb-3" />
                        <CommandTextarea
                            value={displayCommandValue}
                            onChange={(e) => setCommandValue(e.target.value)}
                            disabled={!canEditStartupCommand}
                            spellCheck={false}
                        />
                        <p className="text-xs mt-2" style={{ color: 'var(--color-muted)' }}>
                            {t('startup.command_help')}
                        </p>
                    </div>
                ) : (
                    <CommandBody>{data.invocation}</CommandBody>
                )}
            </CommandDisplay>

            
            <div className="mt-6">
                <Card>
                    <CardHeader>
                        <FontAwesomeIcon 
                            icon={faBox} 
                            className="mr-3 text-lg" 
                                style={{ color: 'var(--color-primary)' }} 
                        />
                        <span className="font-medium" style={{ color: 'var(--color-base)' }}>
                            {t('startup.docker_image')}
                        </span>
                    </CardHeader>
                    <CardBody>
                        {Object.keys(data.dockerImages).length > 1 && !isCustomImage ? (
                            <div>
                                <InputSpinner visible={loading}>
                                    <Select
                                        disabled={!allowDockerImageEdit || Object.keys(data.dockerImages).length < 2}
                                        onChange={updateSelectedDockerImage}
                                        defaultValue={variables.dockerImage}
                                    >
                                        {Object.keys(data.dockerImages).map((key) => (
                                            <option key={data.dockerImages[key]} value={data.dockerImages[key]}>
                                                {key}
                                            </option>
                                        ))}
                                    </Select>
                                </InputSpinner>
                                <div 
                                    className="flex items-start mt-3 p-3 rounded-lg"
                                    style={{ 
                                        backgroundColor: 'var(--color-background)',
                                        border: '1px solid var(--color-neutral)',
                                    }}
                                >
                                    <FontAwesomeIcon 
                                        icon={faInfoCircle} 
                                        className="mr-2 mt-0.5 flex-shrink-0" 
                                        style={{ color: 'var(--color-primary)' }} 
                                    />
                                    <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                                        {t('startup.docker_image_help')}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <Input disabled readOnly value={variables.dockerImage} />
                                {isCustomImage && (
                                    <div 
                                        className="flex items-start mt-3 p-3 rounded-lg"
                                        style={{ 
                                            backgroundColor: 'var(--color-background)',
                                            border: '1px solid var(--color-neutral)',
                                        }}
                                    >
                                        <FontAwesomeIcon 
                                            icon={faInfoCircle} 
                                            className="mr-2 mt-0.5 flex-shrink-0" 
                                            style={{ color: 'var(--color-inverted)' }} 
                                        />
                                        <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                                            {t('startup.docker_image_custom')}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardBody>
                </Card>
            </div>

            
            {data.variables.length > 0 && (
                <div className="mt-8">
                    <div className="flex items-center mb-4">
                        <FontAwesomeIcon 
                            icon={faCube} 
                            className="mr-3" 
                            style={{ color: 'var(--color-primary)' }} 
                        />
                        <h3 className="text-lg font-medium" style={{ color: 'var(--color-base)' }}>
                            {t('startup.variables')}
                        </h3>
                    </div>
                    <div css={tw`grid gap-4 md:grid-cols-2`}>
                        {data.variables.map((variable) => (
                            <VariableBox
                                key={variable.envVariable}
                                variable={variable}
                                forceReadOnly={!canEditStartupVariables}
                            />
                        ))}
                    </div>
                </div>
            )}
        </ServerContentBlock>
    );
};

export default StartupContainer;
