import TransferListener from '@/components/server/TransferListener';
import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { Route, Switch, useRouteMatch, Redirect } from 'react-router-dom';
import TransitionRouter from '@/TransitionRouter';
import WebsocketHandler from '@/components/server/WebsocketHandler';
import { ServerContext } from '@/state/server';
import Spinner from '@/components/elements/Spinner';
import { NotFound, ServerError } from '@/components/elements/ScreenBlock';
import { httpErrorToHuman } from '@/api/http';
import { useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import InstallListener from '@/components/server/InstallListener';
import ErrorBoundary from '@/components/elements/ErrorBoundary';
import { useLocation } from 'react-router';
import ConflictStateRenderer from '@/components/server/ConflictStateRenderer';
import PermissionRoute from '@/components/elements/PermissionRoute';
import routes from '@/routers/routes';
import Sidebar from '@/components/layout/Sidebar';
import PowerDock, { TopbarPowerControls } from '@/components/server/PowerDock';
import ContentContainer from '@/components/elements/ContentContainer';
import AnnouncementBar from '@/components/server/AnnouncementBar';
import ConsoleSidebar from '@/components/server/console/ConsoleSidebar';
import { ConsoleSidebarProvider, useConsoleSidebar } from '@/state/consoleSidebar';
import { PanelProvider } from '@/state/panels';
import PanelContainer from '@/components/layout/PanelContainer';
import { getModpackCompatibility } from '@/api/server/modpacks';
import { getMinecraftVersionCompatibility } from '@/api/server/minecraftVersions';
import tw from 'twin.macro';
import VaultRestoreListener from '@/components/server/vault/VaultRestoreListener';
import { isServerSectionLink, setVaultAvailability } from '@/components/server/vault/vaultNavigation';

const ServerRouterInner = () => {
    const match = useRouteMatch<{ id: string }>();
    const location = useLocation();
    const { isOpen: consoleSidebarOpen } = useConsoleSidebar();

    const rootAdmin = useStoreState((state) => state.user.data!.rootAdmin);
    const showDashboard = useStoreState((state: ApplicationStore) => state.settings.data?.layout?.showDashboard ?? true);
    const powerDockLocation = useStoreState((state: ApplicationStore) => state.settings.data?.components?.powerDock ?? 'dock');
    const [error, setError] = useState('');

    const serverData = ServerContext.useStoreState((state) => state.server.data);
    const id = ServerContext.useStoreState((state) => state.server.data?.id);
    const uuid = ServerContext.useStoreState((state) => state.server.data?.uuid);
    const externalId = ServerContext.useStoreState((state) => state.server.data?.externalId);
    const serverName = ServerContext.useStoreState((state) => state.server.data?.name);
    const internalId = ServerContext.useStoreState((state) => state.server.data?.internalId);
    const serverStatus = ServerContext.useStoreState((state) => state.status.value);
    const inConflictState = ServerContext.useStoreState((state) => state.server.inConflictState);
    const allocations = ServerContext.useStoreState((state) => state.server.data?.allocations);
    const eggId = ServerContext.useStoreState((state) => state.server.data?.eggId);
    const primarySubdomain = ServerContext.useStoreState((state) => state.server.data?.primarySubdomain);
    const getServer = ServerContext.useStoreActions((actions) => actions.server.getServer);
    const clearServerState = ServerContext.useStoreActions((actions) => actions.clearServerState);
    const primaryAllocation = allocations?.find((a) => a.isDefault) ?? allocations?.[0];
    const modpackCompatibility = useMemo(() => getModpackCompatibility(serverData), [serverData]);
    const minecraftVersionCompatibility = useMemo(() => getMinecraftVersionCompatibility(serverData), [serverData]);
    const connectionAddress = primarySubdomain || (primaryAllocation 
        ? (primaryAllocation.alias ? `${primaryAllocation.alias}:${primaryAllocation.port}` : `${primaryAllocation.ip}:${primaryAllocation.port}`)
        : null);
    const blurConnectionAddress =
        !primarySubdomain && !!primaryAllocation && !primaryAllocation.alias;

    const to = (value: string, url = false) => {
        if (value === '/') {
            return url ? match.url : match.path;
        }
        return `${(url ? match.url : match.path).replace(/\/*$/, '')}/${value.replace(/^\/+/, '')}`;
    };

    useEffect(
        () => () => {
            clearServerState();
        },
        []
    );

    useEffect(() => {
        setError('');

        getServer(match.params.id).catch((error) => {
            console.error(error);
            setError(httpErrorToHuman(error));
        });

        return () => {
            clearServerState();
        };
    }, [match.params.id]);

    const vaultEnabled = serverData?.vaultEnabled ?? false;

    // The keybinds manager is mounted outside this store; tell it which servers use Vault.
    useEffect(() => {
        if (id) {
            setVaultAvailability(id, vaultEnabled);
        }
    }, [id, vaultEnabled]);

    // A Vault restore that stops the server marks it `restoring_backup`. The Vault page
    // stays reachable meanwhile so its progress can be followed; other pages keep the
    // usual conflict screen.
    const showVaultDuringRestore =
        !!id &&
        vaultEnabled &&
        serverData?.status === 'restoring_backup' &&
        !serverData.isTransferring &&
        !serverData.isNodeUnderMaintenance &&
        isServerSectionLink(location.pathname, id, 'vault');

    const filteredServerRoutes = useMemo(() => {
        return routes.server.filter((route) => {
            if (!showDashboard && route.path === '/console') {
                return false;
            }
            return true;
        });
    }, [showDashboard]);

    const sidebarRoutes = routes.server
        .filter((route) => route.name)
        .filter((route) => route.name !== 'Modpacks' || modpackCompatibility.shouldShow)
        .filter((route) => route.name !== 'Versions' || minecraftVersionCompatibility.shouldShow)
        .map((route) => ({
            path: route.path,
            name: route.name!,
            permission: route.permission,
        }));

    return (
        <React.Fragment key={'server-router'}>
            {!uuid || !id ? (
                error ? (
                    <Sidebar>
                        <ServerError message={error} />
                    </Sidebar>
                ) : (
                    <Sidebar>
                        <Spinner size={'large'} centered />
                    </Sidebar>
                )
            ) : (
                <>
                    <Sidebar
                        showServerNav
                        serverRoutes={sidebarRoutes}
                        serverName={serverName}
                        serverId={id}
                        serverUuid={uuid}
                        externalId={externalId}
                        internalId={internalId}
                        serverStatus={serverStatus || undefined}
                        connectionAddress={connectionAddress}
                        blurConnectionAddress={blurConnectionAddress}
                        eggId={eggId}
                        server={serverData}
                        consoleSidebarOpen={consoleSidebarOpen}
                    >
                        <InstallListener />
                        <TransferListener />
                        <VaultRestoreListener />
                        <WebsocketHandler />
                        <PowerDock />
                        <ContentContainer css={tw`mt-4 sm:mt-10 mb-0`}>
                            <AnnouncementBar location="above-content" />
                        </ContentContainer>
                        {powerDockLocation === 'topbar' && (
                            <ContentContainer css={tw`mt-4 mb-0`}>
                                <TopbarPowerControls />
                            </ContentContainer>
                        )}
                        {inConflictState && !showVaultDuringRestore && (!rootAdmin || (rootAdmin && !location.pathname.endsWith(`/server/${id}`))) ? (
                            <ConflictStateRenderer />
                        ) : (
                            <PanelContainer>
                                <ErrorBoundary>
                                    <TransitionRouter>
                                        <Switch location={location}>
                                            {!showDashboard && (
                                                <Route path={to('/console')} exact>
                                                    <Redirect to={to('/')} />
                                                </Route>
                                            )}
                                            {filteredServerRoutes.map(({ path, permission, component: Component }) => (
                                                <PermissionRoute key={path} permission={permission} path={to(path)} exact>
                                                    <Suspense fallback={
                                                        <div css={tw`flex items-center justify-center min-h-[400px]`}>
                                                            <Spinner size={'large'} />
                                                        </div>
                                                    }>
                                                        <ErrorBoundary>
                                                            <Component />
                                                        </ErrorBoundary>
                                                    </Suspense>
                                                </PermissionRoute>
                                            ))}
                                            <Route path={'*'} component={NotFound} />
                                        </Switch>
                                    </TransitionRouter>
                                </ErrorBoundary>
                            </PanelContainer>
                        )}
                    </Sidebar>
                    <ConsoleSidebar />
                </>
            )}
        </React.Fragment>
    );
};

export default () => (
    <PanelProvider>
        <ConsoleSidebarProvider>
            <ServerRouterInner />
        </ConsoleSidebarProvider>
    </PanelProvider>
);
