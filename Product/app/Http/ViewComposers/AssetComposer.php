<?php

namespace Pterodactyl\Http\ViewComposers;

use Illuminate\View\View;
use Pterodactyl\Services\Helpers\AssetHashService;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;
use Pterodactyl\Models\ThemeSettings;

class AssetComposer
{
    public function __construct(
        private AssetHashService $assetHashService,
        private SettingsRepositoryInterface $settings,
    ) {
    }

    private function applyAddonNavLinkRules(array $navLinks): array
    {
        $pluginsEnabled = (bool) ThemeSettings::getValue('addons.minecraft_plugin_installer.enabled', true);
        $pluginsInstalled = file_exists(base_path('app/Services/Plugins/PluginSearchService.php'));
        
        $modsEnabled = (bool) ThemeSettings::getValue('addons.minecraft_mod_installer.enabled', true);
        $modsInstalled = file_exists(base_path('app/Services/Mods/ModSearchService.php'));
        
        $subdomainsEnabled = (bool) ThemeSettings::getValue('addons.subdomains_manager.enabled', true);
        $subdomainsInstalled = file_exists(base_path('app/Services/Subdomains/SubdomainService.php'));
        
        $propertiesEnabled = (bool) ThemeSettings::getValue('addons.server_properties_editor.enabled', true);
        $propertiesInstalled = file_exists(base_path('app/Services/ServerProperties/ServerPropertiesService.php'));
        $propertiesAccessMode = ThemeSettings::getValue('addons.server_properties_editor.settings.access_mode', 'both');
        $propertiesShowInSidebar = ($propertiesAccessMode === 'sidebar' || $propertiesAccessMode === 'both');

        $environmentVariablesEnabled = (bool) ThemeSettings::getValue('addons.environment_variable_manager.enabled', true);
        $environmentVariablesInstalled = file_exists(base_path('app/Services/EnvironmentVariables/EnvironmentVariableService.php'));
        $environmentVariablesAccessMode = ThemeSettings::getValue('addons.environment_variable_manager.settings.access_mode', 'both');
        $environmentVariablesShowInSidebar = ($environmentVariablesAccessMode === 'sidebar' || $environmentVariablesAccessMode === 'both');
        
        $reverseProxiesEnabled = (bool) ThemeSettings::getValue('addons.reverse_proxy_manager.enabled', true);
        $reverseProxiesInstalled = file_exists(base_path('app/Services/ReverseProxy/ReverseProxyService.php'));

        $serverImporterEnabled = (bool) ThemeSettings::getValue('addons.server_importer.enabled', true);
        $serverImporterInstalled = file_exists(base_path('app/Services/ServerImport/ServerImportService.php'));

        $serverSplitterEnabled = (bool) ThemeSettings::getValue('addons.server_splitter.enabled', true);
        $serverSplitterInstalled = file_exists(base_path('app/Services/ServerSplitter/ServerSplitterService.php'));

        foreach ($navLinks['categories'] as &$category) {
            if (!isset($category['links'])) {
                continue;
            }

            foreach ($category['links'] as &$link) {
                $linkId = $link['id'] ?? '';

                if ($linkId === 'plugins') {
                    $link['enabled'] = $pluginsInstalled && $pluginsEnabled;
                } elseif ($linkId === 'mods' || $linkId === 'minecraft-mods' || $linkId === 'hytale-mods') {
                    $link['enabled'] = $modsInstalled && $modsEnabled;
                } elseif ($linkId === 'subdomains') {
                    $link['enabled'] = $subdomainsInstalled && $subdomainsEnabled;
                } elseif ($linkId === 'properties') {
                    $link['enabled'] = $propertiesInstalled && $propertiesEnabled && $propertiesShowInSidebar;
                } elseif ($linkId === 'environment-variables') {
                    $link['enabled'] = $environmentVariablesInstalled && $environmentVariablesEnabled && $environmentVariablesShowInSidebar;
                } elseif ($linkId === 'reverse-proxies') {
                    $link['enabled'] = $reverseProxiesInstalled && $reverseProxiesEnabled;
                } elseif ($linkId === 'server-import') {
                    $link['enabled'] = $serverImporterInstalled && $serverImporterEnabled;
                } elseif ($linkId === 'splits') {
                    $link['enabled'] = $serverSplitterInstalled && $serverSplitterEnabled;
                }
            }
        }

        return $navLinks;
    }

    public function compose(View $view): void
    {
        $view->with('asset', $this->assetHashService);
        
        $themeColors = ThemeSettings::getValue('theme.colors', []);
        $themeLightColors = ThemeSettings::getValue('theme.light_colors', []);
        $themeSettings = ThemeSettings::getValue('theme', []);
        $generalSettings = ThemeSettings::getValue('general', []);
        $layoutSettings = ThemeSettings::getValue('layout', []);
        $announcementSettings = ThemeSettings::getValue('announcements', []);
        $seoSettings = ThemeSettings::getValue('seo', []);
        $componentsSettings = ThemeSettings::getValue('components', []);
        $playerCountSettings = is_array($componentsSettings['player_count'] ?? null) ? $componentsSettings['player_count'] : [];
        $ramUpgradeAlertSettings = is_array($componentsSettings['ram_upgrade_alert'] ?? null) ? $componentsSettings['ram_upgrade_alert'] : [];
        $playerCountPlacement = in_array($playerCountSettings['placement'] ?? 'sidebar', ['sidebar', 'stat_block', 'server_card'], true)
            ? $playerCountSettings['placement']
            : 'sidebar';
        $playerCountAllowedEggsRaw = $playerCountSettings['allowed_eggs'] ?? [];
        $playerCountAllowedEggs = is_array($playerCountAllowedEggsRaw)
            ? array_values(array_filter(array_map('intval', $playerCountAllowedEggsRaw), fn (int $eggId) => $eggId > 0))
            : [];
        
        $navLinks = $layoutSettings['nav_links'] ?? null;
        if ($navLinks && isset($navLinks['categories'])) {
            $navLinks = $this->applyAddonNavLinkRules($navLinks);
        }

        $captchaProvider = (string) ThemeSettings::getValue('advanced.captcha.provider', 'none');
        if ($captchaProvider === 'none' && ThemeSettings::getValue('advanced.turnstile_enabled', false)) {
            $captchaProvider = 'cloudflare_turnstile';
        }
        if (!in_array($captchaProvider, ['cloudflare_turnstile', 'google_recaptcha', 'hcaptcha'], true)) {
            $captchaProvider = 'none';
        }
        $captchaSiteKey = '';
        if ($captchaProvider !== 'none') {
            $captchaSiteKey = (string) ThemeSettings::getValue("advanced.captcha.providers.{$captchaProvider}.site_key", '');
        }
        if ($captchaProvider === 'cloudflare_turnstile' && $captchaSiteKey === '') {
            $captchaSiteKey = (string) ThemeSettings::getValue('advanced.turnstile_site_key', '');
        }
        
        $view->with('siteConfiguration', [
            'name' => $generalSettings['site_name'] ?? 'Pterodactyl',
            'locale' => config('app.locale') ?? 'en',
            'logo' => ThemeSettings::getValue('general.logo_url', ''),
            'logoDark' => ThemeSettings::getValue('general.logo_url_dark', ThemeSettings::getValue('general.logo_url', '')),
            'logoLight' => ThemeSettings::getValue('general.logo_url_light', ThemeSettings::getValue('general.logo_url', '')),
            'copyrightText' => $generalSettings['copyright_text'] ?? 'Pterodactyl® © 2015 - ' . date('Y'),
            'discordInviteLink' => $generalSettings['discord_invite_link'] ?? '',
            'showDiscordNavbar' => $generalSettings['show_discord_navbar'] ?? false,
            'privacyBlurServerIp' => (bool) ($generalSettings['privacy_blur_server_ip'] ?? false),
            'recaptcha' => [
                'enabled' => config('recaptcha.enabled', false),
                'siteKey' => config('recaptcha.website_key') ?? '',
            ],
            'turnstile' => [
                'enabled' => $captchaProvider === 'cloudflare_turnstile' && $captchaSiteKey !== '',
                'siteKey' => $captchaProvider === 'cloudflare_turnstile' ? $captchaSiteKey : '',
            ],
            'captcha' => [
                'enabled' => $captchaProvider !== 'none' && $captchaSiteKey !== '',
                'provider' => $captchaProvider,
                'siteKey' => $captchaSiteKey,
            ],
            'theme' => [
                'darkPrimary' => $themeColors['primary'] ?? 'hsl(229, 100%, 64%)',
                'darkSecondary' => $themeColors['secondary'] ?? 'hsl(229, 96%, 59%)',
                'darkNeutral' => $themeColors['neutral'] ?? 'hsl(0, 0%, 15%)',
                'darkBase' => $themeColors['base'] ?? 'hsl(0, 0%, 100%)',
                'darkMuted' => $themeColors['muted'] ?? 'hsl(220, 16%, 45%)',
                'darkInverted' => $themeColors['inverted'] ?? 'hsl(220, 14%, 60%)',
                'darkBackground' => $themeColors['background'] ?? 'hsl(240, 3%, 6%)',
                'darkBackgroundSecondary' => $themeColors['background_secondary'] ?? 'hsl(240, 2%, 8%)',
                'lightPrimary' => $themeLightColors['primary'] ?? 'hsl(229, 100%, 58%)',
                'lightSecondary' => $themeLightColors['secondary'] ?? 'hsl(229, 96%, 54%)',
                'lightNeutral' => $themeLightColors['neutral'] ?? 'hsl(220, 13%, 82%)',
                'lightBase' => $themeLightColors['base'] ?? 'hsl(220, 15%, 12%)',
                'lightMuted' => $themeLightColors['muted'] ?? 'hsl(220, 9%, 42%)',
                'lightInverted' => $themeLightColors['inverted'] ?? 'hsl(220, 15%, 12%)',
                'lightBackground' => $themeLightColors['background'] ?? 'hsl(220, 14%, 96%)',
                'lightBackgroundSecondary' => $themeLightColors['background_secondary'] ?? 'hsl(220, 13%, 91%)',
                'borderRadius' => $themeSettings['border_radius'] ?? '12',
                'fontFamily' => $themeSettings['font_family'] ?? 'Onest',
                'fontFamilyUrl' => \Pterodactyl\Helpers\ThemeHelper::getGoogleFontsUrl(),
            ],
            'layout' => [
                'layoutType' => $layoutSettings['layout_type'] ?? 'default',
                'showDashboard' => $layoutSettings['show_dashboard'] ?? true,
                'serverListLayout' => $layoutSettings['server_list_layout'] ?? 'list',
                'dashboardQuickActions' => $layoutSettings['dashboard_quick_actions'] ?? [],
                'dashboardCustomLinks' => $layoutSettings['dashboard_custom_links'] ?? [],
                'accountCustomLinks' => $layoutSettings['account_custom_links'] ?? [],
                'navLinks' => $navLinks,
                'contentMaxWidth' => (int) ($layoutSettings['content_max_width'] ?? 1200),
                'authBackgroundImage' => $layoutSettings['auth_background_image'] ?? '',
                'authBackgroundOverlay' => $layoutSettings['auth_background_overlay'] ?? 55,
                'dashboardBackgroundImage' => $layoutSettings['dashboard_background_image'] ?? '',
                'dashboardBackgroundOverlay' => $layoutSettings['dashboard_background_overlay'] ?? 35,
                'serverBackgroundType' => $layoutSettings['server_background_type'] ?? 'none',
                'serverBackgroundSource' => $layoutSettings['server_background_source'] ?? 'custom',
                'serverBackgroundImage' => $layoutSettings['server_background_image'] ?? '',
                'serverBackgroundOverlay' => $layoutSettings['server_background_overlay'] ?? 50,
            ],
            'announcements' => $announcementSettings,
            'eggImages' => ThemeSettings::getValue('eggs', []),
            'components' => [
                'serverCard' => $componentsSettings['server_card'] ?? 'default',
                'powerDock' => $componentsSettings['power_dock'] ?? 'dock',
                'statCard' => $componentsSettings['stat_card'] ?? 'default',
                'sidebarItemStyle' => $componentsSettings['sidebar_item_style'] ?? 'default',
                'loginPage' => $componentsSettings['login_page'] ?? 'centered',
                'loginPanelBgType' => $componentsSettings['login_panel_bg_type'] ?? 'image',
                'loginPanelBgImage' => $componentsSettings['login_panel_bg_image'] ?? 'https://static0.gamerantimages.com/wordpress/wp-content/uploads/2022/08/minecraft-4.jpg?q=50&fit=crop&w=1296&h=891&dpr=1.5',
                'loginPanelGradientStart' => $componentsSettings['login_panel_gradient_start'] ?? 'hsl(229, 100%, 64%)',
                'loginPanelGradientEnd' => $componentsSettings['login_panel_gradient_end'] ?? 'hsl(240, 3%, 6%)',
                'translationsEnabled' => $componentsSettings['translations_enabled'] ?? true,
                'defaultLanguage' => $componentsSettings['default_language'] ?? 'en',
                'enabledLanguages' => $componentsSettings['enabled_languages'] ?? null,
                'hideDashboardHeader' => $componentsSettings['hide_dashboard_header'] ?? false,
                'registrationEnabled' => $componentsSettings['registration_enabled'] ?? true,
                'allowStartupCommandEdit' => $componentsSettings['allow_startup_command_edit'] ?? true,
                'allowStartupCommandEditEggs' => $componentsSettings['allow_startup_command_edit_eggs'] ?? [],
                'allowStartupVariablesEdit' => $componentsSettings['allow_startup_variables_edit'] ?? true,
                'allowStartupVariablesEditEggs' => $componentsSettings['allow_startup_variables_edit_eggs'] ?? [],
                'allowDockerImageEdit' => $componentsSettings['allow_docker_image_edit'] ?? true,
                'trashEnabled' => $componentsSettings['trash_enabled'] ?? true,
                'trashAutoDeleteHours' => max(1, (int) ($componentsSettings['trash_auto_delete_hours'] ?? 168)),
                'searchIgnoredFolders' => $componentsSettings['search_ignored_folders'] ?? '',
                'searchMode' => in_array($componentsSettings['search_mode'] ?? 'global', ['global', 'current_directory'], true)
                    ? $componentsSettings['search_mode']
                    : 'global',
                'playerCount' => [
                    'enabled' => (bool) ($playerCountSettings['enabled'] ?? false),
                    'placement' => $playerCountPlacement,
                    'allowedEggs' => $playerCountAllowedEggs,
                ],
                'ramUpgradeAlert' => [
                    'enabled' => (bool) ($ramUpgradeAlertSettings['enabled'] ?? false),
                    'threshold' => (int) ($ramUpgradeAlertSettings['threshold'] ?? 85),
                    'title' => (string) ($ramUpgradeAlertSettings['title'] ?? 'RAM Limit Approaching'),
                    'text' => (string) ($ramUpgradeAlertSettings['text'] ?? 'Your server is using a high amount of RAM. Consider upgrading to a higher plan to ensure optimal performance.'),
                    'upgradeButtonLink' => (string) ($ramUpgradeAlertSettings['upgrade_button_link'] ?? '/store'),
                ],
            ],
            'seo' => [
                'indexingEnabled' => $seoSettings['indexing_enabled'] ?? false,
                'metaTitle' => $seoSettings['meta_title'] ?? '',
                'metaDescription' => $seoSettings['meta_description'] ?? '',
                'metaKeywords' => $seoSettings['meta_keywords'] ?? '',
                'metaImage' => $seoSettings['meta_image'] ?? '',
                'favicon' => $seoSettings['favicon'] ?? '',
                'pwa' => [
                    'name' => $seoSettings['pwa']['name'] ?? '',
                    'shortName' => $seoSettings['pwa']['short_name'] ?? '',
                    'description' => $seoSettings['pwa']['description'] ?? '',
                    'backgroundColor' => $seoSettings['pwa']['background_color'] ?? '#0f1117',
                    'themeColor' => $seoSettings['pwa']['theme_color'] ?? '#5176ff',
                    'icon' => $seoSettings['pwa']['icon'] ?? '',
                ],
            ],
            'advanced' => [
                'consoleCommandPrelude' => ThemeSettings::getValue('advanced.console_command_prelude', 'container@pterodactyl~ '),
                'consolePreludeColor' => ThemeSettings::getValue('advanced.console_prelude_color', 'hsl(60, 100%, 70%)'),
                'keybindsEnabled' => (bool) ThemeSettings::getValue('advanced.keybinds_enabled', false),
                'fileEditorType' => ThemeSettings::getValue('advanced.file_editor_type', 'default') === 'monaco' ? 'monaco' : 'default',
                'billingIntegration' => [
                    'enabled' => (bool) ThemeSettings::getValue('advanced.billing_integration.enabled', false),
                    'platform' => ThemeSettings::getValue('advanced.billing_integration.platform', 'whmcs') === 'paymenter' ? 'paymenter' : 'whmcs',
                    'billingUrl' => (string) ThemeSettings::getValue('advanced.billing_integration.billing_url', ''),
                    'configured' => trim((string) ThemeSettings::getValue('advanced.billing_integration.billing_url', '')) !== '',
                ],
            ],
            'addons' => [
                'minecraftPluginInstaller' => [
                    'enabled' => (bool) ThemeSettings::getValue('addons.minecraft_plugin_installer.enabled', true),
                    'curseforgeEnabled' => !empty(trim(ThemeSettings::getValue('addons.minecraft_plugin_installer.settings.curseforge_api_key', ''))),
                    'installFolder' => ThemeSettings::getValue('addons.minecraft_plugin_installer.settings.install_folder', '/plugins'),
                    'gridColumns' => (int) ThemeSettings::getValue('addons.minecraft_plugin_installer.settings.grid_columns', 3),
                    'platforms' => ThemeSettings::getValue('addons.minecraft_plugin_installer.settings.platforms', [
                        'modrinth' => true,
                        'curseforge' => true,
                        'hangar' => true,
                        'spigot' => true,
                    ]),
                ],
                'minecraftModInstaller' => [
                    'enabled' => (bool) ThemeSettings::getValue('addons.minecraft_mod_installer.enabled', true),
                    'curseforgeEnabled' => !empty(trim(ThemeSettings::getValue('addons.minecraft_mod_installer.settings.curseforge_api_key', ''))),
                    'installFolder' => ThemeSettings::getValue('addons.minecraft_mod_installer.settings.install_folder', '/mods'),
                    'hytaleInstallFolder' => ThemeSettings::getValue('addons.minecraft_mod_installer.settings.hytale_install_folder', '/mods'),
                    'gridColumns' => (int) ThemeSettings::getValue('addons.minecraft_mod_installer.settings.grid_columns', 3),
                    'platforms' => ThemeSettings::getValue('addons.minecraft_mod_installer.settings.platforms', [
                        'modrinth' => true,
                        'curseforge' => true,
                    ]),
                ],
                'minecraftModpackInstaller' => [
                    'enabled' => (bool) ThemeSettings::getValue('addons.minecraft_modpack_installer.enabled', true),
                    'curseforgeEnabled' => !empty(trim(ThemeSettings::getValue('addons.minecraft_modpack_installer.settings.curseforge_api_key', ''))),
                    'autoSwitchEgg' => (bool) ThemeSettings::getValue('addons.minecraft_modpack_installer.settings.auto_switch_egg', true),
                    'loaderEggMap' => [
                        'forge' => (($forgeEggId = (int) ThemeSettings::getValue('addons.minecraft_modpack_installer.settings.forge_egg_id', 0)) > 0) ? $forgeEggId : null,
                        'neoforge' => (($neoforgeEggId = (int) ThemeSettings::getValue('addons.minecraft_modpack_installer.settings.neoforge_egg_id', 0)) > 0) ? $neoforgeEggId : null,
                        'fabric' => (($fabricEggId = (int) ThemeSettings::getValue('addons.minecraft_modpack_installer.settings.fabric_egg_id', 0)) > 0) ? $fabricEggId : null,
                        'quilt' => (($quiltEggId = (int) ThemeSettings::getValue('addons.minecraft_modpack_installer.settings.quilt_egg_id', 0)) > 0) ? $quiltEggId : null,
                    ],
                    'gridColumns' => (int) ThemeSettings::getValue('addons.minecraft_modpack_installer.settings.grid_columns', 3),
                    'platforms' => ThemeSettings::getValue('addons.minecraft_modpack_installer.settings.platforms', [
                        'modrinth' => true,
                        'curseforge' => true,
                    ]),
                ],
                'minecraftVersionManager' => [
                    'enabled' => (bool) ThemeSettings::getValue('addons.minecraft_version_manager.enabled', true),
                    'autoSwitchEgg' => (bool) ThemeSettings::getValue('addons.minecraft_version_manager.settings.auto_switch_egg', true),
                    'writeEula' => (bool) ThemeSettings::getValue('addons.minecraft_version_manager.settings.write_eula', true),
                    'defaultCleanupMode' => ThemeSettings::getValue('addons.minecraft_version_manager.settings.default_cleanup_mode', 'smart'),
                    'forkEggMap' => [
                        'vanilla' => (($vanillaEggId = (int) ThemeSettings::getValue('addons.minecraft_version_manager.settings.vanilla_egg_id', 0)) > 0) ? $vanillaEggId : null,
                        'paper' => (($paperEggId = (int) ThemeSettings::getValue('addons.minecraft_version_manager.settings.paper_egg_id', 0)) > 0) ? $paperEggId : null,
                        'purpur' => (($purpurEggId = (int) ThemeSettings::getValue('addons.minecraft_version_manager.settings.purpur_egg_id', 0)) > 0) ? $purpurEggId : null,
                        'spigot' => (($spigotEggId = (int) ThemeSettings::getValue('addons.minecraft_version_manager.settings.spigot_egg_id', 0)) > 0) ? $spigotEggId : null,
                        'folia' => (($foliaEggId = (int) ThemeSettings::getValue('addons.minecraft_version_manager.settings.folia_egg_id', 0)) > 0) ? $foliaEggId : null,
                        'forge' => (($forgeVersionEggId = (int) ThemeSettings::getValue('addons.minecraft_version_manager.settings.forge_egg_id', 0)) > 0) ? $forgeVersionEggId : null,
                        'neoforge' => (($neoforgeVersionEggId = (int) ThemeSettings::getValue('addons.minecraft_version_manager.settings.neoforge_egg_id', 0)) > 0) ? $neoforgeVersionEggId : null,
                        'fabric' => (($fabricVersionEggId = (int) ThemeSettings::getValue('addons.minecraft_version_manager.settings.fabric_egg_id', 0)) > 0) ? $fabricVersionEggId : null,
                        'quilt' => (($quiltVersionEggId = (int) ThemeSettings::getValue('addons.minecraft_version_manager.settings.quilt_egg_id', 0)) > 0) ? $quiltVersionEggId : null,
                        'velocity' => (($velocityEggId = (int) ThemeSettings::getValue('addons.minecraft_version_manager.settings.velocity_egg_id', 0)) > 0) ? $velocityEggId : null,
                        'waterfall' => (($waterfallEggId = (int) ThemeSettings::getValue('addons.minecraft_version_manager.settings.waterfall_egg_id', 0)) > 0) ? $waterfallEggId : null,
                        'bungeecord' => (($bungeecordEggId = (int) ThemeSettings::getValue('addons.minecraft_version_manager.settings.bungeecord_egg_id', 0)) > 0) ? $bungeecordEggId : null,
                    ],
                    'platforms' => ThemeSettings::getValue('addons.minecraft_version_manager.settings.platforms', [
                        'vanilla' => true,
                        'paper' => true,
                        'purpur' => true,
                        'spigot' => true,
                        'folia' => true,
                        'forge' => true,
                        'neoforge' => true,
                        'fabric' => true,
                        'quilt' => true,
                        'velocity' => true,
                        'waterfall' => true,
                        'bungeecord' => true,
                    ]),
                ],
                'eggChanger' => [
                    'enabled' => (bool) ThemeSettings::getValue('addons.egg_changer.enabled', true),
                    'alwaysReinstall' => (bool) ThemeSettings::getValue('addons.egg_changer.settings.always_reinstall', false),
                    'alwaysChangeStartup' => (bool) ThemeSettings::getValue('addons.egg_changer.settings.always_change_startup', false),
                ],
                'subdomainsManager' => [
                    'enabled' => (bool) ThemeSettings::getValue('addons.subdomains_manager.enabled', true),
                ],
                ...(file_exists(base_path('app/Services/FreeServers/FreeServerService.php')) ? [
                    'freeServers' => [
                        'enabled' => (bool) ThemeSettings::getValue('addons.free_servers.enabled', true),
                        'requireEmailVerified' => (bool) ThemeSettings::getValue('addons.free_servers.settings.require_email_verified', false),
                        'require2fa' => (bool) ThemeSettings::getValue('addons.free_servers.settings.require_2fa', false),
                    ],
                ] : []),
                ...(file_exists(base_path('app/Services/ServerIcon/ServerIconService.php')) ? [
                    'serverIconChanger' => [
                        'enabled' => (bool) ThemeSettings::getValue('addons.server_icon_changer.enabled', true),
                        'outputFilename' => ThemeSettings::getValue('addons.server_icon_changer.settings.output_filename', 'server-icon.png'),
                        'iconSize' => (int) ThemeSettings::getValue('addons.server_icon_changer.settings.icon_size', 64),
                        'allowedEggs' => ThemeSettings::getValue('addons.server_icon_changer.settings.allowed_eggs', []),
                    ],
                ] : []),
                ...(file_exists(base_path('app/Services/ServerProperties/ServerPropertiesService.php')) ? [
                    'serverPropertiesEditor' => [
                        'enabled' => (bool) ThemeSettings::getValue('addons.server_properties_editor.enabled', true),
                        'accessMode' => ThemeSettings::getValue('addons.server_properties_editor.settings.access_mode', 'both'),
                        'allowedEggs' => ThemeSettings::getValue('addons.server_properties_editor.settings.allowed_eggs', []),
                    ],
                ] : []),
                ...(file_exists(base_path('app/Services/EnvironmentVariables/EnvironmentVariableService.php')) ? [
                    'environmentVariableManager' => [
                        'enabled' => (bool) ThemeSettings::getValue('addons.environment_variable_manager.enabled', true),
                        'accessMode' => ThemeSettings::getValue('addons.environment_variable_manager.settings.access_mode', 'both'),
                        'allowedEggs' => ThemeSettings::getValue('addons.environment_variable_manager.settings.allowed_eggs', []),
                        'managedFiles' => \Pterodactyl\Services\EnvironmentVariables\EnvironmentVariableService::getManagedFiles(),
                    ],
                ] : []),
                ...(file_exists(base_path('app/Services/ReverseProxy/ReverseProxyService.php')) ? [
                    'reverseProxyManager' => [
                        'enabled' => (bool) ThemeSettings::getValue('addons.reverse_proxy_manager.enabled', true),
                        'proxyType' => ThemeSettings::getValue('addons.reverse_proxy_manager.settings.proxy_type', 'nginx'),
                        'sslType' => ThemeSettings::getValue('addons.reverse_proxy_manager.settings.ssl_type', 'certbot'),
                        'allowedEggs' => ThemeSettings::getValue('addons.reverse_proxy_manager.settings.allowed_eggs', []),
                    ],
                ] : []),
                ...(file_exists(base_path('app/Services/ServerImport/ServerImportService.php')) ? [
                    'serverImporter' => [
                        'enabled' => (bool) ThemeSettings::getValue('addons.server_importer.enabled', true),
                        'allowedEggs' => ThemeSettings::getValue('addons.server_importer.settings.allowed_eggs', []),
                        'maxFileSizeMb' => (int) ThemeSettings::getValue('addons.server_importer.settings.max_file_size_mb', 256),
                    ],
                ] : []),
                ...(file_exists(base_path('app/Services/ServerSplitter/ServerSplitterService.php')) ? [
                    'serverSplitter' => [
                        'enabled' => (bool) ThemeSettings::getValue('addons.server_splitter.enabled', true),
                        'maxSplits' => (int) ThemeSettings::getValue('addons.server_splitter.settings.max_splits', 5),
                        'maxMemory' => (int) ThemeSettings::getValue('addons.server_splitter.settings.max_memory', 4096),
                        'maxCpu' => (int) ThemeSettings::getValue('addons.server_splitter.settings.max_cpu', 100),
                        'maxDisk' => (int) ThemeSettings::getValue('addons.server_splitter.settings.max_disk', 10240),
                        'maxBackups' => (int) ThemeSettings::getValue('addons.server_splitter.settings.max_backups', 0),
                        'maxDatabases' => (int) ThemeSettings::getValue('addons.server_splitter.settings.max_databases', 0),
                        'maxAllocations' => (int) ThemeSettings::getValue('addons.server_splitter.settings.max_allocations', 1),
                        'allowedEggs' => ThemeSettings::getValue('addons.server_splitter.settings.split_eggs', ThemeSettings::getValue('addons.server_splitter.settings.allowed_eggs', [])),
                        'usersMayDelete' => (bool) ThemeSettings::getValue('addons.server_splitter.settings.users_may_delete', true),
                        'usersMayRecreate' => (bool) ThemeSettings::getValue('addons.server_splitter.settings.users_may_recreate', true),
                    ],
                ] : []),
            ],
        ]);
    }
}
