import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Spinner from '@/components/elements/Spinner';
import { useFlashKey } from '@/plugins/useFlash';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import { ServerContext } from '@/state/server';
import AllocationRow from '@/components/server/network/AllocationRow';
import Button from '@/components/elements/Button';
import createServerAllocation from '@/api/server/network/createServerAllocation';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import Can from '@/components/elements/Can';
import SpinnerOverlay from '@/components/elements/SpinnerOverlay';
import getServerAllocations from '@/api/swr/getServerAllocations';
import isEqual from 'react-fast-compare';
import { useDeepCompareEffect } from '@/plugins/useDeepCompareEffect';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGlobe, faServer, faCopy } from '@fortawesome/free-solid-svg-icons';
import CopyOnClick from '@/components/elements/CopyOnClick';
import PrivacyServerHostBlur from '@/components/elements/PrivacyServerHostBlur';

const Container = styled.div`
    ${tw`space-y-6`};
`;

const Section = styled.div`
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    overflow: hidden;
`;

const SectionHeader = styled.div`
    ${tw`flex items-center px-4 py-3`};
    background-color: var(--color-background);
    border-bottom: 1px solid var(--color-neutral);
    
    svg {
        ${tw`mr-3`};
        color: var(--color-inverted);
    }
    
    h3 {
        ${tw`text-lg font-semibold`};
        color: var(--color-inverted);
        margin: 0;
    }
`;

const SectionBody = styled.div`
    ${tw`p-4 space-y-4`};
`;

const FormGroup = styled.div`
    ${tw`space-y-2`};
`;

const Label = styled.label`
    ${tw`block text-sm font-medium`};
    color: var(--color-inverted);
`;

const Input = styled.input`
    ${tw`w-full px-3 py-2 rounded transition-colors duration-150`};
    background-color: var(--color-background);
    border: 1px solid var(--color-neutral);
    color: var(--color-base);
    
    &:focus {
        outline: none;
        border-color: var(--color-primary);
    }
    
    &::placeholder {
        color: var(--color-muted);
    }
`;

const Select = styled.select`
    ${tw`w-full px-3 py-2 rounded transition-colors duration-150`};
    background-color: var(--color-background);
    border: 1px solid var(--color-neutral);
    color: var(--color-base);
    
    &:focus {
        outline: none;
        border-color: var(--color-primary);
    }
`;

const DNSRecordsGrid = styled.div`
    ${tw`space-y-3`};
`;

const DNSRecordCard = styled.div`
    background-color: var(--color-background);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 6px);
    ${tw`p-4`};
`;

const DNSRecordRow = styled.div`
    ${tw`flex items-start justify-between mb-2`};
    
    &:last-child {
        margin-bottom: 0;
    }
`;

const DNSRecordLabel = styled.div`
    ${tw`text-xs font-medium uppercase`};
    color: var(--color-muted);
    margin-bottom: 4px;
`;

const DNSRecordValue = styled.div`
    ${tw`font-mono text-sm break-all`};
    color: var(--color-inverted);
`;

const CopyButton = styled.button`
    ${tw`ml-3 px-2 py-1 rounded transition-colors duration-150 flex-shrink-0`};
    background-color: transparent;
    border: 1px solid var(--color-neutral);
    color: var(--color-inverted);
    cursor: pointer;
    
    &:hover {
        background-color: var(--color-background-secondary);
        border-color: var(--color-primary);
    }
    
    svg {
        font-size: 0.875rem;
    }
`;

const InfoBox = styled.div`
    ${tw`p-3 rounded text-sm`};
    background-color: var(--color-background);
    border: 1px solid var(--color-neutral);
    color: var(--color-muted);
`;

interface GameType {
    id: string;
    name: string;
    defaultPort: number;
    usesSRV: boolean;
    srvService?: string;
    srvProtocol?: string;
}

const GAME_TYPES: GameType[] = [
    { id: 'minecraft-java', name: 'Minecraft Java Edition', defaultPort: 25565, usesSRV: true, srvService: 'minecraft', srvProtocol: 'tcp' },
    { id: 'hytale', name: 'Hytale', defaultPort: 5520, usesSRV: true, srvService: 'hytale', srvProtocol: 'tcp' },
    { id: 'minecraft-bedrock', name: 'Minecraft Bedrock Edition', defaultPort: 19132, usesSRV: false },
    { id: 'rust', name: 'Rust', defaultPort: 28015, usesSRV: false },
    { id: 'ark', name: 'ARK: Survival Evolved', defaultPort: 7777, usesSRV: false },
    { id: 'valheim', name: 'Valheim', defaultPort: 2456, usesSRV: false },
    { id: 'terraria', name: 'Terraria', defaultPort: 7777, usesSRV: false },
    { id: 'csgo', name: 'Counter-Strike', defaultPort: 27015, usesSRV: false },
    { id: 'teamspeak', name: 'TeamSpeak', defaultPort: 9987, usesSRV: true, srvService: 'ts3', srvProtocol: 'udp' },
    { id: 'mumble', name: 'Mumble', defaultPort: 64738, usesSRV: false },
    { id: 'gmod', name: "Garry's Mod", defaultPort: 27015, usesSRV: false },
    { id: 'fivem', name: 'FiveM', defaultPort: 30120, usesSRV: false },
    { id: 'other', name: 'Other / Generic', defaultPort: 25565, usesSRV: false },
];

interface DNSRecord {
    type: string;
    name: string;
    content: string;
    note?: string;
}

const NetworkContainer = () => {
    const { t } = useTranslation('server');
    const [loading, setLoading] = useState(false);
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const allocationLimit = ServerContext.useStoreState((state) => state.server.data!.featureLimits.allocations);
    const allocations = ServerContext.useStoreState((state) => state.server.data!.allocations, isEqual);
    const setServerFromState = ServerContext.useStoreActions((actions) => actions.server.setServerFromState);
    const primaryAllocation = allocations.find((a) => a.isDefault) ?? allocations[0];
    
    const { clearFlashes, clearAndAddHttpError } = useFlashKey('server:network');
    const { data, error, mutate } = getServerAllocations();
    
    const [domain, setDomain] = useState('');
    const [selectedGameType, setSelectedGameType] = useState<string>('minecraft-java');
    
    const gameType = GAME_TYPES.find(g => g.id === selectedGameType);

    useEffect(() => {
        mutate(allocations);
    }, []);

    useEffect(() => {
        clearAndAddHttpError(error);
    }, [error]);

    useDeepCompareEffect(() => {
        if (!data) return;

        setServerFromState((state) => ({ ...state, allocations: data }));
    }, [data]);

    const onCreateAllocation = () => {
        clearFlashes();

        setLoading(true);
        createServerAllocation(uuid)
            .then((allocation) => {
                setServerFromState((s) => ({ ...s, allocations: s.allocations.concat(allocation) }));
                return mutate(data?.concat(allocation), false);
            })
            .catch((error) => clearAndAddHttpError(error))
            .then(() => setLoading(false));
    };

    useEffect(() => {
        const handler = () => onCreateAllocation();
        window.addEventListener('luna:keybind:allocate-port', handler as EventListener);
        return () => window.removeEventListener('luna:keybind:allocate-port', handler as EventListener);
    }, [onCreateAllocation]);
    
    const dnsRecords = useMemo<DNSRecord[]>(() => {
        if (!domain || !primaryAllocation || !gameType) return [];
        
        const records: DNSRecord[] = [];
        const serverPort = primaryAllocation.port;
        const cleanDomain = domain.toLowerCase().trim();
        
        records.push({
            type: 'A',
            name: cleanDomain,
            content: primaryAllocation.alias ? 'Use the hostname from your provider' : primaryAllocation.ip,
            note: primaryAllocation.alias ? 'Your server uses a hostname alias. Create an A record pointing to the IP provided by your hosting provider.' : undefined
        });
        
        if (gameType.usesSRV && serverPort !== gameType.defaultPort) {
            const srvName = `_${gameType.srvService}._${gameType.srvProtocol}.${cleanDomain}`;
            const srvContent = `0 5 ${serverPort} ${cleanDomain}`;
            
            records.push({
                type: 'SRV',
                name: srvName,
                content: srvContent,
                note: `This SRV record allows players to connect using just "${cleanDomain}" without specifying the port`
            });
        }
        
        if (!gameType.usesSRV && serverPort !== gameType.defaultPort) {
            records.push({
                type: 'Note',
                name: 'Port Number',
                content: `Players must include :${serverPort} when connecting`,
                note: `Example: ${cleanDomain}:${serverPort}`
            });
        }
        
        return records;
    }, [domain, selectedGameType, primaryAllocation, gameType]);
    
    return (
        <ServerContentBlock showFlashKey={'server:network'} title={t('network.title')}>
            <Container>
                <Section>
                    <SectionHeader>
                        <FontAwesomeIcon icon={faServer} />
                        <h3>Port Allocations</h3>
                    </SectionHeader>
                    <SectionBody>
                        {!data ? (
                            <Spinner size={'large'} centered />
                        ) : (
                            <>
                                <div css={tw`space-y-2`}>
                                    {data.map((allocation) => (
                                        <AllocationRow key={`${allocation.ip}:${allocation.port}`} allocation={allocation} />
                                    ))}
                                </div>
                                {allocationLimit > 0 && (
                                    <Can action={'allocation.create'}>
                                        <SpinnerOverlay visible={loading} />
                                        <div css={tw`mt-6 sm:flex items-center justify-end`}>
                                            <p css={tw`text-sm text-neutral-300 mb-4 sm:mr-6 sm:mb-0`}>
                                                {t('network.usage', { current: data.length, limit: allocationLimit })}
                                            </p>
                                            {allocationLimit > data.length && (
                                                <Button css={tw`w-full sm:w-auto`} color={'primary'} onClick={onCreateAllocation}>
                                                    {t('network.create')}
                                                </Button>
                                            )}
                                        </div>
                                    </Can>
                                )}
                            </>
                        )}
                    </SectionBody>
                </Section>

                <Section>
                    <SectionHeader>
                        <FontAwesomeIcon icon={faGlobe} />
                        <h3>Domain Configuration</h3>
                    </SectionHeader>
                    <SectionBody>
                        <FormGroup>
                            <Label>Your Domain</Label>
                            <Input
                                type="text"
                                placeholder="play.example.com"
                                value={domain}
                                onChange={(e) => setDomain(e.target.value)}
                            />
                        </FormGroup>
                        
                        <FormGroup>
                            <Label>Game Type</Label>
                            <Select value={selectedGameType} onChange={(e) => setSelectedGameType(e.target.value)}>
                                {GAME_TYPES.map((game) => (
                                    <option key={game.id} value={game.id}>
                                        {game.name}
                                    </option>
                                ))}
                            </Select>
                        </FormGroup>
                        
                        <InfoBox>
                            <strong>Current Server Address:</strong>{' '}
                            <PrivacyServerHostBlur>
                                {primaryAllocation?.alias || primaryAllocation?.ip}:{primaryAllocation?.port}
                            </PrivacyServerHostBlur>
                        </InfoBox>
                    </SectionBody>
                </Section>
                
                {domain && dnsRecords.length > 0 && (
                    <Section>
                        <SectionHeader>
                            <FontAwesomeIcon icon={faServer} />
                            <h3>Required DNS Records</h3>
                        </SectionHeader>
                        <SectionBody>
                            <DNSRecordsGrid>
                                {dnsRecords.map((record, index) => (
                                    <DNSRecordCard key={index}>
                                        <DNSRecordRow>
                                            <div style={{ flex: 1 }}>
                                                <DNSRecordLabel>Type</DNSRecordLabel>
                                                <DNSRecordValue>{record.type}</DNSRecordValue>
                                            </div>
                                        </DNSRecordRow>
                                        
                                        <DNSRecordRow>
                                            <div style={{ flex: 1 }}>
                                                <DNSRecordLabel>Name / Host</DNSRecordLabel>
                                                <DNSRecordValue>{record.name}</DNSRecordValue>
                                            </div>
                                            <CopyOnClick text={record.name}>
                                                <CopyButton>
                                                    <FontAwesomeIcon icon={faCopy} />
                                                </CopyButton>
                                            </CopyOnClick>
                                        </DNSRecordRow>
                                        
                                        <DNSRecordRow>
                                            <div style={{ flex: 1 }}>
                                                <DNSRecordLabel>Content / Value</DNSRecordLabel>
                                                <DNSRecordValue>{record.content}</DNSRecordValue>
                                            </div>
                                            <CopyOnClick text={record.content}>
                                                <CopyButton>
                                                    <FontAwesomeIcon icon={faCopy} />
                                                </CopyButton>
                                            </CopyOnClick>
                                        </DNSRecordRow>
                                        
                                        {record.note && (
                                            <InfoBox style={{ marginTop: '12px' }}>
                                                {record.note}
                                            </InfoBox>
                                        )}
                                    </DNSRecordCard>
                                ))}
                            </DNSRecordsGrid>
                        </SectionBody>
                    </Section>
                )}
            </Container>
        </ServerContentBlock>
    );
};

export default NetworkContainer;
