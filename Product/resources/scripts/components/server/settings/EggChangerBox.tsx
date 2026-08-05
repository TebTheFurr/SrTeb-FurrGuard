import React, { useState, useEffect } from 'react';
import { ServerContext } from '@/state/server';
import { getEggChangerStatus, changeEgg, EggChangerStatus } from '@/api/server/egg';
import { Actions, useStoreActions } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import { httpErrorToHuman } from '@/api/http';
import { Button } from '@/components/elements/button/index';
import { Dialog } from '@/components/elements/dialog';
import styled from 'styled-components/macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEgg, faCheck, faServer, faCopy } from '@fortawesome/free-solid-svg-icons';
import tw from 'twin.macro';
import Spinner from '@/components/elements/Spinner';
import Select from '@/components/elements/Select';
import PrivacyServerHostBlur from '@/components/elements/PrivacyServerHostBlur';

const Card = styled.div`
    background: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    overflow: hidden;
`;

const CardHeader = styled.div`
    ${tw`px-5 py-4 flex items-center gap-3`};
    border-bottom: 1px solid var(--color-neutral);
`;

const CardBody = styled.div`
    ${tw`p-5`};
`;

const CardFooter = styled.div`
    ${tw`px-5 py-4 flex items-center justify-between`};
    background: color-mix(in srgb, var(--color-neutral) 30%, transparent);
    border-top: 1px solid var(--color-neutral);
`;

const CurrentEggRow = styled.div`
    ${tw`flex items-center justify-between mb-5 pb-4`};
    border-bottom: 1px solid var(--color-neutral);
`;

const CurrentEggLabel = styled.span`
    ${tw`text-sm`};
    color: var(--color-muted);
`;

const CurrentEggName = styled.span`
    ${tw`text-sm font-medium`};
    color: var(--color-base);
`;

const SelectWrapper = styled.div`
    ${tw`mb-4`};
`;

const Label = styled.label`
    ${tw`flex items-center gap-2 text-xs uppercase tracking-wider mb-2`};
    color: var(--color-inverted);
    font-weight: 500;
`;

const ModalCheckboxGroup = styled.div`
    ${tw`flex flex-col gap-2 mt-4`};
`;

const CheckboxLabel = styled.label<{ $checked?: boolean }>`
    ${tw`flex items-center gap-3 cursor-pointer p-3 rounded-lg transition-all`};
    background: ${props => props.$checked ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'var(--color-background)'};
    border: 1px solid ${props => props.$checked ? 'var(--color-primary)' : 'var(--color-neutral)'};
    
    &:hover {
        border-color: var(--color-primary);
    }
`;

const Checkbox = styled.div<{ $checked?: boolean }>`
    ${tw`flex items-center justify-center flex-shrink-0`};
    width: 20px;
    height: 20px;
    border-radius: 4px;
    background: ${props => props.$checked ? 'var(--color-primary)' : 'transparent'};
    border: 2px solid ${props => props.$checked ? 'var(--color-primary)' : 'var(--color-muted)'};
    transition: all 0.15s ease;
    
    svg {
        color: #fff;
        font-size: 10px;
        opacity: ${props => props.$checked ? 1 : 0};
    }
`;

const CheckboxContent = styled.div`
    ${tw`flex flex-col`};
`;

const CheckboxTitle = styled.span`
    ${tw`font-medium text-sm`};
    color: var(--color-base);
`;

const CheckboxDescription = styled.span`
    ${tw`text-xs mt-0.5`};
    color: var(--color-muted);
`;

const EmptyState = styled.div`
    ${tw`text-center py-8`};
    color: var(--color-muted);
`;

const ForcedOptionNote = styled.div`
    ${tw`flex items-center gap-2 text-xs px-3 py-2 rounded-lg`};
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
    color: var(--color-primary);
    
    svg {
        font-size: 10px;
    }
`;

const SrvSection = styled.div`
    ${tw`mt-5 pt-4`};
    border-top: 1px solid var(--color-neutral);
`;

const SrvToggle = styled.button<{ $expanded?: boolean }>`
    ${tw`w-full flex items-center justify-between py-2 cursor-pointer`};
    background: none;
    border: none;
    padding: 0;
    color: var(--color-base);
`;

const SrvInput = styled.input`
    ${tw`w-full px-3 py-2 text-sm rounded-lg mt-3`};
    background: var(--color-background);
    border: 1px solid var(--color-neutral);
    color: var(--color-base);
    outline: none;
    
    &:focus {
        border-color: var(--color-primary);
    }
`;

const SrvResult = styled.div`
    ${tw`mt-3 rounded-lg overflow-hidden`};
    border: 1px solid var(--color-neutral);
`;

const SrvRow = styled.div`
    ${tw`flex items-center justify-between px-3 py-2`};
    
    &:not(:last-child) {
        border-bottom: 1px solid var(--color-neutral);
    }
    
    &:nth-child(even) {
        background: color-mix(in srgb, var(--color-neutral) 20%, transparent);
    }
`;

const SrvLabel = styled.span`
    ${tw`text-xs font-medium uppercase tracking-wider`};
    color: var(--color-muted);
`;

const SrvValue = styled.span`
    ${tw`text-sm`};
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    color: var(--color-base);
    word-break: break-all;
`;

const CopyButton = styled.button`
    ${tw`ml-2 p-1 rounded cursor-pointer flex-shrink-0`};
    background: none;
    border: none;
    color: var(--color-muted);
    font-size: 11px;
    transition: color 0.15s ease;
    
    &:hover {
        color: var(--color-primary);
    }
`;

export default () => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const [status, setStatus] = useState<EggChangerStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedEggId, setSelectedEggId] = useState<number | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [reinstall, setReinstall] = useState(false);
    const [changeStartup, setChangeStartup] = useState(false);
    const [clearFiles, setClearFiles] = useState(false);
    const [srvDomain, setSrvDomain] = useState('');
    const [srvExpanded, setSrvExpanded] = useState(false);

    const { addFlash, clearFlashes } = useStoreActions((actions: Actions<ApplicationStore>) => actions.flashes);

    const loadStatus = async () => {
        setLoading(true);
        try {
            const data = await getEggChangerStatus(uuid);
            setStatus(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStatus();
    }, [uuid]);

    const handleOpenModal = () => {
        if (!selectedEggId) return;
        setReinstall(status?.always_reinstall || false);
        setChangeStartup(status?.always_change_startup || false);
        setClearFiles(false);
        setModalOpen(true);
    };

    const handleChangeEgg = async () => {
        if (!selectedEggId) return;
        
        clearFlashes('settings');
        setSubmitting(true);
        
        try {
            const response = await changeEgg(
                uuid,
                selectedEggId,
                status?.always_reinstall ? true : reinstall,
                status?.always_change_startup ? true : changeStartup,
                clearFiles
            );

            const successDetails = [
                response.reinstalled ? 'Server is reinstalling.' : null,
                response.files_cleared ? 'Server files were cleared.' : null,
            ].filter(Boolean).join(' ');
            
            addFlash({
                key: 'settings',
                type: 'success',
                message: `Egg changed to ${response.new_egg_name}.${successDetails ? ` ${successDetails}` : ''}`,
            });
            
            setModalOpen(false);
            setSelectedEggId(null);
            loadStatus();
            
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (error: any) {
            console.error(error);
            addFlash({
                key: 'settings',
                type: 'error',
                message: httpErrorToHuman(error),
            });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardBody>
                    <div className="flex items-center justify-center py-8">
                        <Spinner size="large" />
                    </div>
                </CardBody>
            </Card>
        );
    }

    if (!status?.enabled) {
        return null;
    }

    if (status.eggs.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <FontAwesomeIcon icon={faEgg} style={{ color: 'var(--color-primary)' }} />
                    <span className="font-medium" style={{ color: 'var(--color-base)' }}>
                        Change Egg
                    </span>
                </CardHeader>
                <CardBody>
                    <CurrentEggRow>
                        <CurrentEggLabel>Current egg</CurrentEggLabel>
                        <CurrentEggName>{status.current_egg_name}</CurrentEggName>
                    </CurrentEggRow>
                    <EmptyState>
                        <FontAwesomeIcon icon={faEgg} className="text-4xl mb-3 opacity-50" />
                        <p>No other eggs are available to switch to.</p>
                    </EmptyState>
                </CardBody>
            </Card>
        );
    }

    const selectedEgg = status.eggs.find(e => e.id === selectedEggId);

    const activeSrvConfig = selectedEggId && status.egg_srv_configs?.[selectedEggId]?.srv_service
        ? status.egg_srv_configs[selectedEggId]
        : status.srv_config;

    const hasSrv = activeSrvConfig?.srv_service;

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <FontAwesomeIcon icon={faEgg} style={{ color: 'var(--color-primary)' }} />
                    <span className="font-medium" style={{ color: 'var(--color-base)' }}>
                        Change Egg
                    </span>
                </CardHeader>
                
                <CardBody>
                    <CurrentEggRow>
                        <CurrentEggLabel>Current egg</CurrentEggLabel>
                        <CurrentEggName>{status.current_egg_name}</CurrentEggName>
                    </CurrentEggRow>

                    <SelectWrapper>
                        <Label>Switch to</Label>
                        <Select
                            value={selectedEggId?.toString() || ''}
                            onChange={(e) => setSelectedEggId(e.target.value ? parseInt(e.target.value) : null)}
                        >
                            <option value="">Choose an egg...</option>
                            {status.eggs.map((egg) => (
                                <option key={egg.id} value={egg.id}>
                                    {egg.name} ({egg.nest_name})
                                </option>
                            ))}
                        </Select>
                    </SelectWrapper>

                    {hasSrv && (
                        <SrvSection>
                            <SrvToggle $expanded={srvExpanded} onClick={() => setSrvExpanded(!srvExpanded)}>
                                <Label style={{ margin: 0, cursor: 'pointer' }}>
                                    <FontAwesomeIcon icon={faServer} />
                                    SRV Record Generator
                                </Label>
                                <FontAwesomeIcon
                                    icon={faEgg}
                                    style={{
                                        fontSize: '10px',
                                        color: 'var(--color-muted)',
                                        transform: srvExpanded ? 'rotate(180deg)' : 'rotate(0)',
                                        transition: 'transform 0.2s ease',
                                    }}
                                />
                            </SrvToggle>
                            {srvExpanded && (
                                <>
                                    <p className="text-xs" style={{ color: 'var(--color-muted)', marginBottom: '4px' }}>
                                        Enter your domain below to generate the DNS records you need to create.
                                    </p>
                                    <SrvInput
                                        placeholder="play.example.com"
                                        value={srvDomain}
                                        onChange={(e) => setSrvDomain(e.target.value.toLowerCase().trim())}
                                    />
                                    {srvDomain && (
                                        <SrvResult>
                                            <SrvRow>
                                                <SrvLabel>Type</SrvLabel>
                                                <div className="flex items-center">
                                                    <SrvValue>SRV</SrvValue>
                                                </div>
                                            </SrvRow>
                                            <SrvRow>
                                                <SrvLabel>Name</SrvLabel>
                                                <div className="flex items-center">
                                                    <SrvValue>
                                                        {activeSrvConfig.srv_service}.{activeSrvConfig.srv_protocol}.{srvDomain}
                                                    </SrvValue>
                                                    <CopyButton onClick={() => handleCopy(`${activeSrvConfig.srv_service}.${activeSrvConfig.srv_protocol}.${srvDomain}`)}>
                                                        <FontAwesomeIcon icon={faCopy} />
                                                    </CopyButton>
                                                </div>
                                            </SrvRow>
                                            <SrvRow>
                                                <SrvLabel>Priority</SrvLabel>
                                                <SrvValue>0</SrvValue>
                                            </SrvRow>
                                            <SrvRow>
                                                <SrvLabel>Weight</SrvLabel>
                                                <SrvValue>5</SrvValue>
                                            </SrvRow>
                                            <SrvRow>
                                                <SrvLabel>Port</SrvLabel>
                                                <div className="flex items-center">
                                                    <SrvValue>{status.allocation_port}</SrvValue>
                                                    <CopyButton onClick={() => handleCopy(String(status.allocation_port))}>
                                                        <FontAwesomeIcon icon={faCopy} />
                                                    </CopyButton>
                                                </div>
                                            </SrvRow>
                                            <SrvRow>
                                                <SrvLabel>Target</SrvLabel>
                                                <div className="flex items-center">
                                                    <SrvValue>
                                                        {status.allocation_ip ? (
                                                            <PrivacyServerHostBlur>{status.allocation_ip}</PrivacyServerHostBlur>
                                                        ) : (
                                                            srvDomain
                                                        )}
                                                    </SrvValue>
                                                    <CopyButton onClick={() => handleCopy(status.allocation_ip || srvDomain)}>
                                                        <FontAwesomeIcon icon={faCopy} />
                                                    </CopyButton>
                                                </div>
                                            </SrvRow>
                                        </SrvResult>
                                    )}
                                </>
                            )}
                        </SrvSection>
                    )}
                </CardBody>
                
                <CardFooter>
                    <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                        Changes take effect immediately.
                    </p>
                    <Button 
                        onClick={handleOpenModal}
                        disabled={!selectedEggId}
                    >
                        Change
                    </Button>
                </CardFooter>
            </Card>

            <Dialog 
                open={modalOpen} 
                onClose={() => !submitting && setModalOpen(false)}
                title="Change Server Egg"
                description={`You are about to change your server's egg from ${status.current_egg_name} to ${selectedEgg?.name}.`}
            >
                <ModalCheckboxGroup>
                    {status.always_reinstall ? (
                        <ForcedOptionNote>
                            <FontAwesomeIcon icon={faCheck} />
                            Server will be reinstalled (required by administrator)
                        </ForcedOptionNote>
                    ) : (
                        <CheckboxLabel $checked={reinstall} onClick={() => setReinstall(!reinstall)}>
                            <Checkbox $checked={reinstall}>
                                <FontAwesomeIcon icon={faCheck} />
                            </Checkbox>
                            <CheckboxContent>
                                <CheckboxTitle>Reinstall Server</CheckboxTitle>
                                <CheckboxDescription>
                                    Reinstall with the new egg&apos;s installation script
                                </CheckboxDescription>
                            </CheckboxContent>
                        </CheckboxLabel>
                    )}

                    {status.always_change_startup ? (
                        <ForcedOptionNote>
                            <FontAwesomeIcon icon={faCheck} />
                            Startup command will be changed (required by administrator)
                        </ForcedOptionNote>
                    ) : (
                        <CheckboxLabel $checked={changeStartup} onClick={() => setChangeStartup(!changeStartup)}>
                            <Checkbox $checked={changeStartup}>
                                <FontAwesomeIcon icon={faCheck} />
                            </Checkbox>
                            <CheckboxContent>
                                <CheckboxTitle>Change Startup Command</CheckboxTitle>
                                <CheckboxDescription>
                                    Replace with the new egg&apos;s default command
                                </CheckboxDescription>
                            </CheckboxContent>
                        </CheckboxLabel>
                    )}

                    <CheckboxLabel $checked={clearFiles} onClick={() => setClearFiles(!clearFiles)}>
                        <Checkbox $checked={clearFiles}>
                            <FontAwesomeIcon icon={faCheck} />
                        </Checkbox>
                        <CheckboxContent>
                            <CheckboxTitle>
                                Clear All Files
                            </CheckboxTitle>
                            <CheckboxDescription>
                                Delete all files and folders from the server root during the egg change
                            </CheckboxDescription>
                        </CheckboxContent>
                    </CheckboxLabel>
                </ModalCheckboxGroup>

                <Dialog.Footer>
                    <Button.Text onClick={() => setModalOpen(false)} disabled={submitting}>
                        Cancel
                    </Button.Text>
                    <Button onClick={handleChangeEgg} disabled={submitting}>
                        {submitting ? 'Changing...' : 'Confirm Change'}
                    </Button>
                </Dialog.Footer>
            </Dialog>
        </>
    );
};
