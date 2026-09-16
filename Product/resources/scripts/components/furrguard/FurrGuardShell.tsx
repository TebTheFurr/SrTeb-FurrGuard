import React, { lazy, Suspense, useState } from 'react';
import { NavLink, Redirect, Route, Switch, useLocation } from 'react-router-dom';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash, faLock, faPaw, faSignOutAlt, faUser } from '@fortawesome/free-solid-svg-icons';
import Spinner from '@/components/elements/Spinner';
import Tooltip from '@/components/elements/tooltip/Tooltip';
import PageHeader from '@/components/elements/ui/PageHeader';
import { useFurrGuard } from '@/components/furrguard/FurrGuardContext';
import { discordAvatar } from '@/components/furrguard/lib/format';
import { ROLE_LABELS } from '@/components/furrguard/lib/labels';
import { ALL_SECTIONS, BASE_PATH, firstSection, groupsFor, SectionInfo, sectionPath } from '@/components/furrguard/sections';
import { Chip, EmptyState } from '@/components/furrguard/ui';
import useFurrGuardTranslation from '@/components/furrguard/useFurrGuardTranslation';

const OverviewView = lazy(() => import('@/components/furrguard/views/OverviewView'));
const PlayersView = lazy(() => import('@/components/furrguard/views/PlayersView'));
const PlayerDetailView = lazy(() => import('@/components/furrguard/views/PlayerDetailView'));
const ConnectionsView = lazy(() => import('@/components/furrguard/views/ConnectionsView'));
const IpsView = lazy(() => import('@/components/furrguard/views/IpsView'));
const WhitelistView = lazy(() => import('@/components/furrguard/views/WhitelistView'));
const BlacklistView = lazy(() => import('@/components/furrguard/views/BlacklistView'));
const SanctionsView = lazy(() => import('@/components/furrguard/views/SanctionsView'));
const ProvidersView = lazy(() => import('@/components/furrguard/views/ProvidersView'));
const GeoBlocksView = lazy(() => import('@/components/furrguard/views/GeoBlocksView'));
const MessagesView = lazy(() => import('@/components/furrguard/views/MessagesView'));
const LogsView = lazy(() => import('@/components/furrguard/views/LogsView'));
const SettingsView = lazy(() => import('@/components/furrguard/views/SettingsView'));
const UsersView = lazy(() => import('@/components/furrguard/views/UsersView'));
const FurrPermsView = lazy(() => import('@/components/furrguard/views/FurrPermsView'));
const FurrSecurityView = lazy(() => import('@/components/furrguard/views/FurrSecurityView'));

const TitleLine = styled.span`
    ${tw`inline-flex items-baseline gap-2 max-w-full`};
`;

const TitleIcon = styled.span`
    ${tw`self-center text-base`};
    color: var(--color-primary);
    opacity: 0.8;
`;

const IdentityChip = styled.span`
    ${tw`inline-flex items-center gap-1.5 pl-1 pr-0.5 py-0.5 text-xs font-medium max-w-full`};
    border-radius: 9999px;
    color: var(--color-base);
    background-color: var(--color-background);
    border: 1px solid var(--color-neutral);
`;

const Avatar = styled.img`
    ${tw`w-4 h-4 rounded-full object-cover flex-shrink-0`};
`;

const IdentityName = styled.span`
    ${tw`truncate`};
    max-width: 12rem;
`;

const SmallIconButton = styled.button`
    ${tw`flex items-center justify-center w-5 h-5 ml-0.5 rounded-full transition-colors duration-150`};
    color: var(--color-muted);

    svg {
        font-size: 0.6rem;
    }

    &:hover:not(:disabled),
    &:focus-visible {
        color: var(--color-base);
        background-color: var(--color-neutral);
    }

    &:disabled {
        ${tw`cursor-not-allowed opacity-50`};
    }
`;

const HideIpsButton = styled.button<{ $on: boolean }>`
    ${tw`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors duration-150`};
    border-radius: 9999px;
    color: ${({ $on }) => ($on ? 'var(--color-base)' : 'var(--color-muted)')};
    background-color: ${({ $on }) => ($on ? 'color-mix(in srgb, var(--color-primary) 18%, transparent)' : 'var(--color-background)')};
    border: 1px solid ${({ $on }) => ($on ? 'var(--color-primary)' : 'var(--color-neutral)')};

    svg {
        font-size: 0.65rem;
    }

    &:hover {
        color: var(--color-base);
    }
`;

const NavBar = styled.nav`
    ${tw`flex items-stretch gap-1 mb-4 overflow-x-auto`};
    border-bottom: 1px solid var(--color-neutral);
    scrollbar-width: thin;
`;

const GroupDivider = styled.span`
    ${tw`self-center w-px h-4 mx-1 flex-shrink-0`};
    background-color: var(--color-neutral);
`;

const NavTab = styled(NavLink)`
    ${tw`flex items-center gap-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-150`};
    margin-bottom: -1px;
    color: var(--color-muted);
    border-bottom: 2px solid transparent;

    svg {
        font-size: 0.8rem;
    }

    &:hover {
        color: var(--color-base);
    }

    &.active {
        color: var(--color-base);
        border-bottom-color: var(--color-primary);

        svg {
            color: var(--color-primary);
        }
    }
`;

/** Only Discord CDN style https URLs are rendered as images. */
const Identity = () => {
    const { t } = useFurrGuardTranslation();
    const { user, signOut } = useFurrGuard();
    const [signingOut, setSigningOut] = useState(false);
    const [avatarFailed, setAvatarFailed] = useState(false);
    const avatar = avatarFailed ? null : discordAvatar(user.discord_id, user.avatar);
    const signOutLabel = t('furrguard.actions.sign_out', 'Cerrar sesión de Discord');

    return (
        <IdentityChip title={t('furrguard.header.discord', 'Cuenta de Discord')}>
            {avatar ? <Avatar src={avatar} alt={''} referrerPolicy={'no-referrer'} onError={() => setAvatarFailed(true)} /> : <FontAwesomeIcon icon={faUser} />}
            <IdentityName>{user.username}</IdentityName>
            <Tooltip placement={'top'} content={signOutLabel}>
                <SmallIconButton
                    type={'button'}
                    aria-label={signOutLabel}
                    disabled={signingOut}
                    onClick={() => {
                        setSigningOut(true);
                        signOut();
                    }}
                >
                    <FontAwesomeIcon icon={faSignOutAlt} />
                </SmallIconButton>
            </Tooltip>
        </IdentityChip>
    );
};

const HideIpsToggle = () => {
    const { t } = useFurrGuardTranslation();
    const { canSeeIps, hideIps, setHideIps } = useFurrGuard();
    if (!canSeeIps) return null;

    return (
        <HideIpsButton
            type={'button'}
            role={'switch'}
            aria-checked={hideIps}
            $on={hideIps}
            onClick={() => setHideIps(!hideIps)}
            title={t('furrguard.header.hide_ips_hint', 'Oculta las IPs en pantalla, por ejemplo mientras compartes pantalla')}
        >
            <FontAwesomeIcon icon={hideIps ? faEyeSlash : faEye} />
            {hideIps ? t('furrguard.header.ips_hidden', 'IPs ocultas') : t('furrguard.header.ips_visible', 'IPs visibles')}
        </HideIpsButton>
    );
};

const Forbidden = ({ info }: { info?: SectionInfo }) => {
    const { t } = useFurrGuardTranslation();

    return (
        <EmptyState
            icon={faLock}
            title={t('furrguard.forbidden.title', 'Sin acceso a esta sección')}
            text={
                info
                    ? t('furrguard.forbidden.section', 'Tu rol de FurrGuard no incluye «{{section}}».', { section: info.label })
                    : t('furrguard.forbidden.generic', 'Tu rol de FurrGuard no incluye esta sección.')
            }
        />
    );
};

const FurrGuardShell = () => {
    const { t } = useFurrGuardTranslation();
    const { user, permissions, can } = useFurrGuard();
    const location = useLocation();
    const groups = groupsFor(permissions);
    const home = firstSection(permissions);
    // A forbidden route names its section in the "no access" text.
    const infoOf = (path: string): SectionInfo | undefined => ALL_SECTIONS.find((item) => item.path === path);

    return (
        <>
            <PageHeader
                title={
                    <TitleLine>
                        <TitleIcon>
                            <FontAwesomeIcon icon={faPaw} />
                        </TitleIcon>
                        {t('furrguard.title', 'FurrGuard')}
                    </TitleLine>
                }
                meta={
                    <>
                        <Chip tone={'accent'} title={t('furrguard.header.role_hint', 'Tu rol en FurrGuard')}>
                            {ROLE_LABELS[user.role] ?? user.role}
                        </Chip>
                        <Identity />
                    </>
                }
                actions={<HideIpsToggle />}
            />

            {groups.length > 0 && (
                <NavBar aria-label={t('furrguard.nav.label', 'Secciones de FurrGuard')}>
                    {groups.map((group, index) => (
                        <React.Fragment key={group.title}>
                            {index > 0 && <GroupDivider aria-hidden={'true'} />}
                            {group.items.map((item) => (
                                <NavTab key={item.section} to={sectionPath(item.section)} exact={item.section === 'overview'} title={group.title}>
                                    <FontAwesomeIcon icon={item.icon} />
                                    {item.label}
                                </NavTab>
                            ))}
                        </React.Fragment>
                    ))}
                </NavBar>
            )}

            <Suspense fallback={<Spinner centered />}>
                <Switch location={location}>
                    <Route path={BASE_PATH} exact>
                        {can('overview') ? <OverviewView /> : home ? <Redirect to={sectionPath(home)} /> : <Forbidden />}
                    </Route>
                    <Route path={`${BASE_PATH}/jugadores/:uuid`}>{can('players') ? <PlayerDetailView /> : <Forbidden info={infoOf('jugadores')} />}</Route>
                    <Route path={`${BASE_PATH}/jugadores`}>{can('players') ? <PlayersView /> : <Forbidden info={infoOf('jugadores')} />}</Route>
                    <Route path={`${BASE_PATH}/conexiones`}>{can('connections') ? <ConnectionsView /> : <Forbidden info={infoOf('conexiones')} />}</Route>
                    <Route path={`${BASE_PATH}/ips`}>{can('ips') ? <IpsView /> : <Forbidden info={infoOf('ips')} />}</Route>
                    <Route path={`${BASE_PATH}/whitelist`}>{can('whitelist') ? <WhitelistView /> : <Forbidden info={infoOf('whitelist')} />}</Route>
                    <Route path={`${BASE_PATH}/blacklist`}>{can('blacklist') ? <BlacklistView /> : <Forbidden info={infoOf('blacklist')} />}</Route>
                    <Route path={`${BASE_PATH}/sanciones`}>{can('sanctions') ? <SanctionsView /> : <Forbidden info={infoOf('sanciones')} />}</Route>
                    <Route path={`${BASE_PATH}/proveedores`}>{can('providers') ? <ProvidersView /> : <Forbidden info={infoOf('proveedores')} />}</Route>
                    <Route path={`${BASE_PATH}/paises`}>{can('countries') ? <GeoBlocksView kind={'country'} /> : <Forbidden info={infoOf('paises')} />}</Route>
                    <Route path={`${BASE_PATH}/continentes`}>{can('continents') ? <GeoBlocksView kind={'continent'} /> : <Forbidden info={infoOf('continentes')} />}</Route>
                    <Route path={`${BASE_PATH}/furrperms`}>{can('furrperms') ? <FurrPermsView /> : <Forbidden info={infoOf('furrperms')} />}</Route>
                    <Route path={`${BASE_PATH}/furrsecurity`}>{can('furrsecurity') ? <FurrSecurityView /> : <Forbidden info={infoOf('furrsecurity')} />}</Route>
                    <Route path={`${BASE_PATH}/mensajes`}>{can('messages') ? <MessagesView /> : <Forbidden info={infoOf('mensajes')} />}</Route>
                    <Route path={`${BASE_PATH}/registro`}>{can('logs') ? <LogsView /> : <Forbidden info={infoOf('registro')} />}</Route>
                    <Route path={`${BASE_PATH}/ajustes`}>{can('settings') ? <SettingsView /> : <Forbidden info={infoOf('ajustes')} />}</Route>
                    <Route path={`${BASE_PATH}/usuarios`}>{can('users') ? <UsersView /> : <Forbidden info={infoOf('usuarios')} />}</Route>
                    <Route path={'*'}>
                        <Redirect to={home ? sectionPath(home) : BASE_PATH} />
                    </Route>
                </Switch>
            </Suspense>
        </>
    );
};


export default FurrGuardShell;
