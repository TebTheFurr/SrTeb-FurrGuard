import React, { useState, useEffect } from 'react';
import styled, { css } from 'styled-components/macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faInfoCircle,
    faCheckCircle,
    faExclamationTriangle,
    faTimesCircle,
    faLightbulb,
    faBullhorn,
} from '@fortawesome/free-solid-svg-icons';
import Modal from '@/components/elements/Modal';
import { getAnnouncements, Announcement } from '@/api/client/getAnnouncements';
import { ServerContext } from '@/state/server';

type AnnouncementType = 'info' | 'success' | 'warning' | 'error' | 'tip';
type AnnouncementVariant = 'solid' | 'outline' | 'split';
type AnnouncementLocation = 'above-content' | 'topbar';

interface AnnouncementBarProps {
    location: AnnouncementLocation;
}

const AnnouncementWrap = styled.div`
    width: 100%;
    margin-bottom: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
`;

const TopbarContainer = styled.div`
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    z-index: 40;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 10px 24px;
    min-height: 44px;
    background: color-mix(in srgb, var(--announcement-accent) 15%, var(--color-background-secondary));
    border-bottom: 1px solid color-mix(in srgb, var(--announcement-accent) 25%, transparent);
    cursor: pointer;

    @media (min-width: 768px) {
        cursor: default;
    }
`;

const TopbarContent = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.875rem;
    color: var(--color-base);
    max-width: 100%;
    overflow: hidden;
`;

const TopbarIcon = styled.span`
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    color: var(--announcement-accent);
    font-size: 1rem;
`;

const TopbarTitle = styled.span`
    font-weight: 600;
    flex-shrink: 0;
`;

const TopbarText = styled.span`
    color: color-mix(in srgb, var(--color-base) 85%, transparent);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;

    @media (max-width: 767px) {
        max-width: 150px;
    }
`;

const TopbarLink = styled.a`
    font-weight: 700;
    color: var(--color-base);
    text-decoration: none;
    margin-left: 4px;
    flex-shrink: 0;
    
    &:hover {
        text-decoration: underline;
    }

    @media (max-width: 767px) {
        display: none;
    }
`;

const TopbarMoreIndicator = styled.span`
    display: none;
    color: var(--announcement-accent);
    font-weight: 600;
    flex-shrink: 0;

    @media (max-width: 767px) {
        display: inline;
    }
`;

const ModalTitle = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--color-base);
    margin-bottom: 12px;
`;

const ModalText = styled.div`
    font-size: 0.9rem;
    line-height: 1.6;
    color: color-mix(in srgb, var(--color-base) 85%, transparent);
    margin-bottom: 16px;
`;

const ModalButton = styled.a`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 18px;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 10px;
    text-decoration: none;
    color: var(--color-base);
    background: var(--announcement-accent);
    transition: all 150ms ease;

    &:hover {
        color: #fff;
        filter: brightness(1.1);
    }
`;

const AnnouncementShell = styled.div<{ $variant: AnnouncementVariant }>`
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    border-radius: var(--border-radius, 12px);
    border: 1px solid color-mix(in srgb, var(--announcement-accent) 35%, transparent);
    background: color-mix(in srgb, var(--announcement-accent) 15%, var(--color-background-secondary));
    color: var(--color-base);
    width: 100%;

    ${(props) => props.$variant === 'solid' && css`
        background: color-mix(in srgb, var(--announcement-accent) 75%, #000);
        border-color: transparent;
    `}

    ${(props) => props.$variant === 'outline' && css`
        background: transparent;
        border-color: color-mix(in srgb, var(--announcement-accent) 55%, transparent);
        box-shadow: none;
    `}

    ${(props) => props.$variant === 'split' && css`
        background: color-mix(in srgb, var(--announcement-accent) 10%, var(--color-background-secondary));
        border-left: 4px solid var(--announcement-accent);
        border-radius: 0 var(--border-radius, 12px) var(--border-radius, 12px) 0;       
    `}
`;

const AnnouncementIcon = styled.div<{ $variant: AnnouncementVariant }>`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    flex-shrink: 0;
    color: var(--color-base);
    background: color-mix(in srgb, var(--announcement-accent) 35%, transparent);

    ${(props) => props.$variant === 'solid' && css`
        background: rgba(255, 255, 255, 0.2);
    `}
`;

const AnnouncementContent = styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 0;
`;

const AnnouncementTitle = styled.div`
    font-size: 0.95rem;
    font-weight: 600;
    line-height: 1.2;
    color: var(--color-base);
`;

const AnnouncementText = styled.div`
    font-size: 0.85rem;
    line-height: 1.4;
    color: color-mix(in srgb, var(--color-base) 85%, transparent);
`;

const AnnouncementActions = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    margin-left: auto;
`;

const AnnouncementButton = styled.a`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 14px;
    font-size: 0.8rem;
    font-weight: 600;
    border-radius: 10px;
    text-decoration: none;
    color: var(--color-base);
    background: var(--announcement-button);
    border: 1px solid color-mix(in srgb, var(--announcement-button) 70%, transparent);
    transition: all 150ms ease;

    &:hover {
        color: #fff;
    }
`;

const getAccent = (type: AnnouncementType) => {
    if (type === 'success') return 'hsl(150, 60%, 45%)';
    if (type === 'warning') return 'hsl(38, 90%, 55%)';
    if (type === 'error') return 'hsl(0, 75%, 58%)';
    if (type === 'tip') return 'hsl(190, 70%, 52%)';
    return 'var(--color-primary)';
};

const resolveIcon = (value?: string) => {
    const key = (value || '').trim().toLowerCase();
    const iconMap: Record<string, any> = {
        info: faInfoCircle,
        'info-circle': faInfoCircle,
        success: faCheckCircle,
        check: faCheckCircle,
        'check-circle': faCheckCircle,
        warning: faExclamationTriangle,
        'exclamation-triangle': faExclamationTriangle,
        error: faTimesCircle,
        'times-circle': faTimesCircle,
        tip: faLightbulb,
        lightbulb: faLightbulb,
        bullhorn: faBullhorn,
        announcement: faBullhorn,
    };

    return iconMap[key];
};

const typeIcon = (type: AnnouncementType) => {
    if (type === 'success') return faCheckCircle;
    if (type === 'warning') return faExclamationTriangle;
    if (type === 'error') return faTimesCircle;
    if (type === 'tip') return faLightbulb;
    return faInfoCircle;
};

const AnnouncementBar: React.FC<AnnouncementBarProps> = ({ location }) => {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [activeAnnouncement, setActiveAnnouncement] = useState<Announcement | null>(null);
    const [loaded, setLoaded] = useState(false);
    const topbarRef = React.useRef<HTMLDivElement>(null);
    const isInPanel = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('_panel') === '1';
    
    const nodeId = ServerContext.useStoreState((state) => state.server.data?.nodeId);
    const eggId = ServerContext.useStoreState((state) => state.server.data?.eggId);

    useEffect(() => {
        if (isInPanel || loaded) return;

        getAnnouncements(nodeId, eggId ? [eggId] : [])
            .then((data) => {
                const filtered = data.filter((a) => a.placement === location);
                setAnnouncements(filtered);
                setLoaded(true);
            })
            .catch((error) => {
                console.error('Failed to load announcements:', error);
                setLoaded(true);
            });
    }, [location, isInPanel]);

    useEffect(() => {
        if (location === 'topbar' && topbarRef.current) {
            const height = topbarRef.current.offsetHeight;
            document.documentElement.style.setProperty('--announcement-top-offset', `${height}px`);
        }
        
        return () => {
            if (location === 'topbar') {
                document.documentElement.style.setProperty('--announcement-top-offset', '0px');
            }
        };
    }, [location, announcements.length]);

    if (isInPanel || announcements.length === 0) return null;

    const topbarAnnouncements = announcements.filter((a) => a.placement === 'topbar');
    const aboveContentAnnouncements = announcements.filter((a) => a.placement === 'above-content');

    const renderAnnouncement = (announcement: Announcement) => {
        const type = (announcement.type || 'info') as AnnouncementType;
        const variant = (announcement.variation || 'split') as AnnouncementVariant;
        const buttonLabel = (announcement.button_label || '').trim();
        const buttonLink = (announcement.button_link || '').trim();
        const icon = resolveIcon(announcement.icon) || typeIcon(type) || faBullhorn;
        const accent = getAccent(type);
        const title = (announcement.title || '').trim();
        const text = (announcement.text || '').trim();
        const topbar = announcement.placement === 'topbar';

        const handleTopbarClick = () => {
            if (window.innerWidth < 1200) {
                setActiveAnnouncement(announcement);
                setModalOpen(true);
            }
        };

        if (topbar) {
            return (
                <TopbarContainer
                    key={announcement.id}
                    ref={topbarRef}
                    style={{ ['--announcement-accent' as any]: accent }}
                    onClick={handleTopbarClick}
                >
                    <TopbarContent>
                        <TopbarIcon>
                            <FontAwesomeIcon icon={icon} />
                        </TopbarIcon>
                        {title && <TopbarTitle>{title}</TopbarTitle>}
                        {text && <TopbarText>{text}</TopbarText>}
                        <TopbarMoreIndicator>...</TopbarMoreIndicator>
                        {(buttonLabel && buttonLink) && (
                            <TopbarLink href={buttonLink} onClick={(e) => e.stopPropagation()}>
                                {buttonLabel}
                            </TopbarLink>
                        )}
                    </TopbarContent>
                </TopbarContainer>
            );
        }

        return (
            <AnnouncementShell
                key={announcement.id}
                $variant={variant}
                style={{ ['--announcement-accent' as any]: accent, ['--announcement-button' as any]: accent }}
            >
                <AnnouncementIcon $variant={variant}>
                    <FontAwesomeIcon icon={icon} />
                </AnnouncementIcon>
                <AnnouncementContent>
                    {title && <AnnouncementTitle>{title}</AnnouncementTitle>}
                    {text && <AnnouncementText>{text}</AnnouncementText>}
                </AnnouncementContent>
                {(buttonLabel && buttonLink) && (
                    <AnnouncementActions>
                        <AnnouncementButton href={buttonLink}>{buttonLabel}</AnnouncementButton>
                    </AnnouncementActions>
                )}
            </AnnouncementShell>
        );
    };

    if (location === 'topbar' && topbarAnnouncements.length > 0) {
        return (
            <>
                {topbarAnnouncements.map(renderAnnouncement)}
                <Modal visible={modalOpen} onDismissed={() => setModalOpen(false)}>
                    {activeAnnouncement && (
                        <div style={{ ['--announcement-accent' as any]: getAccent(activeAnnouncement.type as AnnouncementType) } as React.CSSProperties}>
                            <ModalTitle>
                                <FontAwesomeIcon icon={resolveIcon(activeAnnouncement.icon) || typeIcon(activeAnnouncement.type as AnnouncementType) || faBullhorn} />
                                {activeAnnouncement.title || 'Announcement'}
                            </ModalTitle>
                            {activeAnnouncement.text && <ModalText>{activeAnnouncement.text}</ModalText>}
                            {(activeAnnouncement.button_label && activeAnnouncement.button_link) && (
                                <ModalButton href={activeAnnouncement.button_link}>{activeAnnouncement.button_label}</ModalButton>
                            )}
                        </div>
                    )}
                </Modal>
            </>
        );
    }

    if (location === 'above-content' && aboveContentAnnouncements.length > 0) {
        return (
            <AnnouncementWrap>
                {aboveContentAnnouncements.map(renderAnnouncement)}
            </AnnouncementWrap>
        );
    }

    return null;
};

export default AnnouncementBar;
