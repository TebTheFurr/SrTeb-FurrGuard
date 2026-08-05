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
import { faGlobe, faNetworkWired, faSitemap } from '@fortawesome/free-solid-svg-icons';
import PrivacyServerHostBlur from '@/components/elements/PrivacyServerHostBlur';
import EmptyState from '@/components/elements/EmptyState';
import PageHeader from '@/components/elements/ui/PageHeader';
import DataField from '@/components/elements/ui/DataField';
import Panel, { PanelBody, PanelHeader } from '@/components/elements/ui/Panel';

const Sections = styled.div`
    ${tw`space-y-4`};
`;

const FormGrid = styled.div`
    ${tw`grid gap-4`};
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
`;

const FormGroup = styled.div`
    ${tw`space-y-1.5 min-w-0`};
`;

const Label = styled.label`
    ${tw`block text-xs font-medium uppercase tracking-wide`};
    color: var(--color-muted);
`;

const fieldStyles = `
    width: 100%;
    padding: 0.5rem 0.75rem;
    background-color: var(--color-background);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    color: var(--color-base);
    transition: border-color 150ms ease;

    &:focus {
        outline: none;
        border-color: var(--color-primary);
    }
`;

const Input = styled.input`
    ${fieldStyles};
    ${tw`text-sm`};

    &::placeholder {
        color: var(--color-inverted);
    }
`;

const Select = styled.select`
    ${fieldStyles};
    ${tw`text-sm`};
`;

const AllocationList = styled.div`
    ${tw`space-y-2`};
`;

const UsageBar = styled.div`
    ${tw`flex flex-wrap items-center justify-between gap-3 mt-4 pt-4`};
    border-top: 1px solid var(--color-neutral);
`;

const UsageText = styled.p`
    ${tw`text-sm`};
    color: var(--color-muted);
`;

const RecordCard = styled.div`
    ${tw`p-3 space-y-2 rounded-[var(--border-radius)]`};
    background-color: var(--color-background);
    border: 1px solid var(--color-neutral);
`;

const RecordFields = styled.div`
    ${tw`grid gap-2`};
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
`;

const RecordNote = styled.p`
    ${tw`text-xs leading-relaxed`};
    color: var(--color-muted);
`;

const RecordsGrid = styled.div`
    ${tw`space-y-3`};
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
    {
        id: 'minecraft-java',
        name: 'Minecraft Java Edition',
        defaultPort: 25565,
        usesSRV: true,
        srvService: 'minecraft',
        srvProtocol: 'tcp',
    },
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

    const gameType = GAME_TYPES.find((g) => g.id === selectedGameType);

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
            note: primaryAllocation.alias
                ? 'Your server uses a hostname alias. Create an A record pointing to the IP provided by your hosting provider.'
                : undefined,
        });

        if (gameType.usesSRV && serverPort !== gameType.defaultPort) {
            const srvName = `_${gameType.srvService}._${gameType.srvProtocol}.${cleanDomain}`;
            const srvContent = `0 5 ${serverPort} ${cleanDomain}`;

            records.push({
                type: 'SRV',
                name: srvName,
                content: srvContent,
                note: `This SRV record allows players to connect using just "${cleanDomain}" without specifying the port`,
            });
        }

        if (!gameType.usesSRV && serverPort !== gameType.defaultPort) {
            records.push({
                type: 'Note',
                name: 'Port Number',
                content: `Players must include :${serverPort} when connecting`,
                note: `Example: ${cleanDomain}:${serverPort}`,
            });
        }

        return records;
    }, [domain, selectedGameType, primaryAllocation, gameType]);

    const currentAddress = primaryAllocation
        ? `${primaryAllocation.alias || primaryAllocation.ip}:${primaryAllocation.port}`
        : null;

    return (
        <ServerContentBlock showFlashKey={'server:network'} title={t('network.title')}>
            <PageHeader title={t('network.title')} description={t('network.allocations_hint')} />

            <Sections>
                <Panel>
                    <PanelHeader
                        icon={faNetworkWired}
                        title={t('network.allocations_title')}
                        hint={
                            data && allocationLimit > 0
                                ? t('network.usage', { current: data.length, limit: allocationLimit })
                                : undefined
                        }
                    />
                    <PanelBody>
                        {!data ? (
                            <Spinner size={'large'} centered />
                        ) : data.length === 0 ? (
                            <EmptyState title={t('network.empty.title')} message={t('network.empty.message')} />
                        ) : (
                            <AllocationList>
                                {data.map((allocation) => (
                                    <AllocationRow
                                        key={`${allocation.ip}:${allocation.port}`}
                                        allocation={allocation}
                                    />
                                ))}
                            </AllocationList>
                        )}

                        {data && allocationLimit > 0 && (
                            <Can action={'allocation.create'}>
                                <SpinnerOverlay visible={loading} />
                                <UsageBar>
                                    <UsageText>
                                        {t('network.usage', { current: data.length, limit: allocationLimit })}
                                    </UsageText>
                                    {allocationLimit > data.length && (
                                        <Button color={'primary'} onClick={onCreateAllocation}>
                                            {t('network.create')}
                                        </Button>
                                    )}
                                </UsageBar>
                            </Can>
                        )}
                    </PanelBody>
                </Panel>

                <Panel>
                    <PanelHeader
                        icon={faGlobe}
                        title={t('network.domain_title')}
                        hint={t('network.domain_hint')}
                    />
                    <PanelBody>
                        <FormGrid>
                            <FormGroup>
                                <Label htmlFor={'network-domain'}>{t('network.domain_label')}</Label>
                                <Input
                                    id={'network-domain'}
                                    type={'text'}
                                    placeholder={'play.example.com'}
                                    value={domain}
                                    onChange={(e) => setDomain(e.target.value)}
                                />
                            </FormGroup>

                            <FormGroup>
                                <Label htmlFor={'network-game-type'}>{t('network.game_type')}</Label>
                                <Select
                                    id={'network-game-type'}
                                    value={selectedGameType}
                                    onChange={(e) => setSelectedGameType(e.target.value)}
                                >
                                    {GAME_TYPES.map((game) => (
                                        <option key={game.id} value={game.id}>
                                            {game.name}
                                        </option>
                                    ))}
                                </Select>
                            </FormGroup>
                        </FormGrid>

                        {currentAddress && (
                            <div css={tw`mt-4`}>
                                <DataField
                                    icon={faNetworkWired}
                                    label={t('network.current_address')}
                                    value={<PrivacyServerHostBlur>{currentAddress}</PrivacyServerHostBlur>}
                                    copyValue={currentAddress}
                                    mono
                                />
                            </div>
                        )}
                    </PanelBody>
                </Panel>

                {domain && dnsRecords.length > 0 && (
                    <Panel>
                        <PanelHeader icon={faSitemap} title={t('network.dns_title')} hint={t('network.dns_hint')} />
                        <PanelBody>
                            <RecordsGrid>
                                {dnsRecords.map((record, index) => (
                                    <RecordCard key={`${record.type}-${index}`}>
                                        <RecordFields>
                                            <DataField label={t('network.dns_type')} value={record.type} mono />
                                            <DataField
                                                label={t('network.dns_name')}
                                                value={record.name}
                                                copyValue={record.name}
                                                mono
                                            />
                                            <DataField
                                                label={t('network.dns_content')}
                                                value={record.content}
                                                copyValue={record.content}
                                                mono
                                            />
                                        </RecordFields>
                                        {record.note && <RecordNote>{record.note}</RecordNote>}
                                    </RecordCard>
                                ))}
                            </RecordsGrid>
                        </PanelBody>
                    </Panel>
                )}
            </Sections>
        </ServerContentBlock>
    );
};

export default NetworkContainer;
