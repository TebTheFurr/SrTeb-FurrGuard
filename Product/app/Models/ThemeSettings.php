<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Arr;
use Pterodactyl\Helpers\DefaultFooter;

class ThemeSettings extends Model
{
    protected $table = 'theme_settings';
    private static array $configCache = [];

    protected $fillable = ['key', 'config'];

    protected $casts = [
        'config' => 'array',
    ];


    public static function getConfig(string $key = 'default'): array
    {
        if (array_key_exists($key, self::$configCache)) {
            return self::$configCache[$key];
        }

        $settings = self::where('key', $key)->first();
        if (!$settings) {
            $settings = self::create([
                'key' => $key,
                'config' => self::getDefaults(),
            ]);
        }
        $defaults = self::getDefaults();
        $savedConfig = $settings->config ?? [];
        $config = self::deepMergeConfig($defaults, $savedConfig);
        self::$configCache[$key] = $config;

        return $config;
    }

    private static function deepMergeConfig(array $base, array $override): array
    {
        foreach ($override as $key => $value) {
            if (isset($base[$key]) && is_array($base[$key]) && is_array($value)) {
                if (self::isIndexedArray($value) || self::isIndexedArray($base[$key])) {
                    $base[$key] = $value;
                } else {
                    $base[$key] = self::deepMergeConfig($base[$key], $value);
                }
            } else {
                $base[$key] = $value;
            }
        }
        return $base;
    }

    private static function isIndexedArray(array $arr): bool
    {
        if (empty($arr)) {
            return false;
        }
        return array_keys($arr) === range(0, count($arr) - 1);
    }

    public static function getValue(string $path, mixed $default = null): mixed
    {
        $config = self::getConfig();
        return Arr::get($config, $path, $default);
    }

    public static function setConfig(array $config, string $key = 'default'): void
    {
        self::updateOrCreate(
            ['key' => $key],
            ['config' => $config]
        );
        self::clearCache($key);
    }

    public static function updateValue(string $path, mixed $value, string $key = 'default'): void
    {
        $config = self::getConfig($key);
        Arr::set($config, $path, $value);
        self::setConfig($config, $key);
    }

    public static function resetToDefaults(string $key = 'default'): void
    {
        self::setConfig(self::getDefaults(), $key);
    }

    public static function clearCache(string $key = 'default'): void
    {
        if ($key === '*') {
            self::$configCache = [];

            return;
        }

        unset(self::$configCache[$key]);
    }

    public static function getDefaults(): array
    {
        return [
            'general' => [
                'site_name' => 'Pterodactyl',
                'logo_url' => '',
                'logo_url_dark' => '',
                'logo_url_light' => '',
                'copyright_text' => DefaultFooter::html(),
                'footer_custom_css' => DefaultFooter::css(),
                'discord_invite_link' => '',
                'show_discord_navbar' => false,
                'privacy_blur_server_ip' => false,
            ],
            'theme' => [
                'colors' => [
                    'primary' => 'hsl(229, 100%, 64%)',
                    'secondary' => 'hsl(229, 96%, 59%)',
                    'neutral' => 'hsl(0, 0%, 15%)',
                    'base' => 'hsl(0, 0%, 100%)',
                    'muted' => 'hsl(220, 16%, 45%)',
                    'inverted' => 'hsl(220, 14%, 60%)',
                    'background' => 'hsl(240, 3%, 6%)',
                    'background_secondary' => 'hsl(240, 2%, 8%)',
                ],
                'light_colors' => [
                    'primary' => 'hsl(229, 100%, 58%)',
                    'secondary' => 'hsl(229, 96%, 54%)',
                    'neutral' => 'hsl(220, 13%, 82%)',
                    'base' => 'hsl(220, 15%, 12%)',
                    'muted' => 'hsl(220, 9%, 42%)',
                    'inverted' => 'hsl(220, 15%, 12%)',
                    'background' => 'hsl(220, 14%, 96%)',
                    'background_secondary' => 'hsl(220, 13%, 91%)',
                ],
                'border_radius' => '8',
                'font_family' => 'Onest',
            ],
            'layout' => [
                'layout_type' => 'default',
                'show_dashboard' => true,
                'content_max_width' => 1200,
                'server_list_layout' => 'list',
                'auth_background_image' => '',
                'auth_background_overlay' => 55,
                'dashboard_background_image' => '',
                'dashboard_background_overlay' => 35,
                'dashboard_quick_actions' => [
                    ['icon' => 'terminal', 'title' => 'Console', 'link' => '/console'],
                    ['icon' => 'folder-open', 'title' => 'Files', 'link' => '/files'],
                    ['icon' => 'cloud-upload', 'title' => 'Backups', 'link' => '/backups'],
                    ['icon' => 'sliders', 'title' => 'Settings', 'link' => '/settings'],
                ],
                'dashboard_custom_links' => [],
                'account_custom_links' => [
                    ['label' => 'Profile', 'icon' => 'user', 'url' => '/account'],
                    ['label' => 'Security', 'icon' => 'shield-alt', 'url' => '/account#security'],
                    ['label' => 'OAuth', 'icon' => 'link', 'url' => '/account#oauth'],
                    ['label' => 'API Keys', 'icon' => 'lock', 'url' => '/account#api'],
                    ['label' => 'SSH Keys', 'icon' => 'key', 'url' => '/account#ssh'],
                    ['label' => 'Activity', 'icon' => 'history', 'url' => '/account#activity'],
                ],
                'nav_links' => [
                    'categories' => [
                        [
                            'id' => 'overview',
                            'label' => 'Overview',
                            'enabled' => true,
                            'order' => 0,
                            'links' => [
                                [
                                    'id' => 'dashboard',
                                    'label' => 'Dashboard',
                                    'icon' => 'tachometer',
                                    'enabled' => true,
                                    'order' => 0,
                                    'egg_filter' => [],
                                ],
                                [
                                    'id' => 'console',
                                    'label' => 'Console',
                                    'icon' => 'terminal',
                                    'enabled' => true,
                                    'order' => 1,
                                    'egg_filter' => [],
                                ],
                            ],
                        ],
                        [
                            'id' => 'configuration',
                            'label' => 'Configuration',
                            'enabled' => true,
                            'order' => 1,
                            'links' => [
                                [
                                    'id' => 'schedules',
                                    'label' => 'Schedules',
                                    'icon' => 'calendar',
                                    'enabled' => true,
                                    'order' => 0,
                                    'egg_filter' => [],
                                ],
                                [
                                    'id' => 'network',
                                    'label' => 'Network',
                                    'icon' => 'globe',
                                    'enabled' => true,
                                    'order' => 1,
                                    'egg_filter' => [],
                                ],
                                [
                                    'id' => 'startup',
                                    'label' => 'Startup',
                                    'icon' => 'rocket',
                                    'enabled' => true,
                                    'order' => 2,
                                    'egg_filter' => [],
                                ],
                                [
                                    'id' => 'settings',
                                    'label' => 'Settings',
                                    'icon' => 'sliders',
                                    'enabled' => true,
                                    'order' => 3,
                                    'egg_filter' => [],
                                ],
                            ],
                        ],
                        [
                            'id' => 'management',
                            'label' => 'Management',
                            'enabled' => true,
                            'order' => 2,
                            'links' => [
                                [
                                    'id' => 'files',
                                    'label' => 'Files',
                                    'icon' => 'folder-open',
                                    'enabled' => true,
                                    'order' => 0,
                                    'egg_filter' => [],
                                ],
                                [
                                    'id' => 'plugins',
                                    'label' => 'Plugins',
                                    'icon' => 'puzzle-piece',
                                    'enabled' => false,
                                    'order' => 1,
                                    'egg_filter' => [],
                                ],
                                [
                                    'id' => 'minecraft-mods',
                                    'label' => 'Minecraft Mods',
                                    'icon' => 'cube',
                                    'enabled' => false,
                                    'order' => 2,
                                    'egg_filter' => [],
                                ],
                                [
                                    'id' => 'hytale-mods',
                                    'label' => 'Hytale Mods',
                                    'icon' => 'cube',
                                    'enabled' => false,
                                    'order' => 3,
                                    'egg_filter' => [],
                                ],
                                [
                                    'id' => 'subdomains',
                                    'label' => 'Subdomains',
                                    'icon' => 'link',
                                    'enabled' => false,
                                    'order' => 4,
                                    'egg_filter' => [],
                                ],
                                [
                                    'id' => 'properties',
                                    'label' => 'Properties',
                                    'icon' => 'toolbox',
                                    'enabled' => false,
                                    'order' => 5,
                                    'egg_filter' => [],
                                ],
                                [
                                    'id' => 'reverse-proxies',
                                    'label' => 'Reverse Proxies',
                                    'icon' => 'network-wired',
                                    'enabled' => false,
                                    'order' => 6,
                                    'egg_filter' => [],
                                ],
                                [
                                    'id' => 'environment-variables',
                                    'label' => 'Environment Variables',
                                    'icon' => 'key',
                                    'enabled' => false,
                                    'order' => 7,
                                    'egg_filter' => [],
                                ],
                                [
                                    'id' => 'server-import',
                                    'label' => 'Server Importer',
                                    'icon' => 'file-import',
                                    'enabled' => false,
                                    'order' => 8,
                                    'egg_filter' => [],
                                ],
                                [
                                    'id' => 'splits',
                                    'label' => 'Splits',
                                    'icon' => 'sitemap',
                                    'enabled' => false,
                                    'order' => 9,
                                    'egg_filter' => [],
                                ],
                                [
                                    'id' => 'databases',
                                    'label' => 'Databases',
                                    'icon' => 'table',
                                    'enabled' => true,
                                    'order' => 10,
                                    'egg_filter' => [],
                                ],
                                [
                                    'id' => 'backups',
                                    'label' => 'Backups',
                                    'icon' => 'cloud-upload',
                                    'enabled' => true,
                                    'order' => 11,
                                    'egg_filter' => [],
                                ],
                            ],
                        ],
                        [
                            'id' => 'access_logs',
                            'label' => 'Access & Logs',
                            'enabled' => true,
                            'order' => 3,
                            'links' => [
                                [
                                    'id' => 'users',
                                    'label' => 'Users',
                                    'icon' => 'users',
                                    'enabled' => true,
                                    'order' => 0,
                                    'egg_filter' => [],
                                ],
                                [
                                    'id' => 'activity',
                                    'label' => 'Activity',
                                    'icon' => 'chart-line',
                                    'enabled' => true,
                                    'order' => 1,
                                    'egg_filter' => [],
                                ],
                            ],
                        ],
                    ],
                ],
            ],
            'components' => [
                'server_card' => 'default',
                'power_dock' => 'dock',
                'stat_card' => 'default',
                'sidebar_item_style' => 'default',
                'login_page' => 'centered',
                'login_panel_bg_type' => 'image',
                'login_panel_bg_image' => 'https://static0.gamerantimages.com/wordpress/wp-content/uploads/2022/08/minecraft-4.jpg?q=50&fit=crop&w=1296&h=891&dpr=1.5',
                'login_panel_gradient_start' => 'hsl(229, 100%, 64%)',
                'login_panel_gradient_end' => 'hsl(240, 3%, 6%)',
                'translations_enabled' => true,
                'default_language' => 'en',
                'enabled_languages' => null,
                'registration_enabled' => true,
                'allow_startup_command_edit' => true,
                'allow_startup_command_edit_eggs' => [],
                'allow_startup_variables_edit' => true,
                'allow_startup_variables_edit_eggs' => [],
                'allow_docker_image_edit' => true,
                'trash_enabled' => true,
                'trash_auto_delete_hours' => 168,
                'search_ignored_folders' => '',
                'search_mode' => 'global',
                'ram_upgrade_alert' => [
                    'enabled' => false,
                    'threshold' => 85,
                    'title' => 'RAM Limit Approaching',
                    'text' => 'Your server is using a high amount of RAM. Consider upgrading to a higher plan to ensure optimal performance.',
                    'upgrade_button_link' => '/store',
                ],
                'player_count' => [
                    'enabled' => false,
                    'placement' => 'sidebar',
                    'allowed_eggs' => [],
                ],
            ],
            'announcements' => [
                'enabled' => false,
                'icon' => 'bullhorn',
                'title' => '',
                'text' => '',
                'type' => 'info',
                'style' => 'split',
                'location' => 'above-content',
                'button' => [
                    'label' => '',
                    'link' => '',
                    'colour' => 'var(--color-primary)',
                ],
            ],
            'seo' => [
                'indexing_enabled' => false,
                'meta_title' => '',
                'meta_description' => '',
                'meta_image' => '',
                'meta_keywords' => '',
                'favicon' => '',
                'pwa' => [
                    'name' => 'Luna Panel',
                    'short_name' => 'Luna',
                    'description' => 'Manage your servers with Luna Panel.',
                    'background_color' => '#0f1117',
                    'theme_color' => '#5176ff',
                    'icon' => '',
                ],
            ],
            'eggs' => [],
            'advanced' => [
                'captcha' => [
                    'provider' => 'none',
                    'providers' => [
                        'cloudflare_turnstile' => [
                            'site_key' => '',
                            'secret_key' => '',
                        ],
                        'google_recaptcha' => [
                            'site_key' => '',
                            'secret_key' => '',
                        ],
                        'hcaptcha' => [
                            'site_key' => '',
                            'secret_key' => '',
                        ],
                    ],
                ],
                'console_command_prelude' => 'container@pterodactyl~ ',
                'console_prelude_color' => 'hsl(60, 100%, 70%)',
                'backup_ignored_paths' => '',
                'max_server_folders' => 10,
                'max_avatar_upload_file_size' => 4,
                'keybinds_enabled' => false,
                'file_editor_type' => 'default',
                'billing_integration' => [
                    'enabled' => false,
                    'platform' => 'whmcs',
                    'billing_url' => '',
                    'api_key' => '',
                    'api_identifier' => '',
                    'api_secret' => '',
                ],
                'sftp_host_overrides' => [],
            ],
            'addons' => [
                'minecraft_plugin_installer' => [
                    'enabled' => true,
                    'settings' => [
                        'curseforge_api_key' => '',
                        'install_folder' => '/plugins',
                        'grid_columns' => 3,
                        'platforms' => [
                            'modrinth' => true,
                            'curseforge' => true,
                            'hangar' => true,
                            'spigot' => true,
                        ],
                    ],
                ],
                'minecraft_mod_installer' => [
                    'enabled' => true,
                    'settings' => [
                        'curseforge_api_key' => '',
                        'install_folder' => '/mods',
                        'hytale_install_folder' => '/mods',
                        'grid_columns' => 3,
                        'platforms' => [
                            'modrinth' => true,
                            'curseforge' => true,
                        ],
                    ],
                ],
                'minecraft_modpack_installer' => [
                    'enabled' => true,
                    'settings' => [
                        'curseforge_api_key' => '',
                        'auto_switch_egg' => true,
                        'forge_egg_id' => '',
                        'neoforge_egg_id' => '',
                        'fabric_egg_id' => '',
                        'quilt_egg_id' => '',
                        'grid_columns' => 3,
                        'platforms' => [
                            'modrinth' => true,
                            'curseforge' => true,
                        ],
                    ],
                ],
                'minecraft_version_manager' => [
                    'enabled' => true,
                    'settings' => [
                        'auto_switch_egg' => true,
                        'write_eula' => true,
                        'default_cleanup_mode' => 'smart',
                        'vanilla_egg_id' => '',
                        'paper_egg_id' => '',
                        'purpur_egg_id' => '',
                        'spigot_egg_id' => '',
                        'folia_egg_id' => '',
                        'forge_egg_id' => '',
                        'neoforge_egg_id' => '',
                        'fabric_egg_id' => '',
                        'quilt_egg_id' => '',
                        'velocity_egg_id' => '',
                        'waterfall_egg_id' => '',
                        'bungeecord_egg_id' => '',
                        'platforms' => [
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
                        ],
                    ],
                ],
                'egg_changer' => [
                    'enabled' => true,
                    'settings' => [
                        'available_eggs' => [],
                        'always_reinstall' => false,
                        'always_change_startup' => false,
                        'nest_lock' => false,
                        'required_permission' => 'settings.rename',
                        'egg_config' => [],
                    ],
                ],
                'subdomains_manager' => [
                    'enabled' => true,
                    'settings' => [
                        'domains' => [],
                        'cloudflare_api_token' => '',
                        'allowed_eggs' => [],
                    ],
                ],
                'server_icon_changer' => [
                    'enabled' => true,
                    'settings' => [
                        'output_filename' => 'server-icon.png',
                        'icon_size' => 64,
                        'allowed_eggs' => [],
                    ],
                ],
                'server_properties_editor' => [
                    'enabled' => true,
                    'settings' => [
                        'access_mode' => 'both',
                        'allowed_eggs' => [],
                    ],
                ],
                'environment_variable_manager' => [
                    'enabled' => true,
                    'settings' => [
                        'access_mode' => 'both',
                        'allowed_eggs' => [],
                    ],
                ],
                'free_servers' => [
                    'enabled' => true,
                    'settings' => [
                        'require_email_verified' => false,
                        'require_2fa' => false,
                        'auto_expire_unclaimed' => true,
                        'auto_delete_expired_servers' => true,
                    ],
                ],
                'reverse_proxy_manager' => [
                    'enabled' => true,
                    'settings' => [
                        'proxy_type' => 'nginx',
                        'ssl_type' => 'certbot',
                        'access_level' => 'server_owners',
                        'allowed_eggs' => [],
                        'certbot_email' => '',
                        'use_node_ip' => false,
                        'public_proxy_ip' => '',
                        'nginx_config_path' => '/etc/nginx/sites-available',
                        'nginx_enabled_path' => '/etc/nginx/sites-enabled',
                        'traefik_config_path' => '/etc/traefik/dynamic',
                    ],
                ],
                'mass_egg_importer' => [
                    'settings' => [
                        'categories_api_url' => 'https://eggs.pterodactyl.io/api/categories.json',
                        'eggs_api_url' => 'https://eggs.pterodactyl.io/api/eggs.json',
                        'request_timeout' => 20,
                    ],
                ],
                'server_importer' => [
                    'enabled' => true,
                    'settings' => [
                        'max_file_size_mb' => 256,
                        'connection_timeout' => 30,
                        'allowed_eggs' => [],
                    ],
                ],
                'server_splitter' => [
                    'enabled' => true,
                    'settings' => [
                        'max_splits' => 5,
                        'max_memory' => 4096,
                        'max_cpu' => 100,
                        'max_disk' => 10240,
                        'max_backups' => 0,
                        'max_databases' => 0,
                        'max_allocations' => 1,
                        'min_parent_memory' => 1024,
                        'min_parent_cpu' => 25,
                        'min_parent_disk' => 1024,
                        'split_eggs' => [],
                        'allowed_nests' => '',
                        'users_may_delete' => true,
                        'users_may_recreate' => true,
                    ],
                ],
            ],
        ];
    }
}
