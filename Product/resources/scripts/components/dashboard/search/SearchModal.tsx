import React, { useEffect, useRef, useState } from 'react';
import Modal, { RequiredModalProps } from '@/components/elements/Modal';
import { Actions, useStoreActions, useStoreState } from 'easy-peasy';
import getServers from '@/api/getServers';
import { Server } from '@/api/server/getServer';
import { ApplicationStore } from '@/state';
import { Link } from 'react-router-dom';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { ip } from '@/lib/formatters';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faServer } from '@fortawesome/free-solid-svg-icons';
import Spinner from '@/components/elements/Spinner';
import PrivacyServerHostBlur from '@/components/elements/PrivacyServerHostBlur';

type Props = RequiredModalProps;

const ServerResult = styled(Link)`
    ${tw`flex items-center p-3 rounded no-underline transition-all duration-150`};
    background-color: var(--color-background);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);

    &:hover {
        border-color: var(--color-primary);
        background-color: var(--color-background-secondary);
    }

    &:not(:last-of-type) {
        ${tw`mb-2`};
    }
`;

const SearchInput = styled.div`
    ${tw`relative mb-4`};
    
    input {
        ${tw`w-full pl-10 pr-4 py-3 text-sm`};
        background-color: var(--color-background);
        border: 1px solid var(--color-neutral);
        border-radius: var(--border-radius, 8px);
        color: var(--color-base);
        outline: none;
        transition: border-color 150ms ease;
        
        &:focus {
            border-color: var(--color-primary);
        }
        
        &::placeholder {
            color: var(--color-muted);
        }
    }
    
    svg {
        ${tw`absolute left-3 top-1/2 transform -translate-y-1/2`};
        color: var(--color-muted);
    }
`;

export default ({ ...props }: Props) => {
    const ref = useRef<HTMLInputElement>(null);
    const isAdmin = useStoreState((state) => state.user.data!.rootAdmin);
    const [servers, setServers] = useState<Server[]>([]);
    const [filteredServers, setFilteredServers] = useState<Server[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const { clearAndAddHttpError, clearFlashes } = useStoreActions(
        (actions: Actions<ApplicationStore>) => actions.flashes
    );

    // Load servers when modal opens
    useEffect(() => {
        if (props.visible) {
            setLoading(true);
            clearFlashes('search');
            
            getServers({ type: isAdmin ? 'admin-all' : undefined })
                .then((result) => {
                    setServers(result.items);
                    setFilteredServers(result.items);
                })
                .catch((error) => {
                    console.error(error);
                    clearAndAddHttpError({ key: 'search', error });
                })
                .finally(() => setLoading(false));
                
            setTimeout(() => ref.current?.focus(), 100);
        } else {
            setSearchTerm('');
            setServers([]);
            setFilteredServers([]);
        }
    }, [props.visible]);

    // Filter servers based on search term
    useEffect(() => {
        if (!searchTerm.trim()) {
            setFilteredServers(servers);
        } else {
            const term = searchTerm.toLowerCase();
            setFilteredServers(
                servers.filter((server) =>
                    server.name.toLowerCase().includes(term) ||
                    server.uuid.toLowerCase().includes(term) ||
                    server.allocations.some(
                        (alloc) =>
                            alloc.ip.includes(term) ||
                            alloc.port.toString().includes(term) ||
                            (alloc.alias && alloc.alias.toLowerCase().includes(term))
                    )
                )
            );
        }
    }, [searchTerm, servers]);

    return (
        <Modal {...props}>
            <div className="mb-2">
                <h2 className="text-lg font-medium" style={{ color: 'var(--color-base)' }}>
                    Quick Switch
                </h2>
                <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                    Select a server to switch to
                </p>
            </div>
            
            <SearchInput>
                <FontAwesomeIcon style={{ marginTop: "-7px"}} icon={faSearch} />
                <input
                    ref={ref}
                    type="text"
                    placeholder="Search servers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </SearchInput>
            
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Spinner size="base" />
                    </div>
                ) : filteredServers.length === 0 ? (
                    <div className="text-center py-8" style={{ color: 'var(--color-muted)' }}>
                        {searchTerm ? 'No servers match your search.' : 'No servers found.'}
                    </div>
                ) : (
                    filteredServers.map((server) => (
                        <ServerResult
                            key={server.uuid}
                            to={`/server/${server.id}`}
                            onClick={() => props.onDismissed()}
                        >
                            <div className="flex items-center flex-1 min-w-0 mr-3">
                                <FontAwesomeIcon 
                                    icon={faServer} 
                                    className="mr-3 flex-shrink-0"
                                    style={{ color: 'var(--color-primary)' }}
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-base)' }}>
                                        {server.name}
                                    </p>
                                    <p className="text-xs truncate" style={{ color: 'var(--color-inverted)' }}>
                                        {server.allocations
                                            .filter((alloc) => alloc.isDefault)
                                            .map((allocation) => (
                                                <span key={allocation.ip + allocation.port.toString()}>
                                                    {allocation.alias ? (
                                                        `${allocation.alias}:${allocation.port}`
                                                    ) : (
                                                        <PrivacyServerHostBlur>
                                                            {`${ip(allocation.ip)}:${allocation.port}`}
                                                        </PrivacyServerHostBlur>
                                                    )}
                                                </span>
                                            ))}
                                    </p>
                                </div>
                            </div>
                            <div className="flex-shrink-0 text-right">
                                <span
                                    className="text-xs py-1 px-2 rounded"
                                    style={{
                                        backgroundColor: 'var(--color-neutral)',
                                        color: 'var(--color-muted)',
                                    }}
                                >
                                    {server.node}
                                </span>
                            </div>
                        </ServerResult>
                    ))
                )}
            </div>
        </Modal>
    );
};
