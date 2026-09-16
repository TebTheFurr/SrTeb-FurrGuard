import { Alert } from '@/components/elements/alert';
import CopyOnClick from '@/components/elements/CopyOnClick';
import ServerContentBlock from '@/components/elements/ServerContentBlock';
import Spinner from '@/components/elements/Spinner';
import Console from '@/components/server/console/Console';
import ServerDetailsBlock from '@/components/server/console/ServerDetailsBlock';
import StatGraphs from '@/components/server/console/StatGraphs';
import StatusBadge from '@/components/server/console/StatusBadge';
import UptimeDisplay from '@/components/server/console/UptimeDisplay';
import RamUpgradeAlert from '@/components/server/console/RamUpgradeAlert';
import { ApplicationStore } from '@/state';
import { ServerContext } from '@/state/server';
import Features from '@feature/Features';
import {
    faArchive,
    faBell,
    faBookmark,
    faBox,
    faBroadcastTower,
    faCalendarAlt,
    faChartLine,
    faCheck,
    faClipboard,
    faClipboardList,
    faClock,
    faCloud,
    faCloudUploadAlt,
    faCode,
    faCog,
    faComment,
    faCube,
    faCubes,
    faDesktop,
    faDownload,
    faEdit,
    faEnvelope,
    faExclamation,
    faExternalLinkAlt,
    faEye,
    faFile,
    faFileAlt,
    faFilter,
    faFingerprint,
    faFlag,
    faFolderOpen,
    faGamepad,
    faGlobe,
    faHdd,
    faHeart,
    faHome,
    faImage,
    faInfoCircle,
    faKey,
    faLaptop,
    faLayerGroup,
    faLink,
    faListAlt,
    faLock,
    faMemory,
    faMicrochip,
    faMinus,
    faMobile,
    faMusic,
    faNetworkWired,
    faPlay,
    faPlug,
    faPlus,
    faPowerOff,
    faProjectDiagram,
    faQuestion,
    faRocket,
    faSatellite,
    faSearch,
    faServer,
    faShare,
    faShieldAlt,
    faSignal,
    faSitemap,
    faSlidersH,
    faSort,
    faStar,
    faStop,
    faStream,
    faSync,
    faTable,
    faTablet,
    faTachometerAlt,
    faTasks,
    faTerminal,
    faThumbsUp,
    faTimes,
    faToolbox,
    faTrash,
    faUpload,
    faUserFriends,
    faVideo,
    faWifi,
    faWrench
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useStoreState } from 'easy-peasy';
import React, { memo } from 'react';
import isEqual from 'react-fast-compare';
import { Link } from 'react-router-dom';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { useTranslation } from 'react-i18next';
import { hiddenBackupSection, isServerSectionLink } from '@/components/server/vault/vaultNavigation';

declare global {
    interface Window {
        SiteConfiguration?: {
            eggImages?: Record<string, string>;
        };
    }
}

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

const InfoRow = styled.div`
    ${tw`flex items-center justify-between py-3`};
    border-bottom: 1px solid var(--color-neutral);
    
    &:last-child {
        border-bottom: none;
    }
`;

const QuickActionCard = styled(Link)`
    ${tw`flex items-center p-4 rounded-lg transition-all duration-150 no-underline`};
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    
    &:hover {
        border-color: var(--color-primary);
    }
`;

const QuickActionExternal = styled.a`
    ${tw`flex items-center p-4 rounded-lg transition-all duration-150 no-underline`};
    background-color: var(--color-background-secondary);
    border: 1px solid var(--color-neutral);
    border-radius: var(--border-radius, 8px);
    
    &:hover {
        border-color: var(--color-primary);
    }
`;

const WelcomeBanner = styled.div<{ $bgImage?: string }>`
    ${tw`relative overflow-hidden mb-6`};
    background-color: var(--color-background-secondary);
    ${({ $bgImage }) => $bgImage && `background-image: url('${$bgImage}');`}
    background-size: cover;
    background-position: center;
    border-radius: var(--border-radius, 8px);
    border: 1px solid var(--color-neutral);
    min-height: 140px;
    
    &::before {
        content: '';
        background-color: rgba(0, 0, 0, 0.8);
        ${tw`absolute inset-0`};
    }
`;

const BannerContent = styled.div`
    ${tw`relative z-[5] px-6 py-3 h-full flex flex-col justify-center`};
    min-height: 140px;
`;

const ServerDashboardContainer = () => {
    const { t } = useTranslation('server');
    const name = ServerContext.useStoreState((state) => state.server.data!.name);
    const id = ServerContext.useStoreState((state) => state.server.data!.id);
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const node = ServerContext.useStoreState((state) => state.server.data!.node);
    const isInstalling = ServerContext.useStoreState((state) => state.server.isInstalling);
    const isTransferring = ServerContext.useStoreState((state) => state.server.data!.isTransferring);
    const eggFeatures = ServerContext.useStoreState((state) => state.server.data!.eggFeatures, isEqual);
    const isNodeUnderMaintenance = ServerContext.useStoreState((state) => state.server.data!.isNodeUnderMaintenance);
    const eggId = ServerContext.useStoreState((state) => state.server.data!.eggId);
    const status = ServerContext.useStoreState((state) => state.status.value);
    const vaultEnabled = ServerContext.useStoreState((state) => state.server.data!.vaultEnabled);
    const showDashboard = useStoreState((state: ApplicationStore) => state.settings.data?.layout?.showDashboard ?? true);
    const hideDashboardHeader = useStoreState((state: ApplicationStore) => state.settings.data?.components?.hideDashboardHeader ?? false);
    const dashboardQuickActions = useStoreState(
        (state: ApplicationStore) => state.settings.data?.layout?.dashboardQuickActions ?? []
    );

    const eggImages = window.SiteConfiguration?.eggImages || {};
    const eggImage = eggId ? eggImages[eggId] : undefined;

    const quickActionIconMap: Record<string, any> = {
        home: faHome,
        dashboard: faTachometerAlt,
        tachometer: faTachometerAlt,
        'chart-line': faChartLine,
        activity: faChartLine,
        console: faTerminal,
        terminal: faTerminal,
        files: faFolderOpen,
        folder: faFolderOpen,
        'folder-open': faFolderOpen,
        backups: faCloudUploadAlt,
        backup: faCloudUploadAlt,
        'cloud-upload': faCloudUploadAlt,
        vault: faShieldAlt,
        databases: faTable,
        database: faTable,
        table: faTable,
        schedules: faCalendarAlt,
        schedule: faCalendarAlt,
        calendar: faCalendarAlt,
        users: faUserFriends,
        user: faUserFriends,
        network: faNetworkWired,
        'network-wired': faNetworkWired,
        globe: faGlobe,
        startup: faRocket,
        rocket: faRocket,
        settings: faSlidersH,
        sliders: faSlidersH,
        cog: faCog,
        gear: faCog,
        info: faInfoCircle,
        'info-circle': faInfoCircle,
        server: faServer,
        admin: faToolbox,
        toolbox: faToolbox,
        tools: faToolbox,
        lock: faLock,
        shield: faShieldAlt,
        security: faShieldAlt,
        list: faListAlt,
        code: faCode,
        play: faPlay,
        stop: faStop,
        power: faPowerOff,
        'power-off': faPowerOff,
        restart: faSync,
        sync: faSync,
        refresh: faSync,
        download: faDownload,
        upload: faUpload,
        wrench: faWrench,
        plug: faPlug,
        key: faKey,
        eye: faEye,
        view: faEye,
        edit: faEdit,
        pencil: faEdit,
        trash: faTrash,
        delete: faTrash,
        plus: faPlus,
        add: faPlus,
        minus: faMinus,
        clock: faClock,
        time: faClock,
        bell: faBell,
        notification: faBell,
        envelope: faEnvelope,
        mail: faEnvelope,
        email: faEnvelope,
        comment: faComment,
        question: faQuestion,
        help: faQuestion,
        exclamation: faExclamation,
        warning: faExclamation,
        check: faCheck,
        times: faTimes,
        close: faTimes,
        search: faSearch,
        filter: faFilter,
        sort: faSort,
        link: faLink,
        'external-link': faExternalLinkAlt,
        external: faExternalLinkAlt,
        share: faShare,
        bookmark: faBookmark,
        star: faStar,
        heart: faHeart,
        'thumbs-up': faThumbsUp,
        like: faThumbsUp,
        flag: faFlag,
        archive: faArchive,
        box: faBox,
        cube: faCube,
        cubes: faCubes,
        'layer-group': faLayerGroup,
        layers: faLayerGroup,
        sitemap: faSitemap,
        'project-diagram': faProjectDiagram,
        diagram: faProjectDiagram,
        stream: faStream,
        tasks: faTasks,
        clipboard: faClipboard,
        'clipboard-list': faClipboardList,
        'file-alt': faFileAlt,
        file: faFile,
        document: faFileAlt,
        image: faImage,
        photo: faImage,
        picture: faImage,
        music: faMusic,
        audio: faMusic,
        video: faVideo,
        gamepad: faGamepad,
        game: faGamepad,
        desktop: faDesktop,
        computer: faDesktop,
        mobile: faMobile,
        phone: faMobile,
        tablet: faTablet,
        laptop: faLaptop,
        memory: faMemory,
        ram: faMemory,
        microchip: faMicrochip,
        cpu: faMicrochip,
        chip: faMicrochip,
        'hard-drive': faHdd,
        hdd: faHdd,
        disk: faHdd,
        storage: faHdd,
        wifi: faWifi,
        wireless: faWifi,
        signal: faSignal,
        'broadcast-tower': faBroadcastTower,
        tower: faBroadcastTower,
        satellite: faSatellite,
        cloud: faCloud,
        fingerprint: faFingerprint,
    };

    const resolveQuickActionIcon = (key?: string) =>
        quickActionIconMap[(key || '').trim().toLowerCase()] || faGlobe;

    const resolveQuickActionLink = (raw?: string) => {
        const input = (raw || '').trim();
        if (!input) return null;

        const replaced = input.replace(/\{serverId\}/g, String(id));
        if (/^https?:\/\//i.test(replaced)) return { external: true as const, href: replaced };

        const path = replaced.startsWith('/') ? replaced : `/${replaced}`;
        if (path.startsWith('/server/')) return { external: false as const, to: path };
        return { external: false as const, to: `/server/${id}${path === '/' ? '' : path}` };
    };

    const vaultQuickAction = {
        title: t('navigation.vault', 'Vault'),
        icon: faShieldAlt,
        external: false as const,
        to: `/server/${id}/vault`,
    };

    const configuredQuickActions = (Array.isArray(dashboardQuickActions) ? dashboardQuickActions : [])
        .filter((a: any) => a && a.title && a.link)
        .slice(0, 4)
        .map((a: any, idx: number) => {
            const resolved = resolveQuickActionLink(a.link);
            if (!resolved) return null;
            // Backups and Vault never coexist: a Backups action points at the Vault on
            // Vault servers, and a Vault action is dropped everywhere else.
            if (!resolved.external && isServerSectionLink(resolved.to, id, hiddenBackupSection(vaultEnabled))) {
                return vaultEnabled ? { key: `qa:${idx}:vault`, ...vaultQuickAction } : null;
            }
            const title = (a.title || '').toString();
            return {
                key: `qa:${idx}:${title}`,
                title,
                icon: resolveQuickActionIcon(a.icon),
                ...resolved,
            };
        })
        .filter(Boolean) as Array<{
        key: string;
        title: string;
        icon: any;
        external: boolean;
        href?: string;
        to?: string;
    }>;

    const defaultQuickActions = [
        { key: 'qa:console', title: t('navigation.console', 'Console'), icon: faTerminal, external: false as const, to: `/server/${id}/console` },
        { key: 'qa:files', title: t('navigation.files', 'Files'), icon: faFolderOpen, external: false as const, to: `/server/${id}/files` },
        vaultEnabled
            ? { key: 'qa:vault', ...vaultQuickAction }
            : { key: 'qa:backups', title: t('navigation.backups', 'Backups'), icon: faCloudUploadAlt, external: false as const, to: `/server/${id}/backups` },
        { key: 'qa:settings', title: t('navigation.settings', 'Settings'), icon: faSlidersH, external: false as const, to: `/server/${id}/settings` },
    ];

    const quickActionsToRender = configuredQuickActions.length > 0 ? configuredQuickActions : defaultQuickActions;

    if (!showDashboard) {
        return (
            <ServerContentBlock title={t('navigation.console', 'Console')}>
                {(isNodeUnderMaintenance || isInstalling || isTransferring) && (
                    <Alert type={'warning'} className={'mb-4'}>
                        {isNodeUnderMaintenance
                            ? t('console.maintenance_warning', 'The node of this server is currently under maintenance and all actions are unavailable.')
                            : isInstalling
                            ? t('console.installing_warning', 'This server is currently running its installation process and most actions are unavailable.')
                            : t('console.transferring_warning', 'This server is currently being transferred to another node and all actions are unavailable.')}
                    </Alert>
                )}
                
                <div className={'mb-4'}>
                    <h1
                        className={'font-header font-medium text-2xl leading-tight truncate'}
                        style={{ color: 'var(--color-base)' }}
                    >
                        {name}
                    </h1>
                    <div className={'flex items-center gap-2 mt-2'}>
                        <StatusBadge />
                        {status !== 'offline' && (
                            <>
                                <span className="text-sm" style={{ color: 'var(--color-muted)' }}>•</span>
                                <UptimeDisplay />
                            </>
                        )}
                    </div>
                </div>
                
                <Spinner.Suspense>
                    <Console />
                </Spinner.Suspense>
                
                <ServerDetailsBlock className={'mt-4'} />
                
                <div className={'grid grid-cols-1 md:grid-cols-3 gap-4 mt-4'}>
                    <Spinner.Suspense>
                        <StatGraphs />
                    </Spinner.Suspense>
                </div>
                
                <Features enabled={eggFeatures} />
            </ServerContentBlock>
        );
    }

    return (
        <ServerContentBlock title={t('navigation.dashboard', 'Dashboard')}>
            {(isNodeUnderMaintenance || isInstalling || isTransferring) && (
                <Alert type={'warning'} className={'mb-4'}>
                    {isNodeUnderMaintenance
                        ? t('console.maintenance_warning', 'The node of this server is currently under maintenance and all actions are unavailable.')
                        : isInstalling
                        ? t('console.installing_warning', 'This server is currently running its installation process and most actions are unavailable.')
                        : t('console.transferring_warning', 'This server is currently being transferred to another node and all actions are unavailable.')}
                </Alert>
            )}
            
            {!hideDashboardHeader && (
                <WelcomeBanner $bgImage={eggImage}>
                    <BannerContent>
                        <h1
                            className={'font-header font-bold text-3xl leading-tight truncate mb-3'}
                            style={{ color: '#ffffff' }}
                        >
                            {name}
                        </h1>
                        <div className={'flex items-center gap-3'}>
                            <StatusBadge />
                            {status !== 'offline' && (
                                <>
                                    <span className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>•</span>
                                    <UptimeDisplay />
                                </>
                            )}
                        </div>
                    </BannerContent>
                </WelcomeBanner>
            )}

            <RamUpgradeAlert />

            <ServerDetailsBlock className={'mb-6'} />
            
            <div className={'grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'}>
                <Spinner.Suspense>
                    <StatGraphs />
                </Spinner.Suspense>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <FontAwesomeIcon 
                            icon={faInfoCircle} 
                            className="mr-3" 
                            style={{ color: 'var(--color-primary)' }} 
                        />
                        <span className="font-medium" style={{ color: 'var(--color-base)' }}>
                            {t('dashboard.server_information', 'Server Information')}
                        </span>
                    </CardHeader>
                    <CardBody className="p-0">
                        <div className="px-4">
                            <InfoRow>
                                <div className="flex items-center">
                                    <FontAwesomeIcon 
                                        icon={faServer} 
                                        className="mr-3 w-4" 
                                        style={{ color: 'var(--color-muted)' }} 
                                    />
                                    <span className="text-sm" style={{ color: 'var(--color-muted)' }}>{t('settings.debug.node', 'Node')}</span>
                                </div>
                                <code 
                                    className="font-mono text-sm px-3 py-1.5 rounded-lg"
                                    style={{
                                        backgroundColor: 'var(--color-background)',
                                        border: '1px solid var(--color-neutral)',
                                        color: 'var(--color-base)',
                                    }}
                                >
                                    {node}
                                </code>
                            </InfoRow>
                            <CopyOnClick text={uuid}>
                                <InfoRow className="cursor-pointer">
                                    <div className="flex items-center">
                                        <FontAwesomeIcon 
                                            icon={faFingerprint} 
                                            className="mr-3 w-4" 
                                            style={{ color: 'var(--color-muted)' }} 
                                        />
                                        <span className="text-sm" style={{ color: 'var(--color-muted)' }}>{t('dashboard.server_uuid', 'Server UUID')}</span>
                                    </div>
                                    <code 
                                        className="font-mono text-xs px-3 py-1.5 rounded-lg truncate max-w-[200px]"
                                        style={{
                                            backgroundColor: 'var(--color-background)',
                                            border: '1px solid var(--color-neutral)',
                                            color: 'var(--color-base)',
                                        }}
                                    >
                                        {uuid}
                                    </code>
                                </InfoRow>
                            </CopyOnClick>
                        </div>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader>
                        <FontAwesomeIcon 
                            icon={faNetworkWired} 
                            className="mr-3" 
                            style={{ color: 'var(--color-primary)' }} 
                        />
                        <span className="font-medium" style={{ color: 'var(--color-base)' }}>
                            {t('dashboard.quick_actions', 'Quick Actions')}
                        </span>
                    </CardHeader>
                    <CardBody>
                        <div className="grid grid-cols-2 gap-3">
                            {quickActionsToRender.map((a) =>
                                a.external ? (
                                    <QuickActionExternal key={a.key} href={a.href} target="_blank" rel="noreferrer">
                                        <FontAwesomeIcon icon={a.icon} className="mr-3" style={{ color: 'var(--color-primary)' }} />
                                        <span className="text-sm font-medium" style={{ color: 'var(--color-base)' }}>
                                            {a.title}
                                        </span>
                                    </QuickActionExternal>
                                ) : (
                                    <QuickActionCard key={a.key} to={a.to || '#'}>
                                        <FontAwesomeIcon icon={a.icon} className="mr-3" style={{ color: 'var(--color-primary)' }} />
                                        <span className="text-sm font-medium" style={{ color: 'var(--color-base)' }}>
                                            {a.title}
                                        </span>
                                    </QuickActionCard>
                                )
                            )}
                        </div>
                    </CardBody>
                </Card>
            </div>
            
            <Features enabled={eggFeatures} />
        </ServerContentBlock>
    );
};

export default memo(ServerDashboardContainer, isEqual);
