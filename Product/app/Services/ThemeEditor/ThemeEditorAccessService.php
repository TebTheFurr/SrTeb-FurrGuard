<?php

namespace Pterodactyl\Services\ThemeEditor;

use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Pterodactyl\Models\User;

class ThemeEditorAccessService
{
    private const TABS = [
        [
            'id' => 'general',
            'label' => 'General',
            'icon' => 'settings',
            'description' => 'Site name and branding',
        ],
        [
            'id' => 'theme',
            'label' => 'Theme',
            'icon' => 'palette',
            'description' => 'Colours, border radius, and fonts',
        ],
        [
            'id' => 'layout',
            'label' => 'Layout',
            'icon' => 'layout',
            'description' => 'Layout settings',
        ],
        [
            'id' => 'links',
            'label' => 'Links',
            'icon' => 'link',
            'description' => 'Navigation links editor',
        ],
        [
            'id' => 'components',
            'label' => 'Components',
            'icon' => 'grid',
            'description' => 'Component customisation',
        ],
        [
            'id' => 'announcements',
            'label' => 'Announcements',
            'icon' => 'megaphone',
            'description' => 'Site announcements',
        ],
        [
            'id' => 'seo',
            'label' => 'SEO',
            'icon' => 'search',
            'description' => 'Meta tags, favicon, and PWA settings',
        ],
        [
            'id' => 'eggs',
            'label' => 'Eggs',
            'icon' => 'egg',
            'description' => 'Egg images',
        ],
        [
            'id' => 'templates',
            'label' => 'Templates',
            'icon' => 'server',
            'description' => 'Reusable server provisioning templates',
        ],
        [
            'id' => 'advanced',
            'label' => 'Advanced',
            'icon' => 'code',
            'description' => 'Advanced settings',
        ],
        [
            'id' => 'oauth',
            'label' => 'OAuth',
            'icon' => 'key',
            'description' => 'OAuth sign-in providers',
        ],
        [
            'id' => 'addons',
            'label' => 'Addons',
            'icon' => 'puzzle',
            'description' => 'Manage installed addons',
        ],
        [
            'id' => 'import-eggs',
            'label' => 'Import eggs',
            'icon' => 'download',
            'description' => 'Install and import eggs in bulk',
        ],
    ];

    private const CONFIG_PATHS = [
        'general' => ['general'],
        'theme' => ['theme'],
        'layout' => [
            'layout.layout_type',
            'layout.show_dashboard',
            'layout.content_max_width',
            'layout.server_list_layout',
            'layout.auth_background_image',
            'layout.auth_background_overlay',
            'layout.dashboard_background_image',
            'layout.dashboard_background_overlay',
            'layout.dashboard_quick_actions',
            'layout.server_background_type',
            'layout.server_background_source',
            'layout.server_background_image',
            'layout.server_background_overlay',
            'components.server_card',
            'components.power_dock',
            'components.stat_card',
            'components.sidebar_item_style',
            'components.login_page',
            'components.login_panel_bg_type',
            'components.login_panel_bg_image',
            'components.login_panel_gradient_start',
            'components.login_panel_gradient_end',
            'components.player_count',
            'components.ram_upgrade_alert',
        ],
        'links' => [
            'layout.nav_links',
            'layout.dashboard_custom_links',
            'layout.account_custom_links',
        ],
        'components' => [
            'components.server_card',
            'components.power_dock',
            'components.stat_card',
            'components.sidebar_item_style',
            'components.login_page',
            'components.login_panel_bg_type',
            'components.login_panel_bg_image',
            'components.login_panel_gradient_start',
            'components.login_panel_gradient_end',
            'components.player_count',
            'components.ram_upgrade_alert',
        ],
        'announcements' => ['announcements'],
        'seo' => ['seo'],
        'eggs' => ['eggs'],
        'advanced' => [
            'advanced',
            'components.registration_enabled',
            'components.hide_dashboard_header',
            'components.allow_startup_command_edit',
            'components.allow_startup_command_edit_eggs',
            'components.allow_startup_variables_edit',
            'components.allow_startup_variables_edit_eggs',
            'components.allow_docker_image_edit',
            'components.trash_enabled',
            'components.trash_auto_delete_hours',
            'components.search_ignored_folders',
            'components.search_mode',
            'components.translations_enabled',
            'components.default_language',
            'components.enabled_languages',
        ],
        'addons' => ['addons'],
        'oauth' => [],
        'templates' => [],
    ];

    public static function tabIds(): array
    {
        return array_column(self::TABS, 'id');
    }

    public static function normaliseTabIds(mixed $tabs): array
    {
        if (!is_array($tabs)) {
            return [];
        }

        $valid = self::tabIds();
        $normalised = [];

        foreach ($tabs as $tab) {
            if (!is_string($tab)) {
                continue;
            }

            if (in_array($tab, $valid, true) && !in_array($tab, $normalised, true)) {
                $normalised[] = $tab;
            }
        }

        return $normalised;
    }

    public function allTabs(bool $includeImportEggs = true): array
    {
        return array_values(array_filter(self::TABS, function (array $tab) use ($includeImportEggs) {
            return $includeImportEggs || $tab['id'] !== 'import-eggs';
        }));
    }

    public function assignableTabs(): array
    {
        return $this->allTabs();
    }

    public function tabsForUser(User $user, array $tabs): array
    {
        if ($user->root_admin) {
            return $tabs;
        }

        return array_values(array_filter($tabs, function (array $tab) use ($user) {
            return $this->userCanAccessTab($user, (string) $tab['id']);
        }));
    }

    public function userCanAccessAnyTab(User $user): bool
    {
        return $user->root_admin || count(self::normaliseTabIds($user->theme_editor_permissions ?? [])) > 0;
    }

    public function userCanAccessTab(User $user, ?string $tab): bool
    {
        if ($user->root_admin) {
            return true;
        }

        if (!$tab) {
            return false;
        }

        if ($tab === 'components' && $this->userHasLayoutTabPermission($user)) {
            return true;
        }

        return in_array($tab, self::normaliseTabIds($user->theme_editor_permissions ?? []), true);
    }

    public function resolvePermittedSaveTab(User $user, ?string $tab): ?string
    {
        if (!$tab) {
            return null;
        }

        if ($this->userCanAccessTab($user, $tab)) {
            return $tab;
        }

        if ($tab === 'components' && $this->userHasLayoutTabPermission($user)) {
            return 'layout';
        }

        return null;
    }

    public function firstAccessibleTab(User $user, array $tabs): ?string
    {
        $availableTabs = $this->tabsForUser($user, $tabs);

        return $availableTabs[0]['id'] ?? null;
    }

    public function activeTabFromRequest(Request $request): ?string
    {
        $activeAddon = $request->input('active_addon', $request->query('active_addon', $request->query('addon')));
        if (is_string($activeAddon) && $activeAddon !== '') {
            return 'addons';
        }

        $tab = $request->input('active_tab', $request->query('active_tab', $request->query('tab')));

        return is_string($tab) && $tab !== '' ? $tab : null;
    }

    public function requestIsAllowed(User $user, Request $request): bool
    {
        if ($user->root_admin) {
            return true;
        }

        $route = $request->route();
        $routeName = $route ? (string) $route->getName() : '';

        if ($routeName === 'admin.settings.theme' && $request->isMethod('GET')) {
            return $this->themeEditorPageIsAllowed($user, $request);
        }

        if ($routeName === 'admin.settings.theme.config') {
            return $this->userCanAccessAnyTab($user);
        }

        if ($request->is('admin/settings/theme') && $request->isMethod('PATCH')) {
            return $this->resolvePermittedSaveTab($user, $this->activeTabFromRequest($request)) !== null;
        }

        if ($routeName === 'admin.settings.theme.export') {
            $activeTab = $this->activeTabFromRequest($request);

            return $activeTab ? $this->userCanAccessTab($user, $activeTab) : $this->userCanAccessAnyTab($user);
        }

        if (in_array($routeName, [
            'admin.settings.theme.reset',
            'admin.settings.theme.upload',
            'admin.settings.theme.delete-image',
            'admin.settings.theme.import',
        ], true)) {
            return $this->resolvePermittedSaveTab($user, $this->activeTabFromRequest($request)) !== null;
        }

        if (str_starts_with($routeName, 'admin.settings.theme.mass-egg-importer.')) {
            return $this->userCanAccessTab($user, 'import-eggs');
        }

        if (str_starts_with($routeName, 'admin.settings.oauth-providers')) {
            return $this->userCanAccessTab($user, 'oauth');
        }

        if (str_starts_with($routeName, 'admin.settings.server-templates')) {
            return $this->userCanAccessTab($user, 'templates');
        }

        if (str_starts_with($routeName, 'admin.settings.announcements')) {
            return $this->userCanAccessTab($user, 'announcements');
        }

        if (str_starts_with($routeName, 'admin.free-servers')) {
            return $this->userCanAccessTab($user, 'addons');
        }

        return false;
    }

    public function filterConfigForUser(User $user, array $config): array
    {
        if ($user->root_admin) {
            return $config;
        }

        $filtered = [];

        foreach (self::normaliseTabIds($user->theme_editor_permissions ?? []) as $tab) {
            $filtered = $this->copyTabConfig($filtered, $config, $tab);
        }

        return $filtered;
    }

    public function mergePermittedConfig(User $user, array $existing, array $incoming, ?string $tab): array
    {
        if ($user->root_admin) {
            return $incoming;
        }

        $tab = $this->resolvePermittedSaveTab($user, $tab);
        if (!$tab) {
            return $existing;
        }

        return $this->copyTabConfig($existing, $incoming, $tab);
    }

    public function resetPermittedConfig(User $user, array $existing, array $defaults, ?string $tab): array
    {
        if ($user->root_admin) {
            return $defaults;
        }

        $tab = $this->resolvePermittedSaveTab($user, $tab);
        if (!$tab) {
            return $existing;
        }

        return $this->copyTabConfig($existing, $defaults, $tab);
    }

    public function tabRequiresEggData(User $user): bool
    {
        foreach (['eggs', 'addons', 'import-eggs', 'advanced', 'links', 'templates'] as $tab) {
            if ($this->userCanAccessTab($user, $tab)) {
                return true;
            }
        }

        return false;
    }

    private function themeEditorPageIsAllowed(User $user, Request $request): bool
    {
        $tab = $this->activeTabFromRequest($request);

        if ($tab) {
            return $this->userCanAccessTab($user, $tab);
        }

        return $this->userCanAccessAnyTab($user);
    }

    private function userHasLayoutTabPermission(User $user): bool
    {
        return in_array('layout', self::normaliseTabIds($user->theme_editor_permissions ?? []), true);
    }

    private function copyTabConfig(array $target, array $source, string $tab): array
    {
        foreach (self::CONFIG_PATHS[$tab] ?? [] as $path) {
            if (Arr::has($source, $path)) {
                Arr::set($target, $path, Arr::get($source, $path));
            }
        }

        return $target;
    }
}
