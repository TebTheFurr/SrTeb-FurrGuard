import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFilter, faPlus, faTimes, faFolder } from '@fortawesome/free-solid-svg-icons';

interface Props {
    ignoredFolders: string[];
    onChange: (folders: string[]) => void;
}

const SUGGESTIONS = [
    'node_modules', '.git', 'vendor', 'cache', 'logs',
    'dist', 'build', '__pycache__', '.next', 'target',
    'bower_components', '.svn',
];

const FilterToggle = styled.button<{ $active: boolean }>`
    ${tw`flex items-center justify-center transition-all duration-150 flex-shrink-0`};
    width: 46px;
    background-color: ${props => props.$active ? 'var(--color-primary)' : 'var(--color-background-secondary)'};
    border: 1px solid ${props => props.$active ? 'var(--color-primary)' : 'var(--color-neutral)'};
    border-radius: var(--border-radius, 8px);
    color: ${props => props.$active ? 'white' : 'var(--color-muted)'};
    font-size: 0.875rem;
    cursor: pointer;
    position: relative;

    &:hover {
        border-color: var(--color-primary);
        color: ${props => props.$active ? 'white' : 'var(--color-base)'};
    }
`;

const FilterCount = styled.span`
    ${tw`absolute flex items-center justify-center`};
    top: -5px;
    right: -5px;
    min-width: 17px;
    height: 17px;
    padding: 0 4px;
    font-size: 0.6rem;
    font-weight: 700;
    background-color: var(--color-primary);
    color: white;
    border-radius: 9px;
    line-height: 1;
    pointer-events: none;
`;

const Wrapper = styled.div`
    position: relative;
    align-self: stretch;
`;

const Dropdown = styled.div`
    ${tw`absolute z-50`};
    top: calc(100% + 6px);
    right: 0;
    width: 320px;
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
    overflow: hidden;
`;

const DropdownHeader = styled.div`
    ${tw`flex items-center justify-between px-4 py-3`};
    border-bottom: 1px solid var(--color-neutral);
    background-color: var(--color-background);
`;

const DropdownTitle = styled.span`
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-base);
    text-transform: uppercase;
    letter-spacing: 0.05em;
`;

const DropdownBody = styled.div`
    max-height: 280px;
    overflow-y: auto;
`;

const FolderItem = styled.div`
    ${tw`flex items-center justify-between px-4 py-2 transition-colors duration-100`};
    border-bottom: 1px solid var(--color-neutral);

    &:last-child {
        border-bottom: none;
    }

    &:hover {
        background-color: var(--color-background);
    }
`;

const FolderName = styled.span`
    ${tw`flex items-center gap-2 truncate`};
    font-size: 0.8125rem;
    color: var(--color-base);
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
`;

const FolderIcon = styled.span`
    color: var(--color-primary);
    font-size: 0.75rem;
    flex-shrink: 0;
`;

const RemoveBtn = styled.button`
    ${tw`flex items-center justify-center flex-shrink-0 transition-colors duration-100`};
    width: 22px;
    height: 22px;
    border-radius: 4px;
    border: none;
    background: transparent;
    color: var(--color-muted);
    font-size: 0.65rem;
    cursor: pointer;

    &:hover {
        background-color: rgba(239, 68, 68, 0.15);
        color: #ef4444;
    }
`;

const AddRow = styled.div`
    ${tw`flex items-center gap-2 px-4 py-3`};
    border-top: 1px solid var(--color-neutral);
    background-color: var(--color-background);
`;

const AddInput = styled.input`
    ${tw`flex-1 text-sm`};
    padding: 6px 10px;
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: 6px;
    color: var(--color-base);
    outline: none;
    font-size: 0.8125rem;

    &:focus {
        border-color: var(--color-primary);
    }

    &::placeholder {
        color: var(--color-muted);
    }
`;

const AddBtn = styled.button`
    ${tw`flex items-center justify-center flex-shrink-0 transition-all duration-100`};
    width: 30px;
    height: 30px;
    border-radius: 6px;
    border: 1px solid var(--color-primary);
    background-color: var(--color-primary);
    color: white;
    font-size: 0.75rem;
    cursor: pointer;

    &:hover {
        filter: brightness(1.1);
    }

    &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
`;

const SuggestionsSection = styled.div`
    ${tw`px-4 py-3`};
    border-top: 1px solid var(--color-neutral);
`;

const SuggestionsLabel = styled.div`
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--color-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 8px;
`;

const SuggestionsGrid = styled.div`
    ${tw`flex flex-wrap gap-1`};
`;

const SuggestionChip = styled.button`
    ${tw`transition-all duration-100`};
    padding: 3px 10px;
    font-size: 0.7rem;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    background-color: var(--color-background);
    border: 1px solid var(--color-neutral);
    border-radius: 4px;
    color: var(--color-muted);
    cursor: pointer;

    &:hover {
        border-color: var(--color-primary);
        color: var(--color-primary);
        background-color: var(--color-background-secondary);
    }
`;

const EmptyMessage = styled.div`
    ${tw`px-4 py-6 text-center`};
    font-size: 0.8125rem;
    color: var(--color-muted);
`;

const ClearAllBtn = styled.button`
    ${tw`transition-colors duration-100`};
    font-size: 0.6875rem;
    color: var(--color-muted);
    background: none;
    border: none;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;

    &:hover {
        color: #ef4444;
    }
`;

const SearchIgnoreFilter: React.FC<Props> = ({ ignoredFolders, onChange }) => {
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };

        if (open) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [open]);

    useEffect(() => {
        if (open && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    const addFolder = (name: string) => {
        const trimmed = name.trim().replace(/^\/+|\/+$/g, '');
        if (!trimmed) return;
        if (ignoredFolders.some(f => f.toLowerCase() === trimmed.toLowerCase())) return;
        onChange([...ignoredFolders, trimmed]);
        setInputValue('');
    };

    const removeFolder = (name: string) => {
        onChange(ignoredFolders.filter(f => f !== name));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addFolder(inputValue);
        }
    };

    const availableSuggestions = SUGGESTIONS.filter(
        s => !ignoredFolders.some(f => f.toLowerCase() === s.toLowerCase())
    );

    return (
        <Wrapper ref={wrapperRef}>
            <FilterToggle
                $active={ignoredFolders.length > 0}
                onClick={() => setOpen(!open)}
                title="Search filter: ignored folders"
            >
                <FontAwesomeIcon icon={faFilter} />
                {ignoredFolders.length > 0 && (
                    <FilterCount>{ignoredFolders.length}</FilterCount>
                )}
            </FilterToggle>

            {open && (
                <Dropdown>
                    <DropdownHeader>
                        <DropdownTitle>Ignored Folders</DropdownTitle>
                        {ignoredFolders.length > 0 && (
                            <ClearAllBtn onClick={() => onChange([])}>
                                Clear all
                            </ClearAllBtn>
                        )}
                    </DropdownHeader>

                    <DropdownBody>
                        {ignoredFolders.length === 0 ? (
                            <EmptyMessage>
                                No folders ignored yet. Add folders below to skip them during search.
                            </EmptyMessage>
                        ) : (
                            ignoredFolders.map(folder => (
                                <FolderItem key={folder}>
                                    <FolderName>
                                        <FolderIcon>
                                            <FontAwesomeIcon icon={faFolder} />
                                        </FolderIcon>
                                        {folder}
                                    </FolderName>
                                    <RemoveBtn onClick={() => removeFolder(folder)} title={`Remove ${folder}`}>
                                        <FontAwesomeIcon icon={faTimes} />
                                    </RemoveBtn>
                                </FolderItem>
                            ))
                        )}
                    </DropdownBody>

                    <AddRow>
                        <AddInput
                            ref={inputRef}
                            type="text"
                            placeholder="Folder name..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                        <AddBtn
                            onClick={() => addFolder(inputValue)}
                            disabled={!inputValue.trim()}
                            title="Add folder"
                        >
                            <FontAwesomeIcon icon={faPlus} />
                        </AddBtn>
                    </AddRow>

                    {availableSuggestions.length > 0 && (
                        <SuggestionsSection>
                            <SuggestionsLabel>Quick add</SuggestionsLabel>
                            <SuggestionsGrid>
                                {availableSuggestions.map(s => (
                                    <SuggestionChip key={s} onClick={() => addFolder(s)}>
                                        {s}
                                    </SuggestionChip>
                                ))}
                            </SuggestionsGrid>
                        </SuggestionsSection>
                    )}
                </Dropdown>
            )}
        </Wrapper>
    );
};

export default SearchIgnoreFilter;
