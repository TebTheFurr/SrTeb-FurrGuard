import React, { memo, useState } from 'react';
import { ServerEggVariable } from '@/api/server/types';
import { usePermissions } from '@/plugins/usePermissions';
import InputSpinner from '@/components/elements/InputSpinner';
import Input from '@/components/elements/Input';
import Switch from '@/components/elements/Switch';
import { debounce } from 'debounce';
import updateStartupVariable from '@/api/server/updateStartupVariable';
import useFlash from '@/plugins/useFlash';
import FlashMessageRender from '@/components/FlashMessageRender';
import getServerStartup from '@/api/swr/getServerStartup';
import Select from '@/components/elements/Select';
import isEqual from 'react-fast-compare';
import { ServerContext } from '@/state/server';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash, faLock } from '@fortawesome/free-solid-svg-icons';

interface Props {
    variable: ServerEggVariable;
    forceReadOnly?: boolean;
}

const VariableCard = styled.div`
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    overflow: hidden;
`;

const VariableHeader = styled.div`
    ${tw`flex items-center justify-between px-4 py-3`};
    border-bottom: 1px solid var(--color-neutral);
`;

const VariableBody = styled.div`
    ${tw`p-4`};
`;

const EnvBadge = styled.code`
    ${tw`text-xs px-2 py-1 font-mono`};
    background-color: var(--color-background);
    border: 1px solid var(--color-neutral);
    border-radius: calc(var(--border-radius, 8px) * 0.5);
    color: var(--color-primary);
`;

const SensitiveInputWrap = styled.div`
    ${tw`flex items-center gap-2`};
`;

const MaskedValue = styled.div`
    ${tw`flex-1 min-w-0 px-3 py-2.5 border text-sm`};
    background-color: color-mix(in srgb, var(--color-background) 50%, transparent);
    border-color: var(--color-neutral);
    border-radius: calc(var(--border-radius, 12px) * 0.67);
    color: var(--color-muted);
    font-family: inherit;
`;

const VisibilityToggle = styled.button`
    ${tw`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded`};
    border: 1px solid var(--color-neutral);
    background: var(--color-background-secondary);
    color: var(--color-muted);
    transition: all 150ms ease;

    &:hover {
        color: var(--color-base);
        border-color: var(--color-primary);
    }
`;

const SENSITIVE_PATTERN = /token|key|secret|password|credential|api_key|apikey|auth/i;

const isSensitiveVariable = (variable: ServerEggVariable) =>
    SENSITIVE_PATTERN.test(variable.envVariable) || SENSITIVE_PATTERN.test(variable.name || '');

const VariableBox = ({ variable, forceReadOnly = false }: Props) => {
    const FLASH_KEY = `server:startup:${variable.envVariable}`;

    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const [loading, setLoading] = useState(false);
    const [valueRevealed, setValueRevealed] = useState(false);
    const [canEdit] = usePermissions(['startup.update']);
    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const { mutate } = getServerStartup(uuid);

    const setVariableValue = debounce((value: string) => {
        setLoading(true);
        clearFlashes(FLASH_KEY);

        updateStartupVariable(uuid, variable.envVariable, value)
            .then(([response, invocation]) =>
                mutate(
                    (data) => ({
                        ...data,
                        invocation,
                        variables: (data.variables || []).map((v) =>
                            v.envVariable === response.envVariable ? response : v
                        ),
                    }),
                    false
                )
            )
            .catch((error) => {
                console.error(error);
                clearAndAddHttpError({ error, key: FLASH_KEY });
            })
            .then(() => setLoading(false));
    }, 500);

    const useSwitch = variable.rules.some(
        (v) => v === 'boolean' || v === 'in:0,1' || v === 'in:1,0' || v === 'in:true,false' || v === 'in:false,true'
    );
    const isStringSwitch = variable.rules.some((v) => v === 'string');
    const selectValues = variable.rules.find((v) => v.startsWith('in:'))?.split(',') || [];

    return (
        <VariableCard>
            <VariableHeader>
                <div className="flex items-center min-w-0 flex-1">
                    <span 
                        className="font-medium text-sm truncate" 
                        style={{ color: 'var(--color-base)' }}
                    >
                        {variable.name}
                    </span>
                    {!variable.isEditable && (
                        <span 
                            className="ml-2 flex items-center text-xs px-2 py-0.5 rounded flex-shrink-0"
                            style={{ 
                                backgroundColor: 'var(--color-neutral)',
                                color: 'var(--color-muted)',
                            }}
                        >
                            <FontAwesomeIcon icon={faLock} className="mr-1 text-xs" />
                            Read Only
                        </span>
                    )}
                </div>
                <EnvBadge className="ml-2 flex-shrink-0">{variable.envVariable}</EnvBadge>
            </VariableHeader>
            <VariableBody>
                <FlashMessageRender byKey={FLASH_KEY} className='mb-3' />
                
                {variable.description && (
                    <p className='text-xs mb-3' style={{ color: 'var(--color-muted)' }}>
                        {variable.description}
                    </p>
                )}

                <InputSpinner visible={loading}>
                    {useSwitch ? (
                        <div className="flex items-center justify-between">
                            <span className="text-sm" style={{ color: 'var(--color-inverted)' }}>
                                {isStringSwitch 
                                    ? (variable.serverValue === 'true' ? 'Enabled' : 'Disabled')
                                    : (variable.serverValue === '1' ? 'Enabled' : 'Disabled')
                                }
                            </span>
                            <Switch
                                readOnly={!canEdit || !variable.isEditable || forceReadOnly}
                                name={variable.envVariable}
                                defaultChecked={
                                    isStringSwitch ? variable.serverValue === 'true' : variable.serverValue === '1'
                                }
                                onChange={() => {
                                    if (canEdit && variable.isEditable && !forceReadOnly) {
                                        if (isStringSwitch) {
                                            setVariableValue(variable.serverValue === 'true' ? 'false' : 'true');
                                        } else {
                                            setVariableValue(variable.serverValue === '1' ? '0' : '1');
                                        }
                                    }
                                }}
                            />
                        </div>
                    ) : (
                        <>
                            {selectValues.length > 0 ? (
                                <Select
                                    onChange={(e) => setVariableValue(e.target.value)}
                                    name={variable.envVariable}
                                    defaultValue={variable.serverValue ?? variable.defaultValue}
                                    disabled={!canEdit || !variable.isEditable || forceReadOnly}
                                >
                                    {selectValues.map((selectValue) => (
                                        <option
                                            key={selectValue.replace('in:', '')}
                                            value={selectValue.replace('in:', '')}
                                        >
                                            {selectValue.replace('in:', '')}
                                        </option>
                                    ))}
                                </Select>
                            ) : isSensitiveVariable(variable) ? (
                                <SensitiveInputWrap>
                                    {valueRevealed ? (
                                        <Input
                                            onKeyUp={(e) => {
                                                if (canEdit && variable.isEditable && !forceReadOnly) {
                                                    setVariableValue(e.currentTarget.value);
                                                }
                                            }}
                                            readOnly={!canEdit || !variable.isEditable || forceReadOnly}
                                            name={variable.envVariable}
                                            defaultValue={variable.serverValue ?? ''}
                                            placeholder={variable.defaultValue}
                                            className="flex-1 min-w-0"
                                        />
                                    ) : (
                                        <MaskedValue>*****************</MaskedValue>
                                    )}
                                    <VisibilityToggle
                                        type="button"
                                        title={valueRevealed ? 'Hide value' : 'Show value'}
                                        onClick={() => setValueRevealed((v) => !v)}
                                    >
                                        <FontAwesomeIcon icon={valueRevealed ? faEyeSlash : faEye} />
                                    </VisibilityToggle>
                                </SensitiveInputWrap>
                            ) : (
                                <Input
                                    onKeyUp={(e) => {
                                        if (canEdit && variable.isEditable && !forceReadOnly) {
                                            setVariableValue(e.currentTarget.value);
                                        }
                                    }}
                                    readOnly={!canEdit || !variable.isEditable || forceReadOnly}
                                    name={variable.envVariable}
                                    defaultValue={variable.serverValue ?? ''}
                                    placeholder={variable.defaultValue}
                                />
                            )}
                        </>
                    )}
                </InputSpinner>
            </VariableBody>
        </VariableCard>
    );
};

export default memo(VariableBox, isEqual);
