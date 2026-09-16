import React, { lazy } from 'react';

const FileEditContainer = lazy(() => import('@/components/server/files/FileEditContainer'));
const ScheduleEditContainer = lazy(() => import('@/components/server/schedules/ScheduleEditContainer'));
const AccountOverviewContainer = lazy(() => import('@/components/dashboard/AccountOverviewContainer'));
const ServerDashboard = lazy(() => import('@/components/server/ServerDashboardContainer'));
const ServerConsole = lazy(() => import('@/components/server/console/ServerConsoleContainer'));
const DatabasesContainer = lazy(() => import('@/components/server/databases/DatabasesContainer'));
const ScheduleContainer = lazy(() => import('@/components/server/schedules/ScheduleContainer'));
const UsersContainer = lazy(() => import('@/components/server/users/UsersContainer'));
const BackupContainer = lazy(() => import('@/components/server/backups/BackupContainer'));
const VaultContainer = lazy(() => import('@/components/server/vault/VaultContainer'));
const NetworkContainer = lazy(() => import('@/components/server/network/NetworkContainer'));
const StartupContainer = lazy(() => import('@/components/server/startup/StartupContainer'));
const FileManagerContainer = lazy(() => import('@/components/server/files/FileManagerContainer'));
const SettingsContainer = lazy(() => import('@/components/server/settings/SettingsContainer'));
const ServerActivityLogContainer = lazy(() => import('@/components/server/ServerActivityLogContainer'));
const PluginsContainer = lazy(() => import('@/components/server/plugins/PluginsContainer'));
const MinecraftModsContainer = lazy(() => import('@/components/server/mods/MinecraftModsContainer'));
const HytaleModsContainer = lazy(() => import('@/components/server/mods/HytaleModsContainer'));
const ModsLegacyRedirect = lazy(() => import('@/components/server/mods/ModsLegacyRedirect'));
const ModpacksContainer = lazy(() => import('@/components/server/modpacks/ModpacksContainer'));
const MinecraftVersionsContainer = lazy(() => import('@/components/server/minecraft-versions/MinecraftVersionsContainer'));
const SubdomainsContainer = lazy(() => import('@/components/server/subdomains/SubdomainsContainer'));
const ServerPropertiesContainer = lazy(() => import('@/components/server/properties/ServerPropertiesContainer'));
const ReverseProxiesContainer = lazy(() => import('@/components/server/reverse-proxies/ReverseProxiesContainer'));
const EnvironmentVariablesContainer = lazy(() => import('@/components/server/environment/EnvironmentVariablesContainer'));
const ServerImportContainer = lazy(() => import('@/components/server/server-import/ServerImportContainer'));
const ServerSplitsContainer = lazy(() => import('@/components/server/splits/ServerSplitsContainer'));

interface RouteDefinition {
    path: string;
    // If undefined is passed this route is still rendered into the router itself
    // but no navigation link is displayed in the sub-navigation menu.
    name: string | undefined;
    component: React.ElementType;
    exact?: boolean;
}

interface ServerRouteDefinition extends RouteDefinition {
    permission: string | string[] | null;
}

interface Routes {
    // All of the routes available under "/account"
    account: RouteDefinition[];
    // All of the routes available under "/server/:id"
    server: ServerRouteDefinition[];
}

export default {
    account: [
        {
            path: '/',
            name: 'Account',
            component: AccountOverviewContainer,
            exact: true,
        },
    ],
    server: [
        {
            path: '/',
            permission: null,
            name: 'Dashboard',
            component: ServerDashboard,
            exact: true,
        },
        {
            path: '/console',
            permission: null,
            name: 'Console',
            component: ServerConsole,
            exact: true,
        },
        {
            path: '/files',
            permission: 'file.*',
            name: 'Files',
            component: FileManagerContainer,
        },
        {
            path: '/files/:action(edit|new)',
            permission: 'file.*',
            name: undefined,
            component: FileEditContainer,
        },
        {
            path: '/plugins',
            permission: 'file.*',
            name: 'Plugins',
            component: PluginsContainer,
        },
        {
            path: '/minecraft-mods',
            permission: 'file.*',
            name: 'Minecraft Mods',
            component: MinecraftModsContainer,
        },
        {
            path: '/hytale-mods',
            permission: 'file.*',
            name: 'Hytale Mods',
            component: HytaleModsContainer,
        },
        {
            path: '/mods',
            permission: 'file.*',
            name: undefined,
            component: ModsLegacyRedirect,
        },
        {
            path: '/modpacks',
            permission: 'file.*',
            name: 'Modpacks',
            component: ModpacksContainer,
        },
        {
            path: '/minecraft-versions',
            permission: 'file.*',
            name: 'Versions',
            component: MinecraftVersionsContainer,
        },
        {
            path: '/subdomains',
            permission: ['settings.*', 'file.sftp'],
            name: 'Subdomains',
            component: SubdomainsContainer,
        },
        {
            path: '/reverse-proxies',
            permission: ['settings.*', 'allocation.*'],
            name: 'Reverse Proxies',
            component: ReverseProxiesContainer,
        },
        {
            path: '/properties',
            permission: 'file.*',
            name: 'Properties',
            component: ServerPropertiesContainer,
        },
        {
            path: '/environment-variables',
            permission: 'file.*',
            name: 'Environment Variables',
            component: EnvironmentVariablesContainer,
        },
        {
            path: '/server-import',
            permission: 'file.*',
            name: 'Server Importer',
            component: ServerImportContainer,
        },
        {
            path: '/splits',
            permission: null,
            name: 'Splits',
            component: ServerSplitsContainer,
        },
        {
            path: '/databases',
            permission: 'database.*',
            name: 'Databases',
            component: DatabasesContainer,
        },
        {
            path: '/schedules',
            permission: 'schedule.*',
            name: 'Schedules',
            component: ScheduleContainer,
        },
        {
            path: '/schedules/:id',
            permission: 'schedule.*',
            name: undefined,
            component: ScheduleEditContainer,
        },
        {
            path: '/users',
            permission: 'user.*',
            name: 'Users',
            component: UsersContainer,
        },
        {
            path: '/backups',
            permission: 'backup.*',
            name: 'Backups',
            component: BackupContainer,
        },
        {
            // Access is decided by the vault itself (Discord identity + level),
            // so any user of the server may open the page. It redirects to the
            // server home when Vault is not enabled.
            path: '/vault',
            permission: null,
            name: 'Vault',
            component: VaultContainer,
        },
        {
            path: '/network',
            permission: 'allocation.*',
            name: 'Network',
            component: NetworkContainer,
        },
        {
            path: '/startup',
            permission: 'startup.*',
            name: 'Startup',
            component: StartupContainer,
        },
        {
            path: '/settings',
            permission: ['settings.*', 'file.sftp'],
            name: 'Settings',
            component: SettingsContainer,
        },
        {
            path: '/activity',
            permission: 'activity.*',
            name: 'Activity',
            component: ServerActivityLogContainer,
        },
    ],
} as Routes;
