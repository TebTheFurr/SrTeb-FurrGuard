import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ServerContext } from '@/state/server';
import { useStoreState } from 'easy-peasy';
import RenameServerBox from '@/components/server/settings/RenameServerBox';
import FlashMessageRender from '@/components/FlashMessageRender';
import Can from '@/components/elements/Can';
import ReinstallServerBox from '@/components/server/settings/ReinstallServerBox';
import EggChangerBox from '@/components/server/settings/EggChangerBox';
import Input from '@/components/elements/Input';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import isEqual from 'react-fast-compare';
import CopyOnClick from '@/components/elements/CopyOnClick';
import { ip } from '@/lib/formatters';
import { Button } from '@/components/elements/button/index';
import styled, { keyframes } from 'styled-components/macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import tw from 'twin.macro';
import { 
    faNetworkWired, 
    faInfoCircle, 
    faFingerprint,
    faExternalLinkAlt,
    faPen,
    faSync,
    faServer,
    faCopy,
    faCheck,
    faBolt,
    faPlus,
    faTrash,
    faTimes,
    faTerminal,
    faArrowRight,
} from '@fortawesome/free-solid-svg-icons';
import { getMacros, createMacro, updateMacro, deleteMacro, ServerMacro, MacroArgument } from '@/api/server/macros';
import useFlash from '@/plugins/useFlash';
import Spinner from '@/components/elements/Spinner';
import { Dialog } from '@/components/elements/dialog';
import PrivacyServerHostBlur from '@/components/elements/PrivacyServerHostBlur';

type SettingsTab = 'general' | 'sftp' | 'macros' | 'danger';

const fadeIn = keyframes`
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
`;

const Container = styled.div`
    ${tw`flex gap-8`};
    min-height: 500px;

    @media (max-width: 1024px) {
        ${tw`flex-col gap-6`};
    }
`;

const Sidebar = styled.div`
    width: 240px;
    flex-shrink: 0;

    @media (max-width: 1024px) {
        width: 100%;
    }
`;

const SidebarNav = styled.nav`
    ${tw`flex flex-col`};
    position: sticky;
    top: 24px;

    @media (max-width: 1024px) {
        ${tw`flex-row overflow-x-auto pb-2 gap-2`};
        position: static;
        scrollbar-width: thin;
        scrollbar-color: var(--color-neutral) transparent;
    }
`;

const NavButton = styled.button<{ $active: boolean; $variant?: 'danger' }>`
    ${tw`flex items-center px-4 py-2 text-left transition-all duration-150 mb-1`};
    color: ${props => {
        if (props.$active) {
            return props.$variant === 'danger' ? '#ef4444' : 'var(--color-base)';
        }
        return 'color-mix(in srgb, var(--color-base) 70%, transparent)';
    }};
    border-radius: 0 var(--border-radius, 8px) var(--border-radius, 8px) 0;
    border: 1px solid transparent;
    border-left: 4px solid transparent;
    background-color: ${props => {
        if (props.$active) {
            return props.$variant === 'danger' 
                ? 'color-mix(in srgb, #ef4444 15%, transparent)' 
                : 'color-mix(in srgb, var(--color-primary) 50%, transparent)';
        }
        return 'transparent';
    }};
    border-left-color: ${props => {
        if (props.$active) {
            return props.$variant === 'danger' ? '#ef4444' : 'var(--color-primary)';
        }
        return 'transparent';
    }};
    white-space: nowrap;

    &:hover {
        background-color: ${props => props.$variant === 'danger' 
            ? 'color-mix(in srgb, #ef4444 10%, transparent)' 
            : 'var(--color-background-secondary)'};
        border-color: ${props => props.$variant === 'danger' 
            ? 'color-mix(in srgb, #ef4444 20%, transparent)' 
            : 'var(--color-neutral)'};
        border-left-color: ${props => props.$variant === 'danger' ? '#ef4444' : 'var(--color-neutral)'};
        color: ${props => props.$variant === 'danger' ? '#ef4444' : 'var(--color-base)'};
    }

    svg {
        ${tw`mr-3 w-5`};
    }

    @media (max-width: 1024px) {
        ${tw`flex-shrink-0 mb-0`};
        border-radius: var(--border-radius, 8px);
        border-left-width: 1px;
    }
`;

const MainContent = styled.div`
    flex: 1;
    min-width: 0;
`;

const SectionTitle = styled.h2`
    ${tw`text-xl font-semibold mb-2`};
    color: var(--color-base);
    animation: ${fadeIn} 0.3s ease-out;
`;

const SectionDescription = styled.p`
    ${tw`text-sm mb-6`};
    color: var(--color-muted);
    animation: ${fadeIn} 0.3s ease-out 0.05s backwards;
`;

const FormSection = styled.div`
    animation: ${fadeIn} 0.3s ease-out 0.1s backwards;
`;

const InputGroup = styled.div`
    ${tw`mb-5`};
`;

const Label = styled.label`
    ${tw`flex items-center gap-2 text-xs uppercase tracking-wider mb-2`};
    color: var(--color-inverted);
    font-weight: 500;
`;

const HelpText = styled.p`
    ${tw`text-xs mt-2`};
    color: var(--color-muted);
`;

const InfoCard = styled.div`
    background: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    overflow: hidden;
`;

const InfoCardHeader = styled.div`
    ${tw`px-5 py-4 flex items-center gap-3`};
    border-bottom: 1px solid var(--color-neutral);
`;

const InfoCardBody = styled.div`
    ${tw`p-5`};
`;

const InfoCardFooter = styled.div`
    ${tw`px-5 py-4 flex items-center justify-between`};
    background: color-mix(in srgb, var(--color-neutral) 30%, transparent);
    border-top: 1px solid var(--color-neutral);
`;

const InfoItem = styled.div`
    ${tw`flex items-center justify-between py-3 px-2 -mx-2 rounded-lg transition-colors duration-150`};
    border-bottom: 1px solid color-mix(in srgb, var(--color-neutral) 50%, transparent);

    &:last-child {
        border-bottom: none;
        padding-bottom: 0;
    }

    &:first-child {
        padding-top: 0;
    }

    &:hover {
        background: color-mix(in srgb, var(--color-neutral) 30%, transparent);
    }
`;

const InfoLabel = styled.div`
    ${tw`flex items-center gap-2 text-sm`};
    color: var(--color-muted);
`;

const InfoValue = styled.div`
    ${tw`font-mono text-sm px-3 py-1.5 flex items-center gap-2`};
    background: var(--color-background);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    color: var(--color-base);
    max-width: 280px;
`;

const AlertBox = styled.div<{ $variant?: 'info' | 'warning' | 'danger' }>`
    ${tw`flex items-start gap-3 p-4 rounded-lg`};
    background: ${props => {
        switch (props.$variant) {
            case 'danger': return 'color-mix(in srgb, #ef4444 10%, transparent)';
            case 'warning': return 'color-mix(in srgb, #eab308 10%, transparent)';
            default: return 'color-mix(in srgb, var(--color-primary) 10%, transparent)';
        }
    }};
    border: 1px solid ${props => {
        switch (props.$variant) {
            case 'danger': return 'color-mix(in srgb, #ef4444 30%, transparent)';
            case 'warning': return 'color-mix(in srgb, #eab308 30%, transparent)';
            default: return 'color-mix(in srgb, var(--color-primary) 30%, transparent)';
        }
    }};

    svg {
        flex-shrink: 0;
        margin-top: 2px;
        color: ${props => {
            switch (props.$variant) {
                case 'danger': return '#ef4444';
                case 'warning': return '#eab308';
                default: return 'var(--color-primary)';
            }
        }};
    }

    p {
        ${tw`text-sm`};
        color: var(--color-muted);
    }
`;

const MacrosList = styled.div`
    ${tw`flex flex-col gap-4`};
`;

const MacroCard = styled.div`
    background: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    overflow: hidden;
    transition: border-color 0.15s ease;
`;

const MacroHeader = styled.div`
    ${tw`flex items-center justify-between px-5 py-4`};
    background: color-mix(in srgb, var(--color-neutral) 30%, transparent);
    border-bottom: 1px solid var(--color-neutral);
`;

const MacroHeaderLeft = styled.div`
    ${tw`flex items-center gap-3`};
    min-width: 0;
`;

const ShortcutBadge = styled.span`
    ${tw`font-mono text-sm font-semibold px-3 py-1.5`};
    background: color-mix(in srgb, var(--color-primary) 15%, transparent);
    color: var(--color-primary);
    border-radius: var(--border-radius, 8px);
    white-space: nowrap;
`;

const ArrowIcon = styled.span`
    color: var(--color-muted);
    font-size: 12px;
`;

const OutputPreview = styled.span`
    ${tw`font-mono text-sm truncate`};
    color: var(--color-muted);
    max-width: 300px;
`;

const MacroActions = styled.div`
    ${tw`flex items-center gap-2`};
`;

const IconButton = styled.button<{ $variant?: 'danger' }>`
    ${tw`flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-150`};
    background: transparent;
    border: 1px solid var(--color-neutral);
    color: var(--color-muted);
    cursor: pointer;

    &:hover {
        background: ${props => props.$variant === 'danger' 
            ? 'color-mix(in srgb, #ef4444 15%, transparent)' 
            : 'var(--color-neutral)'};
        border-color: ${props => props.$variant === 'danger' ? '#ef4444' : 'var(--color-neutral)'};
        color: ${props => props.$variant === 'danger' ? '#ef4444' : 'var(--color-base)'};
    }
`;

const MacroBody = styled.div`
    ${tw`p-5`};
`;

const MacroOutputSection = styled.div`
    ${tw`mb-4`};
`;

const MacroOutputLabel = styled.div`
    ${tw`text-xs uppercase tracking-wider mb-2 flex items-center gap-2`};
    color: var(--color-inverted);
    font-weight: 500;
`;

const MacroOutputCode = styled.pre`
    ${tw`font-mono text-sm p-4 rounded-lg overflow-x-auto`};
    background: var(--color-background);
    border: 1px solid var(--color-neutral);
    color: var(--color-base);
    white-space: pre-wrap;
    word-break: break-all;
`;

const ArgumentsSection = styled.div``;

const ArgumentsLabel = styled.div`
    ${tw`text-xs uppercase tracking-wider mb-2`};
    color: var(--color-inverted);
    font-weight: 500;
`;

const ArgumentsList = styled.div`
    ${tw`flex flex-wrap gap-2`};
`;

const ArgumentTag = styled.span`
    ${tw`font-mono text-xs px-3 py-1.5`};
    background: var(--color-background);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    color: var(--color-muted);
`;

const EmptyState = styled.div`
    ${tw`flex flex-col items-center justify-center py-16 text-center`};
    background: var(--color-background-secondary);
    border: 1px dashed var(--color-neutral);
    border-radius: var(--border-radius, 8px);
`;

const EmptyIcon = styled.div`
    ${tw`text-4xl mb-4`};
    color: var(--color-primary);
    opacity: 0.5;
`;

const EmptyTitle = styled.h3`
    ${tw`text-base font-medium mb-1`};
    color: var(--color-base);
`;

const EmptyText = styled.p`
    ${tw`text-sm mb-6`};
    color: var(--color-muted);
`;

const ModalOverlay = styled.div<{ $visible: boolean }>`
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
    opacity: ${props => props.$visible ? 1 : 0};
    visibility: ${props => props.$visible ? 'visible' : 'hidden'};
    transition: opacity 0.2s, visibility 0.2s;
`;

const ModalContent = styled.div`
    background: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    width: 100%;
    max-width: 560px;
    margin: 16px;
    max-height: calc(100vh - 32px);
    overflow-y: auto;
`;

const ModalHeader = styled.div`
    ${tw`flex items-center justify-between px-6 py-4`};
    border-bottom: 1px solid var(--color-neutral);
`;

const ModalTitle = styled.h3`
    ${tw`text-lg font-semibold`};
    color: var(--color-base);
`;

const ModalCloseButton = styled.button`
    ${tw`flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150`};
    background: transparent;
    color: var(--color-muted);
    cursor: pointer;

    &:hover {
        background: var(--color-neutral);
        color: var(--color-base);
    }
`;

const ModalBody = styled.div`
    ${tw`p-6`};
`;

const ModalFooter = styled.div`
    ${tw`flex items-center justify-end gap-3 px-6 py-4`};
    border-top: 1px solid var(--color-neutral);
    background: color-mix(in srgb, var(--color-neutral) 20%, transparent);
`;

const TextArea = styled.textarea`
    width: 100%;
    padding: 12px;
    font-family: 'JetBrains Mono', 'IBM Plex Mono', monospace;
    font-size: 13px;
    background: var(--color-background);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    color: var(--color-base);
    resize: vertical;
    min-height: 100px;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 20%, transparent);
    }

    &::placeholder {
        color: var(--color-muted);
    }
`;

const ArgumentsEditor = styled.div`
    ${tw`flex flex-col gap-3`};
`;

const ArgumentRow = styled.div`
    ${tw`flex items-center gap-3`};
`;

const AddArgumentButton = styled.button`
    ${tw`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-all duration-150`};
    background: transparent;
    border: 1px dashed var(--color-neutral);
    color: var(--color-muted);
    cursor: pointer;

    &:hover {
        border-color: var(--color-primary);
        color: var(--color-primary);
        background: color-mix(in srgb, var(--color-primary) 10%, transparent);
    }
`;

const NoArguments = styled.span`
    ${tw`text-sm italic`};
    color: var(--color-muted);
`;

const HeaderWithButton = styled.div`
    ${tw`flex items-center justify-between mb-6`};
`;

interface MacroFormData {
    shortcut: string;
    output: string;
    arguments: MacroArgument[];
}

const CopyableInput = ({ value, privacyBlurContent }: { value: string; privacyBlurContent?: boolean }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative">
            <PrivacyServerHostBlur when={!!privacyBlurContent} block>
                <Input type="text" value={value} readOnly />
            </PrivacyServerHostBlur>
            <button
                onClick={handleCopy}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded transition-all duration-150"
                style={{
                    color: copied ? '#22c55e' : 'var(--color-muted)',
                    background: 'var(--color-background)',
                }}
            >
                <FontAwesomeIcon icon={copied ? faCheck : faCopy} className="w-3.5 h-3.5" />
            </button>
        </div>
    );
};

export default () => {
    const { t } = useTranslation('server');
    const [activeTab, setActiveTab] = useState<SettingsTab>('general');
    
    const username = useStoreState((state) => state.user.data!.username);
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const node = ServerContext.useStoreState((state) => state.server.data!.node);
    const sftp = ServerContext.useStoreState((state) => state.server.data!.sftpDetails, isEqual);

    const { clearFlashes, addFlash } = useFlash();
    const [macros, setMacros] = useState<ServerMacro[]>([]);
    const [macrosLoading, setMacrosLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingMacro, setEditingMacro] = useState<ServerMacro | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [macroToDelete, setMacroToDelete] = useState<ServerMacro | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState<MacroFormData>({
        shortcut: '',
        output: '',
        arguments: [],
    });

    const loadMacros = useCallback(async () => {
        if (!uuid) return;
        setMacrosLoading(true);
        try {
            const data = await getMacros(uuid);
            setMacros(data);
        } catch (error) {
            addFlash({ type: 'error', message: 'Failed to load macros.', key: 'settings' });
        } finally {
            setMacrosLoading(false);
        }
    }, [uuid, addFlash]);

    useEffect(() => {
        if (activeTab === 'macros') {
            loadMacros();
        }
    }, [activeTab, loadMacros]);

    useEffect(() => {
        const handler = () => setActiveTab('sftp');
        window.addEventListener('luna:keybind:settings-open-sftp', handler as EventListener);
        return () => window.removeEventListener('luna:keybind:settings-open-sftp', handler as EventListener);
    }, []);

    const openCreateModal = () => {
        setEditingMacro(null);
        setFormData({ shortcut: '', output: '', arguments: [] });
        setModalOpen(true);
    };

    const openEditModal = (macro: ServerMacro) => {
        setEditingMacro(macro);
        setFormData({
            shortcut: macro.shortcut,
            output: macro.output,
            arguments: macro.arguments || [],
        });
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditingMacro(null);
        setFormData({ shortcut: '', output: '', arguments: [] });
    };

    const handleMacroSubmit = async () => {
        if (!uuid) return;
        clearFlashes('settings');
        setSubmitting(true);
        try {
            if (editingMacro) {
                await updateMacro(uuid, editingMacro.id, formData);
                addFlash({ type: 'success', message: 'Macro updated successfully.', key: 'settings' });
            } else {
                await createMacro(uuid, formData);
                addFlash({ type: 'success', message: 'Macro created successfully.', key: 'settings' });
            }
            closeModal();
            loadMacros();
        } catch (error: any) {
            const message = error?.response?.data?.error || error?.response?.data?.errors?.[0]?.detail || 'An error occurred.';
            addFlash({ type: 'error', message, key: 'settings' });
        } finally {
            setSubmitting(false);
        }
    };

    const confirmDeleteMacro = (macro: ServerMacro) => {
        setMacroToDelete(macro);
        setDeleteModalOpen(true);
    };

    const handleDeleteMacro = async () => {
        if (!uuid || !macroToDelete) return;
        clearFlashes('settings');
        setSubmitting(true);
        try {
            await deleteMacro(uuid, macroToDelete.id);
            addFlash({ type: 'success', message: 'Macro deleted successfully.', key: 'settings' });
            setDeleteModalOpen(false);
            setMacroToDelete(null);
            loadMacros();
        } catch (error) {
            addFlash({ type: 'error', message: 'Failed to delete macro.', key: 'settings' });
        } finally {
            setSubmitting(false);
        }
    };

    const addArgument = () => {
        setFormData({
            ...formData,
            arguments: [...formData.arguments, { name: '' }],
        });
    };

    const updateArgument = (index: number, name: string) => {
        const newArgs = [...formData.arguments];
        newArgs[index] = { name };
        setFormData({ ...formData, arguments: newArgs });
    };

    const removeArgument = (index: number) => {
        setFormData({
            ...formData,
            arguments: formData.arguments.filter((_, i) => i !== index),
        });
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'general':
                return (
                    <>
                        <SectionTitle>{t('settings.general.title')}</SectionTitle>
                        <SectionDescription>
                            {t('settings.general.description')}
                        </SectionDescription>
                        
                        <FormSection>
                            <Can action={'settings.rename'}>
                                <RenameServerBox />
                            </Can>
                            
                            <Can action={'settings.rename'}>
                                <div style={{ marginTop: '24px' }}>
                                    <EggChangerBox />
                                </div>
                            </Can>
                            
                            <InfoCard style={{ marginTop: '24px' }}>
                                <InfoCardHeader>
                                    <FontAwesomeIcon icon={faServer} style={{ color: 'var(--color-primary)' }} />
                                    <span className="font-medium" style={{ color: 'var(--color-base)' }}>
                                        {t('settings.debug.title')}
                                    </span>
                                </InfoCardHeader>
                                <InfoCardBody>
                                    <InfoItem>
                                        <InfoLabel>
                                            <FontAwesomeIcon icon={faServer} />
                                            {t('settings.debug.node')}
                                        </InfoLabel>
                                        <InfoValue>{node}</InfoValue>
                                    </InfoItem>
                                    <InfoItem>
                                        <InfoLabel>
                                            <FontAwesomeIcon icon={faFingerprint} />
                                            {t('settings.debug.server_id')}
                                        </InfoLabel>
                                        <CopyOnClick text={uuid}>
                                            <InfoValue className="cursor-pointer truncate">
                                                <span className="truncate">{uuid}</span>
                                            </InfoValue>
                                        </CopyOnClick>
                                    </InfoItem>
                                </InfoCardBody>
                            </InfoCard>
                        </FormSection>
                    </>
                );
            
            case 'sftp':
                return (
                    <>
                        <SectionTitle>{t('settings.sftp.title')}</SectionTitle>
                        <SectionDescription>
                            {t('settings.sftp.description')}
                        </SectionDescription>
                        
                        <FormSection>
                            <Can action={'file.sftp'}>
                                <InfoCard>
                                    <InfoCardHeader>
                                        <FontAwesomeIcon icon={faNetworkWired} style={{ color: 'var(--color-primary)' }} />
                                        <span className="font-medium" style={{ color: 'var(--color-base)' }}>
                                            {t('settings.sftp.connection_details')}
                                        </span>
                                    </InfoCardHeader>
                                    <InfoCardBody>
                                        <InputGroup>
                                            <Label>
                                                <FontAwesomeIcon icon={faNetworkWired} />
                                                {t('settings.sftp.address')}
                                            </Label>
                                            <CopyableInput value={`sftp://${ip(sftp.ip)}:${sftp.port}`} privacyBlurContent />
                                            <HelpText>{t('settings.sftp.address_help')}</HelpText>
                                        </InputGroup>
                                        
                                        <InputGroup>
                                            <Label>
                                                <FontAwesomeIcon icon={faFingerprint} />
                                                {t('settings.sftp.username')}
                                            </Label>
                                            <CopyableInput value={`${username}.${id}`} />
                                        </InputGroup>
                                        
                                        <AlertBox $variant="info" className="mt-6">
                                            <FontAwesomeIcon icon={faInfoCircle} />
                                            <p>
                                                {t('settings.sftp.password_info')}
                                            </p>
                                        </AlertBox>
                                    </InfoCardBody>
                                    <InfoCardFooter>
                                        <div>
                                            <p className="font-medium" style={{ color: 'var(--color-base)' }}>
                                                {t('settings.sftp.launch')}
                                            </p>
                                            <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
                                                {t('settings.sftp.launch_description')}
                                            </p>
                                        </div>
                                        <a href={`sftp://${username}.${id}@${ip(sftp.ip)}:${sftp.port}`}>
                                            <Button>
                                                <FontAwesomeIcon icon={faExternalLinkAlt} className="mr-2" />
                                                {t('settings.sftp.connect')}
                                            </Button>
                                        </a>
                                    </InfoCardFooter>
                                </InfoCard>
                            </Can>
                        </FormSection>
                    </>
                );
            
            case 'macros':
                return (
                    <>
                        <HeaderWithButton>
                            <div>
                                <SectionTitle style={{ marginBottom: '4px' }}>Command Macros</SectionTitle>
                                <SectionDescription style={{ marginBottom: 0 }}>
                                    Create shortcuts for commonly used commands.
                                </SectionDescription>
                            </div>
                            <Button onClick={openCreateModal}>
                                <FontAwesomeIcon icon={faPlus} className="mr-2" />
                                Add Macro
                            </Button>
                        </HeaderWithButton>

                        <FormSection>
                            {macrosLoading ? (
                                <div style={{ padding: '48px 0', textAlign: 'center' }}>
                                    <Spinner size="large" centered />
                                </div>
                            ) : macros.length === 0 ? (
                                <EmptyState>
                                    <EmptyIcon>
                                        <FontAwesomeIcon icon={faBolt} />
                                    </EmptyIcon>
                                    <EmptyTitle>No macros configured</EmptyTitle>
                                    <EmptyText>Create your first command macro to get started.</EmptyText>
                                    <Button onClick={openCreateModal}>
                                        <FontAwesomeIcon icon={faPlus} className="mr-2" />
                                        Create Macro
                                    </Button>
                                </EmptyState>
                            ) : (
                                <MacrosList>
                                    {macros.map((macro) => (
                                        <MacroCard key={macro.id}>
                                            <MacroHeader>
                                                <MacroHeaderLeft>
                                                    <ShortcutBadge>{macro.shortcut}</ShortcutBadge>
                                                    <ArrowIcon>
                                                        <FontAwesomeIcon icon={faArrowRight} />
                                                    </ArrowIcon>
                                                    <OutputPreview>
                                                        {macro.output.length > 50 
                                                            ? macro.output.substring(0, 50) + '...' 
                                                            : macro.output}
                                                    </OutputPreview>
                                                </MacroHeaderLeft>
                                                <MacroActions>
                                                    <IconButton onClick={() => openEditModal(macro)} title="Edit macro">
                                                        <FontAwesomeIcon icon={faPen} />
                                                    </IconButton>
                                                    <IconButton $variant="danger" onClick={() => confirmDeleteMacro(macro)} title="Delete macro">
                                                        <FontAwesomeIcon icon={faTrash} />
                                                    </IconButton>
                                                </MacroActions>
                                            </MacroHeader>
                                            <MacroBody>
                                                <MacroOutputSection>
                                                    <MacroOutputLabel>
                                                        <FontAwesomeIcon icon={faTerminal} />
                                                        Output Command
                                                    </MacroOutputLabel>
                                                    <MacroOutputCode>{macro.output}</MacroOutputCode>
                                                </MacroOutputSection>
                                                {macro.arguments && macro.arguments.length > 0 && (
                                                    <ArgumentsSection>
                                                        <ArgumentsLabel>Arguments</ArgumentsLabel>
                                                        <ArgumentsList>
                                                            {macro.arguments.map((arg, index) => (
                                                                <ArgumentTag key={index}>
                                                                    {`{${arg.name}}`}
                                                                </ArgumentTag>
                                                            ))}
                                                        </ArgumentsList>
                                                    </ArgumentsSection>
                                                )}
                                            </MacroBody>
                                        </MacroCard>
                                    ))}
                                </MacrosList>
                            )}
                        </FormSection>
                    </>
                );

            case 'danger':
                return (
                    <>
                        <SectionTitle style={{ color: '#ef4444' }}>{t('settings.danger.title')}</SectionTitle>
                        <SectionDescription>
                            {t('settings.danger.description')}
                        </SectionDescription>
                        
                        <FormSection>
                            <Can action={'settings.reinstall'}>
                                <ReinstallServerBox />
                            </Can>
                        </FormSection>
                    </>
                );
            
            default:
                return null;
        }
    };

    return (
        <ServerContentBlock title={t('settings.title')}>
            <FlashMessageRender byKey={'settings'} className="mb-6" />
            
            <Container>
                <Sidebar>
                    <SidebarNav>
                        <NavButton 
                            $active={activeTab === 'general'} 
                            onClick={() => setActiveTab('general')}
                        >
                            <FontAwesomeIcon icon={faPen} />
                            {t('settings.tabs.general')}
                        </NavButton>
                        <Can action={'file.sftp'}>
                            <NavButton 
                                $active={activeTab === 'sftp'} 
                                onClick={() => setActiveTab('sftp')}
                            >
                                <FontAwesomeIcon icon={faNetworkWired} />
                                {t('settings.tabs.sftp')}
                            </NavButton>
                        </Can>
                        <NavButton 
                            $active={activeTab === 'macros'} 
                            onClick={() => setActiveTab('macros')}
                        >
                            <FontAwesomeIcon icon={faBolt} />
                            Macros
                        </NavButton>
                        <Can action={'settings.reinstall'}>
                            <NavButton 
                                $active={activeTab === 'danger'} 
                                $variant="danger"
                                onClick={() => setActiveTab('danger')}
                            >
                                <FontAwesomeIcon icon={faSync} />
                                {t('settings.tabs.danger')}
                            </NavButton>
                        </Can>
                    </SidebarNav>
                </Sidebar>
                
                <MainContent>
                    {renderContent()}
                </MainContent>
            </Container>

            <ModalOverlay $visible={modalOpen} onClick={closeModal}>
                <ModalContent onClick={(e) => e.stopPropagation()}>
                    <ModalHeader>
                        <ModalTitle>
                            {editingMacro ? 'Edit Macro' : 'Create Macro'}
                        </ModalTitle>
                        <ModalCloseButton onClick={closeModal}>
                            <FontAwesomeIcon icon={faTimes} />
                        </ModalCloseButton>
                    </ModalHeader>
                    <ModalBody>
                        <InputGroup>
                            <Label>Shortcut Command</Label>
                            <Input
                                type="text"
                                value={formData.shortcut}
                                onChange={(e) => setFormData({ ...formData, shortcut: e.target.value.replace(/^\/+/, '') })}
                                placeholder="restart"
                                style={{ fontFamily: "'JetBrains Mono', monospace" }}
                            />
                            <HelpText>The command you type in the console (e.g., restart, kick)</HelpText>
                        </InputGroup>
                        <InputGroup>
                            <Label>Output Command</Label>
                            <TextArea
                                value={formData.output}
                                onChange={(e) => setFormData({ ...formData, output: e.target.value })}
                                placeholder="Enter the full command to execute..."
                            />
                            <HelpText>The actual command that will be sent. Use {'{arg_name}'} for placeholders.</HelpText>
                        </InputGroup>
                        <InputGroup style={{ marginBottom: 0 }}>
                            <Label>Arguments</Label>
                            <ArgumentsEditor>
                                {formData.arguments.length === 0 ? (
                                    <NoArguments>No arguments defined</NoArguments>
                                ) : (
                                    formData.arguments.map((arg, index) => (
                                        <ArgumentRow key={index}>
                                            <Input
                                                type="text"
                                                value={arg.name}
                                                onChange={(e) => updateArgument(index, e.target.value)}
                                                placeholder="argument_name"
                                                style={{ fontFamily: "'JetBrains Mono', monospace", flex: 1 }}
                                            />
                                            <IconButton $variant="danger" onClick={() => removeArgument(index)}>
                                                <FontAwesomeIcon icon={faTimes} />
                                            </IconButton>
                                        </ArgumentRow>
                                    ))
                                )}
                                <AddArgumentButton onClick={addArgument}>
                                    <FontAwesomeIcon icon={faPlus} />
                                    Add Argument
                                </AddArgumentButton>
                            </ArgumentsEditor>
                        </InputGroup>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant={Button.Variants.Secondary} onClick={closeModal} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button onClick={handleMacroSubmit} disabled={submitting || !formData.shortcut || !formData.output}>
                            {submitting ? 'Saving...' : (editingMacro ? 'Save Changes' : 'Create Macro')}
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </ModalOverlay>

            <Dialog.Confirm
                open={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                title="Delete Macro"
                confirm="Delete"
                onConfirmed={handleDeleteMacro}
            >
                Are you sure you want to delete the macro <strong>{macroToDelete?.shortcut}</strong>? This action cannot be undone.
            </Dialog.Confirm>
        </ServerContentBlock>
    );
};
