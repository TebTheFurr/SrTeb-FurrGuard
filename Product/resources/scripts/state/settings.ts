import { action, Action } from 'easy-peasy';

export interface ThemeSettings {
    darkPrimary: string;
    darkSecondary: string;
    darkNeutral: string;
    darkBase: string;
    darkMuted: string;
    darkInverted: string;
    darkBackground: string;
    darkBackgroundSecondary: string;
    lightPrimary: string;
    lightSecondary: string;
    lightNeutral: string;
    lightBase: string;
    lightMuted: string;
    lightInverted: string;
    lightBackground: string;
    lightBackgroundSecondary: string;
    borderRadius: string;
}

export interface DashboardQuickAction {
    icon?: string;
    title?: string;
    link?: string;
}

export interface NavLinkItem {
    id?: string;
    label?: string;
    icon?: string;
    link?: string;
    permission?: string | string[] | null;
    enabled?: boolean;
    order?: number;
    open_in_new_tab?: boolean;
}

export interface NavLinkCategory {
    id?: string;
    label?: string;
    enabled?: boolean;
    order?: number;
    links?: NavLinkItem[];
}

export interface NavLinksConfig {
    categories?: NavLinkCategory[];
}

export interface AnnouncementSettings {
    enabled?: boolean;
    icon?: string;
    title?: string;
    text?: string;
    type?: 'info' | 'success' | 'warning' | 'error' | 'tip';
    style?: 'solid' | 'outline' | 'split';
    location?: 'above-content' | 'topbar';
    button?: {
        label?: string;
        link?: string;
        colour?: string;
    };
}

export interface CustomNavLink {
    label?: string;
    icon?: string;
    url?: string;
    open_in_new_tab?: boolean;
}

export interface LayoutSettings {
    layoutType: 'default' | 'navbar' | 'floating' | 'bottombar';
    showDashboard: boolean;
    contentMaxWidth?: number;
    serverListLayout?: 'list' | 'grid2' | 'grid3';
    dashboardQuickActions?: DashboardQuickAction[];
    dashboardCustomLinks?: CustomNavLink[];
    accountCustomLinks?: CustomNavLink[];
    navLinks?: NavLinksConfig | null;
    authBackgroundImage?: string;
    authBackgroundOverlay?: number;
    dashboardBackgroundImage?: string;
    dashboardBackgroundOverlay?: number;
    serverBackgroundType?: 'none' | 'image';
    serverBackgroundSource?: 'custom' | 'egg';
    serverBackgroundImage?: string;
    serverBackgroundOverlay?: number;
}

export interface RamUpgradeAlertSettings {
    enabled?: boolean;
    threshold?: number;
    title?: string;
    text?: string;
    upgradeButtonLink?: string;
}

export interface PlayerCountSettings {
    enabled?: boolean;
    placement?: 'sidebar' | 'stat_block' | 'server_card';
    allowedEggs?: number[];
}

export interface ComponentsSettings {
    serverCard?: 'default' | 'compact' | 'detailed' | 'minimal';
    powerDock?: 'dock' | 'dock_labels' | 'sidebar' | 'topbar';
    statCard?: 'default' | 'centered' | 'minimal' | 'gradient' | 'compact' | 'split';
    sidebarItemStyle?: 'default' | 'solid' | 'gradient' | 'gradient_no_border';
    loginPage?: 'centered' | 'split_left' | 'minimal' | 'split_card';
    loginPanelBgType?: 'image' | 'gradient';
    loginPanelBgImage?: string;
    loginPanelGradientStart?: string;
    loginPanelGradientEnd?: string;
    translationsEnabled?: boolean;
    defaultLanguage?: string;
    enabledLanguages?: string[] | null;
    hideDashboardHeader?: boolean;
    registrationEnabled?: boolean;
    allowStartupCommandEdit?: boolean;
    allowStartupCommandEditEggs?: number[];
    allowStartupVariablesEdit?: boolean;
    allowStartupVariablesEditEggs?: number[];
    allowDockerImageEdit?: boolean;
    trashEnabled?: boolean;
    trashAutoDeleteHours?: number;
    searchIgnoredFolders?: string;
    searchMode?: 'global' | 'current_directory';
    ramUpgradeAlert?: RamUpgradeAlertSettings;
    playerCount?: PlayerCountSettings;
}

export interface AddonPlatforms {
    modrinth?: boolean;
    curseforge?: boolean;
    hangar?: boolean;
    spigot?: boolean;
}

export interface MinecraftAddonSettings {
    enabled?: boolean;
    curseforgeEnabled?: boolean;
    installFolder?: string;
    hytaleInstallFolder?: string;
    gridColumns?: number;
    platforms?: AddonPlatforms;
}

export interface ModpackLoaderEggMap {
    forge?: number | null;
    neoforge?: number | null;
    fabric?: number | null;
    quilt?: number | null;
}

export interface MinecraftModpackAddonSettings extends MinecraftAddonSettings {
    autoSwitchEgg?: boolean;
    loaderEggMap?: ModpackLoaderEggMap;
}

export interface MinecraftVersionForks {
    vanilla?: boolean;
    paper?: boolean;
    purpur?: boolean;
    spigot?: boolean;
    folia?: boolean;
    forge?: boolean;
    neoforge?: boolean;
    fabric?: boolean;
    quilt?: boolean;
    velocity?: boolean;
    waterfall?: boolean;
    bungeecord?: boolean;
}

export interface MinecraftVersionEggMap {
    vanilla?: number | null;
    paper?: number | null;
    purpur?: number | null;
    spigot?: number | null;
    folia?: number | null;
    forge?: number | null;
    neoforge?: number | null;
    fabric?: number | null;
    quilt?: number | null;
    velocity?: number | null;
    waterfall?: number | null;
    bungeecord?: number | null;
}

export interface MinecraftVersionAddonSettings {
    enabled?: boolean;
    autoSwitchEgg?: boolean;
    writeEula?: boolean;
    defaultCleanupMode?: 'none' | 'smart' | 'full';
    gridColumns?: number;
    forkEggMap?: MinecraftVersionEggMap;
    platforms?: MinecraftVersionForks;
}

export interface ServerIconChangerSettings {
    enabled?: boolean;
    outputFilename?: string;
    iconSize?: number;
    allowedEggs?: number[];
}

export interface FreeServersSettings {
    enabled?: boolean;
    requireEmailVerified?: boolean;
    require2fa?: boolean;
}

export interface ServerPropertiesEditorSettings {
    enabled?: boolean;
    accessMode?: 'file' | 'sidebar' | 'both';
    allowedEggs?: number[];
}

export interface EnvironmentVariableManagerSettings {
    enabled?: boolean;
    accessMode?: 'file' | 'sidebar' | 'both';
    allowedEggs?: number[];
    managedFiles?: string[];
}

export interface ServerImporterSettings {
    enabled?: boolean;
    allowedEggs?: number[];
    maxFileSizeMb?: number;
}

export interface AddonsSettings {
    minecraftPluginInstaller?: MinecraftAddonSettings;
    minecraftModInstaller?: MinecraftAddonSettings;
    minecraftModpackInstaller?: MinecraftModpackAddonSettings;
    minecraftVersionManager?: MinecraftVersionAddonSettings;
    serverIconChanger?: ServerIconChangerSettings;
    serverPropertiesEditor?: ServerPropertiesEditorSettings;
    environmentVariableManager?: EnvironmentVariableManagerSettings;
    freeServers?: FreeServersSettings;
    serverImporter?: ServerImporterSettings;
}

export interface SiteSettings {
    name: string;
    locale: string;
    logo?: string;
    logoDark?: string;
    logoLight?: string;
    copyrightText?: string;
    discordInviteLink?: string;
    showDiscordNavbar?: boolean;
    privacyBlurServerIp?: boolean;
    announcements?: AnnouncementSettings;
    recaptcha: {
        enabled: boolean;
        siteKey: string;
    };
    turnstile: {
        enabled: boolean;
        siteKey: string;
    };
    captcha: {
        enabled: boolean;
        provider: 'none' | 'cloudflare_turnstile' | 'google_recaptcha' | 'hcaptcha';
        siteKey: string;
    };
    theme: ThemeSettings;
    layout?: LayoutSettings;
    components?: ComponentsSettings;
    advanced?: {
        consoleCommandPrelude?: string;
        consolePreludeColor?: string;
        keybindsEnabled?: boolean;
        fileEditorType?: 'default' | 'monaco';
        billingIntegration?: {
            enabled?: boolean;
            platform?: 'whmcs' | 'paymenter';
            billingUrl?: string;
            configured?: boolean;
        };
    };
    addons?: AddonsSettings;
}

export interface SettingsStore {
    data?: SiteSettings;
    setSettings: Action<SettingsStore, SiteSettings>;
}

const settings: SettingsStore = {
    data: undefined,

    setSettings: action((state, payload) => {
        state.data = payload;
    }),
};

export default settings;
