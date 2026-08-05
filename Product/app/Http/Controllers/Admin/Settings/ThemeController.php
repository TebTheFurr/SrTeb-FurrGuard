<?php

namespace Pterodactyl\Http\Controllers\Admin\Settings;
use Illuminate\View\View;
use Illuminate\Http\Request;
use Throwable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;
use Illuminate\Http\RedirectResponse;
use Prologue\Alerts\AlertsMessageBag;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Models\ThemeSettings;
use Pterodactyl\Models\Egg;
use Pterodactyl\Models\Nest;
use Pterodactyl\Models\Location;
use Pterodactyl\Models\Node;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\View as ViewFacade;
use Pterodactyl\Services\Eggs\Sharing\EggImporterService;
use Pterodactyl\Services\MassEggImporter\MassEggImporterService;
use Pterodactyl\Services\Pwa\PwaManifestService;
use Pterodactyl\Services\ThemeEditor\ThemeEditorAccessService;
use Pterodactyl\Traits\Helpers\AvailableLanguages;

class ThemeController extends Controller
{
    use AvailableLanguages;
    public function __construct(
        private AlertsMessageBag $alert,
        private ThemeEditorAccessService $themeEditorAccess,
        private PwaManifestService $pwaManifestService,
    ) {
    }

    public function index(Request $request): View
    {
        $user = $request->user();
        $tabs = $this->themeEditorAccess->tabsForUser($user, $this->getTabs());

        if (empty($tabs)) {
            abort(403);
        }

        $requestedTab = $this->themeEditorAccess->activeTabFromRequest($request);
        if ($requestedTab && !in_array($requestedTab, array_column($tabs, 'id'), true)) {
            abort(403);
        }

        $config = $this->themeEditorAccess->filterConfigForUser($user, ThemeSettings::getConfig());
        $defaults = $this->themeEditorAccess->filterConfigForUser($user, ThemeSettings::getDefaults());
        $includeEggData = $user->root_admin || $this->themeEditorAccess->tabRequiresEggData($user);
        $eggs = $includeEggData ? Egg::with('nest')->get() : collect();
        $nests = $includeEggData ? Nest::with('eggs')->get() : collect();
        $locations = ($user->root_admin || $this->themeEditorAccess->userCanAccessTab($user, 'addons')) ? Location::all() : collect();
        $nodes = $user->root_admin ? Node::all() : collect();

        return view('admin.settings.theme-editor', [
            'config' => $config,
            'defaults' => $defaults,
            'configJson' => json_encode($config),
            'defaultsJson' => json_encode($defaults),
            'eggsJson' => json_encode($eggs->map(fn($egg) => [
                'id' => $egg->id,
                'name' => $egg->name,
                'nest_id' => $egg->nest_id,
                'nest_name' => $egg->nest?->name ?? 'Unknown',
                'description' => $egg->description,
            ])),
            'nestsJson' => json_encode($nests->map(fn($nest) => [
                'id' => $nest->id,
                'name' => $nest->name,
                'eggs' => $nest->eggs->map(fn($egg) => [
                    'id' => $egg->id,
                    'name' => $egg->name,
                ]),
            ])),
            'locationsJson' => json_encode($locations->map(fn($loc) => [
                'id' => $loc->id,
                'short' => $loc->short,
                'long' => $loc->long,
            ])),
            'nodesJson' => json_encode($nodes->map(fn($node) => [
                'id' => $node->id,
                'name' => $node->name,
                'fqdn' => $node->fqdn,
            ])),
            'tabs' => $tabs,
            'fonts' => $this->getAvailableFonts(),
            'languages' => $this->getAvailableLanguages(),
            'addons' => ($user->root_admin || $this->themeEditorAccess->userCanAccessTab($user, 'addons')) ? $this->getInstalledAddons() : [],
        ]);
    }

    public function getConfig(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'config' => $this->themeEditorAccess->filterConfigForUser($user, ThemeSettings::getConfig()),
            'defaults' => $this->themeEditorAccess->filterConfigForUser($user, ThemeSettings::getDefaults()),
        ]);
    }

    public function update(Request $request): JsonResponse|RedirectResponse
    {
        $config = $request->input('config');

        if (!is_array($config)) {
            if ($request->expectsJson()) {
                return response()->json(['error' => 'Invalid configuration data'], 422);
            }
            $this->alert->danger('Invalid configuration data.')->flash();
            return redirect()->route('admin.settings.theme');
        }

        $user = $request->user();
        $activeTab = $this->themeEditorAccess->activeTabFromRequest($request);
        $existingConfig = ThemeSettings::getConfig();
        $config = $this->themeEditorAccess->mergePermittedConfig($user, $existingConfig, $config, $activeTab);
        $defaults = ThemeSettings::getDefaults();

        $merged = $this->deepMerge($defaults, $existingConfig);
        $merged = $this->deepMerge($merged, $config);
        $merged = $this->preservePasswordFieldsIfBlank($merged, $existingConfig);
        $merged = $this->preserveSubdomainsCloudflareTokenIfBlank($merged, $existingConfig);

        $merged = $this->normalizeSubdomainsManagerSettingsForStorage($merged);
        $merged = $this->normalizeReverseProxyManagerSettingsForStorage($merged);

        ThemeSettings::setConfig($merged);
        $this->syncPwaManifest($merged, $existingConfig, $activeTab);

        if ($request->expectsJson()) {
            return response()->json([
                'success' => true,
                'message' => 'Theme settings have been updated successfully.',
                'config' => $this->themeEditorAccess->filterConfigForUser($user, ThemeSettings::getConfig()),
            ]);
        }

        $this->alert->success('Theme settings have been updated successfully.')->flash();
        return redirect()->route('admin.settings.theme');
    }

    public function reset(Request $request): JsonResponse
    {
        $user = $request->user();
        $activeTab = $this->themeEditorAccess->activeTabFromRequest($request);
        $config = $this->themeEditorAccess->resetPermittedConfig($user, ThemeSettings::getConfig(), ThemeSettings::getDefaults(), $activeTab);

        ThemeSettings::setConfig($config);
        $this->syncPwaManifest($config, $config, $activeTab);

        return response()->json([
            'success' => true,
            'message' => 'Theme settings have been reset to defaults.',
            'config' => $this->themeEditorAccess->filterConfigForUser($user, ThemeSettings::getConfig()),
        ]);
    }

    public function uploadImage(Request $request): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'file', 'mimetypes:image/jpeg,image/png,image/gif,image/webp,image/svg+xml', 'max:5120'],
            'path' => ['nullable', 'string'],
        ]);

        $file = $request->file('image');
        $path = trim((string) $request->input('path', 'theme'), '/');
        $path = $path !== '' ? $path : 'theme';

        if (!$this->canUseUploadPath($request, $path)) {
            return $this->forbiddenJson();
        }

        $name = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
        $name = preg_replace('/[^a-zA-Z0-9._-]/', '', $name ?? '') ?: 'image';
        $extension = strtolower((string) $file->getClientOriginalExtension());
        $filename = time() . '_' . $name . ($extension !== '' ? '.' . $extension : '');

        try {
            Storage::disk('public')->makeDirectory($path);
            $storedPath = Storage::disk('public')->putFileAs($path, $file, $filename);
        } catch (Throwable $exception) {
            return response()->json([
                'success' => false,
                'error' => 'Failed to upload image.',
            ], 500);
        }

        if (!$storedPath) {
            return response()->json([
                'success' => false,
                'error' => 'Failed to upload image.',
            ], 500);
        }

        return response()->json([
            'success' => true,
            'url' => '/storage/' . $storedPath,
            'path' => $storedPath,
        ]);
    }

    public function deleteImage(Request $request): JsonResponse
    {
        $request->validate([
            'path' => 'required|string',
        ]);

        $path = $request->input('path');

        if (!$this->canUseUploadPath($request, trim(dirname((string) $path), '/'))) {
            return $this->forbiddenJson();
        }

        if (Storage::exists($path)) {
            Storage::delete($path);
        }

        return response()->json([
            'success' => true,
        ]);
    }

    public function exportConfig(Request $request): JsonResponse
    {
        $config = $this->themeEditorAccess->filterConfigForUser($request->user(), ThemeSettings::getConfig());

        return response()->json($config)
            ->header('Content-Disposition', 'attachment; filename="theme-config.json"');
    }

    public function importConfig(Request $request): JsonResponse
    {
        $request->validate([
            'config' => 'required|file|mimes:json',
        ]);

        $contents = file_get_contents($request->file('config')->getRealPath());
        $config = json_decode($contents, true);

        if (!is_array($config)) {
            return response()->json(['error' => 'Invalid configuration file'], 422);
        }

        $defaults = ThemeSettings::getDefaults();
        $merged = array_replace_recursive($defaults, $config);
        $merged = $this->themeEditorAccess->mergePermittedConfig($request->user(), ThemeSettings::getConfig(), $merged, $this->themeEditorAccess->activeTabFromRequest($request));

        $merged = $this->normalizeReverseProxyManagerSettingsForStorage($merged);

        ThemeSettings::setConfig($merged);
        $this->pwaManifestService->sync();

        return response()->json([
            'success' => true,
            'message' => 'Configuration imported successfully.',
            'config' => $this->themeEditorAccess->filterConfigForUser($request->user(), ThemeSettings::getConfig()),
        ]);
    }

    public function massEggImporterCatalogue(Request $request): JsonResponse
    {
        if (!$this->themeEditorAccess->userCanAccessTab($request->user(), 'import-eggs')) {
            return $this->forbiddenJson();
        }

        $timeout = max(5, MassEggImporterService::getRequestTimeout());
        $categoriesUrl = MassEggImporterService::getCategoriesApiUrl();
        $eggsUrl = MassEggImporterService::getEggsApiUrl();

        try {
            $categoriesResponse = Http::timeout($timeout)->acceptJson()->get($categoriesUrl);
            $eggsResponse = Http::timeout($timeout)->acceptJson()->get($eggsUrl);
        } catch (Throwable $exception) {
            return response()->json(['error' => 'Failed to fetch egg catalogue.'], 500);
        }

        if (!$categoriesResponse->successful() || !$eggsResponse->successful()) {
            return response()->json(['error' => 'Failed to fetch egg catalogue.'], 500);
        }

        $categories = $categoriesResponse->json();
        $eggs = $eggsResponse->json();

        if (!is_array($categories) || !is_array($eggs)) {
            return response()->json(['error' => 'Invalid egg catalogue response.'], 500);
        }

        return response()->json([
            'categories' => array_values($categories),
            'eggs' => array_values($eggs),
        ]);
    }

    public function installMassEgg(Request $request, EggImporterService $importerService): JsonResponse
    {
        if (!$this->themeEditorAccess->userCanAccessTab($request->user(), 'import-eggs')) {
            return $this->forbiddenJson();
        }

        $validated = $request->validate([
            'nest_id' => 'required|integer|exists:nests,id',
            'download_url' => 'required|url|max:2048',
            'egg_id' => 'nullable|string|max:255',
        ]);

        $downloadUrl = (string) $validated['download_url'];
        if (!str_starts_with($downloadUrl, 'https://raw.githubusercontent.com/')
            && !str_starts_with($downloadUrl, 'https://eggs.pterodactyl.io/')) {
            return response()->json(['error' => 'Only trusted egg sources are allowed.'], 422);
        }

        $timeout = max(5, MassEggImporterService::getRequestTimeout());
        $tempPath = tempnam(sys_get_temp_dir(), 'mass_egg_');
        if (!is_string($tempPath) || $tempPath === '') {
            return response()->json(['error' => 'Failed to prepare temporary file for import.'], 500);
        }
        $uploadedFile = null;

        try {
            $response = Http::timeout($timeout)->get($downloadUrl);
            if (!$response->successful()) {
                return response()->json(['error' => 'Failed to download egg file.'], 422);
            }

            $raw = (string) $response->body();
            $decoded = json_decode($raw, true);
            if (!is_array($decoded)) {
                return response()->json(['error' => 'Downloaded egg file is invalid JSON.'], 422);
            }

            file_put_contents($tempPath, json_encode($decoded, JSON_UNESCAPED_SLASHES));

            $safeEggId = preg_replace('/[^a-zA-Z0-9._-]/', '-', (string) ($validated['egg_id'] ?? 'egg'));
            $filename = 'egg-' . trim($safeEggId, '-_.') . '.json';
            if ($filename === 'egg-.json') {
                $filename = 'egg-import.json';
            }

            $uploadedFile = new UploadedFile($tempPath, $filename, 'application/json', null, true);
            $egg = $importerService->handle($uploadedFile, (int) $validated['nest_id']);

            return response()->json([
                'success' => true,
                'egg' => [
                    'id' => $egg->id,
                    'name' => $egg->name,
                    'nest_id' => $egg->nest_id,
                ],
            ]);
        } catch (Throwable $exception) {
            return response()->json(['error' => 'Failed to import egg from URL.'], 422);
        } finally {
            if ($uploadedFile instanceof UploadedFile && $uploadedFile->isFile()) {
                @unlink($uploadedFile->getPathname());
            } elseif (is_string($tempPath) && is_file($tempPath)) {
                @unlink($tempPath);
            }
        }
    }

    public function importMassEggs(Request $request, EggImporterService $importerService): JsonResponse
    {
        if (!$this->themeEditorAccess->userCanAccessTab($request->user(), 'import-eggs')) {
            return $this->forbiddenJson();
        }

        $validated = $request->validate([
            'nest_id' => 'required|integer|exists:nests,id',
            'import_files' => 'required|array|min:1',
            'import_files.*' => 'required|file|mimes:json',
        ]);

        $imported = [];
        $failed = [];

        foreach ($request->file('import_files', []) as $file) {
            try {
                $egg = $importerService->handle($file, (int) $validated['nest_id']);
                $imported[] = [
                    'filename' => $file->getClientOriginalName(),
                    'id' => $egg->id,
                    'name' => $egg->name,
                ];
            } catch (Throwable $exception) {
                $failed[] = [
                    'filename' => $file->getClientOriginalName(),
                    'error' => 'Import failed for this file.',
                ];
            }
        }

        return response()->json([
            'success' => count($imported) > 0,
            'imported' => $imported,
            'failed' => $failed,
        ], count($imported) > 0 ? 200 : 422);
    }

    public function forceCancelServerImports(Request $request): JsonResponse
    {
        if (!$this->themeEditorAccess->userCanAccessTab($request->user(), 'addons')) {
            return $this->forbiddenJson();
        }

        $serviceClass = 'Pterodactyl\Services\ServerImport\ServerImportService';

        if (!class_exists($serviceClass)) {
            return response()->json(['error' => 'Server Importer addon is not installed.'], 503);
        }

        return response()->json($serviceClass::forceCancelAll());
    }

    private function syncPwaManifest(array $merged, array $previousConfig, ?string $activeTab): void
    {
        if ($activeTab === 'seo') {
            $this->pwaManifestService->sync();

            return;
        }

        if ($activeTab === 'general') {
            $previousName = (string) ($previousConfig['general']['site_name'] ?? '');
            $mergedName = (string) ($merged['general']['site_name'] ?? '');

            if ($previousName !== $mergedName) {
                $this->pwaManifestService->sync();
            }

            return;
        }

        if ($activeTab === null) {
            $this->pwaManifestService->sync();
        }
    }

    private function canUseUploadPath(Request $request, string $path): bool
    {
        $user = $request->user();

        if ($user->root_admin) {
            return true;
        }

        if ($path === 'theme/eggs') {
            return $this->themeEditorAccess->userCanAccessTab($user, 'eggs');
        }

        return $this->themeEditorAccess->userCanAccessTab($user, $this->themeEditorAccess->activeTabFromRequest($request));
    }

    private function forbiddenJson(): JsonResponse
    {
        return response()->json(['error' => 'You do not have permission to access this theme editor area.'], 403);
    }

    private function getTabs(): array
    {
        $tabs = $this->themeEditorAccess->allTabs(ViewFacade::exists('admin.settings.theme-editor.tabs.import-eggs'));

        // $tabs[] = [
        //     'id' => 'environment',
        //     'label' => 'Environment',
        //     'icon' => 'terminal',
        //     'description' => 'Environment variables',
        // ];

        return $tabs;
    }

    private function getAvailableFonts(): array
    {
        return [
            ['value' => 'Onest', 'label' => 'Onest'],
            ['value' => 'Inter', 'label' => 'Inter'],
            ['value' => 'Roboto', 'label' => 'Roboto'],
            ['value' => 'Open Sans', 'label' => 'Open Sans'],
            ['value' => 'Lato', 'label' => 'Lato'],
            ['value' => 'Montserrat', 'label' => 'Montserrat'],
            ['value' => 'Poppins', 'label' => 'Poppins'],
            ['value' => 'Source Sans Pro', 'label' => 'Source Sans Pro'],
            ['value' => 'Nunito', 'label' => 'Nunito'],
            ['value' => 'Raleway', 'label' => 'Raleway'],
            ['value' => 'Ubuntu', 'label' => 'Ubuntu'],
            ['value' => 'DM Sans', 'label' => 'DM Sans'],
            ['value' => 'Plus Jakarta Sans', 'label' => 'Plus Jakarta Sans'],
            ['value' => 'Geist', 'label' => 'Geist'],
            ['value' => 'Satoshi', 'label' => 'Satoshi'],
        ];
    }

    private function deepMerge(array $base, array $override): array
    {
        foreach ($override as $key => $value) {
            if (isset($base[$key]) && is_array($base[$key]) && is_array($value)) {
                if ($this->isIndexedArray($value)) {
                    $base[$key] = $value;
                } else {
                    $base[$key] = $this->deepMerge($base[$key], $value);
                }
            } else {
                $base[$key] = $value;
            }
        }
        return $base;
    }

    private function preservePasswordFieldsIfBlank(array $merged, array $existingConfig): array
    {
        $passwordFields = [
            'advanced.billing_integration.api_key',
            'advanced.billing_integration.api_identifier',
            'advanced.billing_integration.api_secret',
            'advanced.captcha.providers.cloudflare_turnstile.secret_key',
            'advanced.captcha.providers.google_recaptcha.secret_key',
            'advanced.captcha.providers.hcaptcha.secret_key',
        ];

        foreach ($passwordFields as $path) {
            $pathParts = explode('.', $path);
            $incomingValue = $this->getNestedValue($merged, $pathParts);
            $existingValue = $this->getNestedValue($existingConfig, $pathParts);

            if (
                $incomingValue === '' &&
                $existingValue !== null &&
                trim((string) $existingValue) !== ''
            ) {
                $this->setNestedValue($merged, $pathParts, $existingValue);
            }
        }

        $this->preserveAddonPasswordFields($merged, $existingConfig);

        return $merged;
    }

    private function preserveAddonPasswordFields(array &$merged, array $existingConfig): void
    {
        if (!isset($merged['addons']) || !is_array($merged['addons'])) {
            return;
        }

        foreach ($merged['addons'] as $addonId => $addonData) {
            if (!isset($addonData['settings']) || !is_array($addonData['settings'])) {
                continue;
            }

            $existingSettings = $existingConfig['addons'][$addonId]['settings'] ?? [];
            if (!is_array($existingSettings)) {
                continue;
            }

            $passwordSettingKeys = $this->getAddonPasswordSettingKeys($addonId);

            foreach ($passwordSettingKeys as $settingKey) {
                $incomingValue = $addonData['settings'][$settingKey] ?? '';
                $existingValue = $existingSettings[$settingKey] ?? '';

                if (
                    $incomingValue === '' &&
                    trim((string) $existingValue) !== ''
                ) {
                    $merged['addons'][$addonId]['settings'][$settingKey] = $existingValue;
                }
            }
        }
    }

    private function getAddonPasswordSettingKeys(string $addonId): array
    {
        $passwordSettings = [
            'minecraft_plugin_installer' => ['curseforge_api_key'],
            'minecraft_mod_installer' => ['curseforge_api_key'],
            'minecraft_modpack_installer' => ['curseforge_api_key'],
            'subdomains_manager' => ['cloudflare_api_token'],
            'reverse_proxy_manager' => ['cloudflare_api_token'],
        ];

        return $passwordSettings[$addonId] ?? [];
    }

    private function getNestedValue(array $array, array $path): mixed
    {
        $current = $array;
        foreach ($path as $key) {
            if (!is_array($current) || !array_key_exists($key, $current)) {
                return null;
            }
            $current = $current[$key];
        }
        return $current;
    }

    private function setNestedValue(array &$array, array $path, mixed $value): void
    {
        $current = &$array;
        foreach ($path as $i => $key) {
            if ($i === count($path) - 1) {
                $current[$key] = $value;
            } else {
                if (!isset($current[$key]) || !is_array($current[$key])) {
                    $current[$key] = [];
                }
                $current = &$current[$key];
            }
        }
    }

    private function preserveSubdomainsCloudflareTokenIfBlank(array $merged, array $existingConfig): array
    {
        if (!isset($merged['addons']['subdomains_manager']['settings']) || !is_array($merged['addons']['subdomains_manager']['settings'])) {
            return $merged;
        }

        $settings = &$merged['addons']['subdomains_manager']['settings'];
        $previous = $existingConfig['addons']['subdomains_manager']['settings'] ?? null;
        if (!is_array($previous)) {
            return $merged;
        }

        $incoming = trim((string) ($settings['cloudflare_api_token'] ?? ''));
        $had = isset($previous['cloudflare_api_token']) && trim((string) $previous['cloudflare_api_token']) !== '';

        if ($incoming === '' && $had) {
            $settings['cloudflare_api_token'] = $previous['cloudflare_api_token'];
        }

        return $merged;
    }

    private function normalizeSubdomainsManagerSettingsForStorage(array $config): array
    {
        if (!isset($config['addons']['subdomains_manager']['settings']) || !is_array($config['addons']['subdomains_manager']['settings'])) {
            return $config;
        }

        $settings = &$config['addons']['subdomains_manager']['settings'];
        $settings['domains'] = $this->normalizeSubdomainDomainConfigs($settings['domains'] ?? []);

        foreach (['cloudflare_api_token', 'blacklisted_subdomains', 'blacklist_regex'] as $key) {
            if (array_key_exists($key, $settings) && $settings[$key] === null) {
                $settings[$key] = '';
            }
        }

        if (array_key_exists('allowed_eggs', $settings) && $settings['allowed_eggs'] === null) {
            $settings['allowed_eggs'] = [];
        }

        if (array_key_exists('split_eggs', $settings) && $settings['split_eggs'] === null) {
            $settings['split_eggs'] = [];
        }

        return $config;
    }

    private function normalizeSubdomainDomainConfigs(mixed $domains): array
    {
        if (is_array($domains)) {
            $items = $this->isSubdomainDomainConfigArray($domains) ? [$domains] : array_values($domains);
        } elseif (is_string($domains) && trim($domains) !== '') {
            $items = [$domains];
        } else {
            $items = [];
        }

        $configs = [];
        foreach ($items as $item) {
            $config = $this->normalizeSubdomainDomainConfig($item);
            if ($config['domain'] !== '' || $config['zone_id'] !== '') {
                $configs[] = $config;
            }
        }

        return $configs;
    }

    private function isSubdomainDomainConfigArray(array $value): bool
    {
        foreach (['domain', 'zone_id', 'dns_ip', 'routing_mode', 'srv_enabled', 'srv_service', 'srv_protocol', 'srv_protocol_by_egg', 'a_record_enabled'] as $key) {
            if (array_key_exists($key, $value)) {
                return true;
            }
        }

        return false;
    }

    private function normalizeSubdomainDomainConfig(mixed $value): array
    {
        if (is_string($value)) {
            $source = ['domain' => $value];
        } elseif (is_array($value)) {
            $source = $value;
        } else {
            $source = [];
        }

        $routingMode = ($source['routing_mode'] ?? 'game') === 'web' ? 'web' : 'game';
        $srvServiceByEgg = $this->normalizeSubdomainSrvServiceMap($source['srv_service_by_egg'] ?? []);
        $srvProtocolByEgg = $this->normalizeSubdomainSrvProtocolMap($source['srv_protocol_by_egg'] ?? []);
        $srvServiceMode = ($source['srv_service_mode'] ?? '') === 'per_egg' || !empty($srvServiceByEgg) ? 'per_egg' : 'global';
        $srvService = $this->normalizeSubdomainSrvService($source['srv_service'] ?? '', '_minecraft');
        $srvServiceDefault = $this->normalizeSubdomainSrvService($source['srv_service_default'] ?? ($source['srv_service'] ?? ''), '_minecraft');

        $config = [
            'domain' => strtolower(trim((string) ($source['domain'] ?? ''))),
            'zone_id' => trim((string) ($source['zone_id'] ?? '')),
            'dns_ip' => trim((string) ($source['dns_ip'] ?? '')),
            'routing_mode' => $routingMode,
            'srv_enabled' => $this->normalizeSubdomainBool($source['srv_enabled'] ?? null, true),
            'srv_service_mode' => $srvServiceMode,
            'srv_service' => $srvServiceMode === 'per_egg' ? $srvServiceDefault : $srvService,
            'srv_service_default' => $srvServiceDefault,
            'srv_service_by_egg' => $srvServiceMode === 'per_egg' ? $srvServiceByEgg : [],
            'srv_protocol' => ($source['srv_protocol'] ?? '_tcp') === '_udp' ? '_udp' : '_tcp',
            'srv_protocol_by_egg' => $srvServiceMode === 'per_egg' ? $srvProtocolByEgg : [],
            'a_record_enabled' => $this->normalizeSubdomainBool($source['a_record_enabled'] ?? null, false),
        ];

        if ($config['routing_mode'] === 'web') {
            $config['srv_enabled'] = false;
            $config['a_record_enabled'] = true;
        }

        return $config;
    }

    private function normalizeSubdomainSrvServiceMap(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }

        $map = [];
        foreach ($value as $eggId => $service) {
            $cleanEggId = trim((string) $eggId);
            $cleanService = $this->normalizeSubdomainSrvService($service, '');
            if ($cleanEggId !== '' && $cleanService !== '') {
                $map[$cleanEggId] = $cleanService;
            }
        }

        return $map;
    }

    private function normalizeSubdomainSrvProtocolMap(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }

        $map = [];
        foreach ($value as $eggId => $protocol) {
            $cleanEggId = trim((string) $eggId);
            if ($cleanEggId !== '') {
                $map[$cleanEggId] = trim((string) $protocol) === '_udp' ? '_udp' : '_tcp';
            }
        }

        return $map;
    }

    private function normalizeSubdomainSrvService(mixed $value, string $fallback): string
    {
        $service = strtolower(trim((string) $value));
        if ($service === '') {
            return $fallback;
        }

        if (!str_starts_with($service, '_')) {
            $service = '_' . $service;
        }

        return $service;
    }

    private function normalizeSubdomainBool(mixed $value, bool $default): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        return $default;
    }

    private function normalizeReverseProxyManagerSettingsForStorage(array $config): array
    {
        if (!isset($config['addons']['reverse_proxy_manager']['settings']) || !is_array($config['addons']['reverse_proxy_manager']['settings'])) {
            return $config;
        }

        $settings = &$config['addons']['reverse_proxy_manager']['settings'];
        $stringKeys = [
            'certbot_email',
            'public_proxy_ip',
            'nginx_config_path',
            'nginx_enabled_path',
            'cloudflare_api_token',
            'cloudflare_zone_id',
            'ssl_type',
            'access_level',
        ];

        foreach ($stringKeys as $key) {
            if (array_key_exists($key, $settings) && $settings[$key] === null) {
                $settings[$key] = '';
            }
        }

        if (array_key_exists('allowed_eggs', $settings) && $settings['allowed_eggs'] === null) {
            $settings['allowed_eggs'] = [];
        }

        if (array_key_exists('split_eggs', $settings) && $settings['split_eggs'] === null) {
            $settings['split_eggs'] = [];
        }

        if (array_key_exists('cloudflare_proxied', $settings) && $settings['cloudflare_proxied'] === null) {
            $settings['cloudflare_proxied'] = false;
        }

        return $config;
    }

    private function isIndexedArray(array $arr): bool
    {
        if (empty($arr)) {
            return true;
        }
        return array_keys($arr) === range(0, count($arr) - 1);
    }

    private function getInstalledAddons(): array
    {
        $modpackEggOptions = $this->getModpackTargetEggOptions();
        $minecraftVersionEggOptions = $this->getModpackTargetEggOptions(false);

        return [
            [
                'id' => 'minecraft_plugin_installer',
                'name' => 'Minecraft Plugin Installer',
                'description' => 'Allows users to search and install Minecraft plugins from Modrinth, CurseForge, and Hangar directly from the panel.',
                'author' => 'Buzz Development',
                'price' => '$9.99',
                'purchaseUrl' => 'https://builtbybit.com/resources/minecraft-plugin-installer-for-luna.92739',
                'installed' => file_exists(base_path('app/Services/Plugins/PluginSearchService.php')),
                'hasSettings' => true,
                'settings' => [
                    [
                        'id' => 'curseforge_api_key',
                        'type' => 'password',
                        'label' => 'CurseForge API Key',
                        'description' => 'Required to search plugins from CurseForge. Get your API key from <a href="https://console.curseforge.com/" target="_blank">console.curseforge.com</a>',
                        'default' => '',
                    ],
                    [
                        'id' => 'install_folder',
                        'type' => 'text',
                        'label' => 'Installation Folder',
                        'description' => 'The folder where plugins will be installed (relative to server root)',
                        'default' => '/plugins',
                    ],
                    [
                        'id' => 'grid_columns',
                        'type' => 'select',
                        'label' => 'Plugins Per Row',
                        'description' => 'Number of plugins to display per row in the grid',
                        'default' => '3',
                        'options' => [
                            ['value' => '2', 'label' => '2 per row'],
                            ['value' => '3', 'label' => '3 per row'],
                            ['value' => '4', 'label' => '4 per row'],
                        ],
                    ],
                    [
                        'id' => 'platforms',
                        'type' => 'platform_toggles',
                        'label' => 'Available Platforms',
                        'description' => 'Choose which platforms users can search plugins from',
                        'platforms' => [
                            ['id' => 'modrinth', 'label' => 'Modrinth'],
                            ['id' => 'curseforge', 'label' => 'CurseForge'],
                            ['id' => 'hangar', 'label' => 'Hangar'],
                            ['id' => 'spigot', 'label' => 'Spigot'],
                        ],
                    ],
                ],
            ],
            [
                'id' => 'minecraft_mod_installer',
                'name' => 'Mod Installer',
                'description' => 'Allows users to search and install Minecraft mods from Modrinth and CurseForge, and Hytale mods from CurseForge, directly from the panel.',
                'author' => 'Buzz Development',
                'price' => '$9.99',
                'purchaseUrl' => 'https://builtbybit.com/resources/minecraft-mod-installer-for-luna.92848/',
                'installed' => file_exists(base_path('app/Services/Mods/ModSearchService.php')),
                'hasSettings' => true,
                'settings' => [
                    [
                        'id' => 'curseforge_api_key',
                        'type' => 'password',
                        'label' => 'CurseForge API Key',
                        'description' => 'Required for CurseForge Minecraft mods and all Hytale mods. Get your API key from <a href="https://console.curseforge.com/" target="_blank">console.curseforge.com</a>',
                        'default' => '',
                    ],
                    [
                        'id' => 'install_folder',
                        'type' => 'text',
                        'label' => 'Minecraft Installation Folder',
                        'description' => 'The folder where Minecraft mods will be installed (relative to server root)',
                        'default' => '/mods',
                    ],
                    [
                        'id' => 'hytale_install_folder',
                        'type' => 'text',
                        'label' => 'Hytale Installation Folder',
                        'description' => 'The folder where Hytale mods will be installed (relative to server root)',
                        'default' => '/mods',
                    ],
                    [
                        'id' => 'grid_columns',
                        'type' => 'select',
                        'label' => 'Mods Per Row',
                        'description' => 'Number of mods to display per row in the grid',
                        'default' => '3',
                        'options' => [
                            ['value' => '2', 'label' => '2 per row'],
                            ['value' => '3', 'label' => '3 per row'],
                            ['value' => '4', 'label' => '4 per row'],
                        ],
                    ],
                    [
                        'id' => 'platforms',
                        'type' => 'platform_toggles',
                        'label' => 'Minecraft Platforms',
                        'description' => 'Choose which platforms users can search Minecraft mods from. Hytale always uses CurseForge.',
                        'platforms' => [
                            ['id' => 'modrinth', 'label' => 'Modrinth'],
                            ['id' => 'curseforge', 'label' => 'CurseForge'],
                        ],
                    ],
                ],
            ],
            [
                'id' => 'minecraft_modpack_installer',
                'name' => 'Minecraft Modpack Installer',
                'description' => 'Allows users to install Minecraft modpacks from CurseForge and Modrinth directly from the panel.',
                'author' => 'Buzz Development',
                'price' => '$14.99',
                'purchaseUrl' => 'https://builtbybit.com/resources/101471',
                'installed' => file_exists(base_path('app/Services/Modpacks/ModpackSearchService.php')),
                'hasSettings' => true,
                'settings' => [
                    [
                        'id' => 'curseforge_api_key',
                        'type' => 'password',
                        'label' => 'CurseForge API Key',
                        'description' => 'Required to search modpacks from CurseForge. Get your API key from <a href="https://console.curseforge.com/" target="_blank">console.curseforge.com</a>',
                        'default' => '',
                    ],
                    [
                        'id' => 'auto_switch_egg',
                        'type' => 'toggle',
                        'label' => 'Automatically Switch Eggs',
                        'description' => 'Automatically switch a server to the configured mod loader egg before installing a modpack when needed.',
                        'default' => true,
                    ],
                    [
                        'id' => 'forge_egg_id',
                        'type' => 'select',
                        'label' => 'Forge Target Egg',
                        'description' => 'Choose the egg to switch to automatically when a modpack requires Forge.',
                        'default' => '',
                        'options' => $modpackEggOptions,
                    ],
                    [
                        'id' => 'neoforge_egg_id',
                        'type' => 'select',
                        'label' => 'NeoForge Target Egg',
                        'description' => 'Choose the egg to switch to automatically when a modpack requires NeoForge.',
                        'default' => '',
                        'options' => $modpackEggOptions,
                    ],
                    [
                        'id' => 'fabric_egg_id',
                        'type' => 'select',
                        'label' => 'Fabric Target Egg',
                        'description' => 'Choose the egg to switch to automatically when a modpack requires Fabric.',
                        'default' => '',
                        'options' => $modpackEggOptions,
                    ],
                    [
                        'id' => 'quilt_egg_id',
                        'type' => 'select',
                        'label' => 'Quilt Target Egg',
                        'description' => 'Choose the egg to switch to automatically when a modpack requires Quilt.',
                        'default' => '',
                        'options' => $modpackEggOptions,
                    ],
                    [
                        'id' => 'grid_columns',
                        'type' => 'select',
                        'label' => 'Modpacks Per Row',
                        'description' => 'Number of modpacks to display per row in the grid',
                        'default' => '3',
                        'options' => [
                            ['value' => '2', 'label' => '2 per row'],
                            ['value' => '3', 'label' => '3 per row'],
                            ['value' => '4', 'label' => '4 per row'],
                        ],
                    ],
                    [
                        'id' => 'platforms',
                        'type' => 'platform_toggles',
                        'label' => 'Available Platforms',
                        'description' => 'Choose which platforms users can search modpacks from',
                        'platforms' => [
                            ['id' => 'modrinth', 'label' => 'Modrinth'],
                            ['id' => 'curseforge', 'label' => 'CurseForge'],
                        ],
                    ],
                ],
            ],
            [
                'id' => 'egg_changer',
                'name' => 'Egg Changer',
                'description' => 'Allows users with settings permission to change the egg of their server from the settings page.',
                'author' => 'Buzz Development',
                'price' => '$4.99',
                'purchaseUrl' => 'https://builtbybit.com/resources/egg-changer-for-luna.93117/',
                'installed' => file_exists(base_path('app/Services/EggChanger/EggChangerService.php')),
                'hasSettings' => true,
                'settings' => [
                    [
                        'id' => 'available_eggs',
                        'type' => 'egg_selector',
                        'label' => 'Available Eggs',
                        'description' => 'Select which eggs users can switch to. Leave empty to disable egg changing.',
                        'default' => [],
                    ],
                    [
                        'id' => 'always_reinstall',
                        'type' => 'toggle',
                        'label' => 'Always Reinstall Server',
                        'description' => 'When enabled, the server will always be reinstalled when changing eggs. This hides the reinstall option from users.',
                        'default' => false,
                    ],
                    [
                        'id' => 'always_change_startup',
                        'type' => 'toggle',
                        'label' => 'Always Change Startup Command',
                        'description' => 'When enabled, the startup command will always be changed to the new egg\'s default. This hides the option from users.',
                        'default' => false,
                    ],
                    [
                        'id' => 'nest_lock',
                        'type' => 'toggle',
                        'label' => 'Restrict to Same Nest',
                        'description' => 'When enabled, users can only change to eggs within the same nest as their server\'s current egg.',
                        'default' => false,
                    ],
                    [
                        'id' => 'required_permission',
                        'type' => 'text',
                        'label' => 'Required Permission',
                        'description' => 'The permission a subuser needs to change eggs (e.g. settings.rename, startup.update).',
                        'default' => 'settings.rename',
                    ],
                    [
                        'id' => 'egg_config',
                        'type' => 'egg_config',
                        'label' => 'Per-Egg Configuration',
                        'description' => 'Configure egg-to-egg switching restrictions and SRV record settings per egg. Eggs without a configuration default to allowing all available eggs and no SRV record.',
                        'default' => [],
                    ],
                ],
            ],
            [
                'id' => 'minecraft_version_manager',
                'name' => 'Minecraft Version Manager',
                'description' => 'Lets users browse Minecraft forks, versions, and builds, then switch server versions with startup and egg updates directly from the panel.',
                'author' => 'Buzz Development',
                'price' => '$14.99',
                'purchaseUrl' => 'https://builtbybit.com/resources/106386',
                'installed' => class_exists(\Pterodactyl\Services\MinecraftVersions\MinecraftVersionManagerService::class)
                    || file_exists(base_path('app/Services/MinecraftVersions/MinecraftVersionManagerService.php')),
                'hasSettings' => true,
                'settings' => [
                    [
                        'id' => 'auto_switch_egg',
                        'type' => 'toggle',
                        'label' => 'Automatically Switch Eggs',
                        'description' => 'Automatically switch the server to the configured fork egg before applying version changes when needed.',
                        'default' => true,
                    ],
                    [
                        'id' => 'write_eula',
                        'type' => 'toggle',
                        'label' => 'Automatically Accept EULA',
                        'description' => 'Write eula=true when installing or switching Minecraft server versions that require it.',
                        'default' => true,
                    ],
                    [
                        'id' => 'default_cleanup_mode',
                        'type' => 'select',
                        'label' => 'Default Cleanup Mode',
                        'description' => 'Choose the default file cleanup mode shown to users before switching versions.',
                        'default' => 'smart',
                        'options' => [
                            ['value' => 'none', 'label' => 'Do not delete files'],
                            ['value' => 'smart', 'label' => 'Delete common generated server files'],
                            ['value' => 'full', 'label' => 'Delete all server files'],
                        ],
                    ],
                    [
                        'id' => 'platforms',
                        'type' => 'platform_toggles',
                        'label' => 'Available Forks',
                        'description' => 'Choose which Minecraft forks users can browse and switch to',
                        'platforms' => [
                            ['id' => 'vanilla', 'label' => 'Vanilla'],
                            ['id' => 'paper', 'label' => 'Paper'],
                            ['id' => 'purpur', 'label' => 'Purpur'],
                            ['id' => 'spigot', 'label' => 'Spigot'],
                            ['id' => 'folia', 'label' => 'Folia'],
                            ['id' => 'forge', 'label' => 'Forge'],
                            ['id' => 'neoforge', 'label' => 'NeoForge'],
                            ['id' => 'fabric', 'label' => 'Fabric'],
                            ['id' => 'quilt', 'label' => 'Quilt'],
                            ['id' => 'velocity', 'label' => 'Velocity'],
                            ['id' => 'waterfall', 'label' => 'Waterfall'],
                            ['id' => 'bungeecord', 'label' => 'BungeeCord'],
                        ],
                    ],
                    [
                        'id' => 'vanilla_egg_id',
                        'type' => 'select',
                        'label' => 'Vanilla Target Egg',
                        'description' => 'Choose the egg to switch to automatically when users select Vanilla.',
                        'default' => '',
                        'options' => $minecraftVersionEggOptions,
                    ],
                    [
                        'id' => 'paper_egg_id',
                        'type' => 'select',
                        'label' => 'Paper Target Egg',
                        'description' => 'Choose the egg to switch to automatically when users select Paper.',
                        'default' => '',
                        'options' => $minecraftVersionEggOptions,
                    ],
                    [
                        'id' => 'purpur_egg_id',
                        'type' => 'select',
                        'label' => 'Purpur Target Egg',
                        'description' => 'Choose the egg to switch to automatically when users select Purpur.',
                        'default' => '',
                        'options' => $minecraftVersionEggOptions,
                    ],
                    [
                        'id' => 'spigot_egg_id',
                        'type' => 'select',
                        'label' => 'Spigot Target Egg',
                        'description' => 'Choose the egg to switch to automatically when users select Spigot.',
                        'default' => '',
                        'options' => $minecraftVersionEggOptions,
                    ],
                    [
                        'id' => 'folia_egg_id',
                        'type' => 'select',
                        'label' => 'Folia Target Egg',
                        'description' => 'Choose the egg to switch to automatically when users select Folia.',
                        'default' => '',
                        'options' => $minecraftVersionEggOptions,
                    ],
                    [
                        'id' => 'forge_egg_id',
                        'type' => 'select',
                        'label' => 'Forge Target Egg',
                        'description' => 'Choose the egg to switch to automatically when users select Forge.',
                        'default' => '',
                        'options' => $minecraftVersionEggOptions,
                    ],
                    [
                        'id' => 'neoforge_egg_id',
                        'type' => 'select',
                        'label' => 'NeoForge Target Egg',
                        'description' => 'Choose the egg to switch to automatically when users select NeoForge.',
                        'default' => '',
                        'options' => $minecraftVersionEggOptions,
                    ],
                    [
                        'id' => 'fabric_egg_id',
                        'type' => 'select',
                        'label' => 'Fabric Target Egg',
                        'description' => 'Choose the egg to switch to automatically when users select Fabric.',
                        'default' => '',
                        'options' => $minecraftVersionEggOptions,
                    ],
                    [
                        'id' => 'quilt_egg_id',
                        'type' => 'select',
                        'label' => 'Quilt Target Egg',
                        'description' => 'Choose the egg to switch to automatically when users select Quilt.',
                        'default' => '',
                        'options' => $minecraftVersionEggOptions,
                    ],
                    [
                        'id' => 'velocity_egg_id',
                        'type' => 'select',
                        'label' => 'Velocity Target Egg',
                        'description' => 'Choose the egg to switch to automatically when users select Velocity.',
                        'default' => '',
                        'options' => $minecraftVersionEggOptions,
                    ],
                    [
                        'id' => 'waterfall_egg_id',
                        'type' => 'select',
                        'label' => 'Waterfall Target Egg',
                        'description' => 'Choose the egg to switch to automatically when users select Waterfall.',
                        'default' => '',
                        'options' => $minecraftVersionEggOptions,
                    ],
                    [
                        'id' => 'bungeecord_egg_id',
                        'type' => 'select',
                        'label' => 'BungeeCord Target Egg',
                        'description' => 'Choose the egg to switch to automatically when users select BungeeCord.',
                        'default' => '',
                        'options' => $minecraftVersionEggOptions,
                    ],
                ],
            ],
            [
                'id' => 'subdomains_manager',
                'name' => 'Subdomains Manager',
                'description' => 'Allows users to create custom subdomains for their servers with CloudFlare integration.',
                'author' => 'Buzz Development',
                'price' => '$9.99',
                'purchaseUrl' => 'https://builtbybit.com/resources/subdomain-manager-for-luna.95864/',
                'installed' => class_exists(\Pterodactyl\Services\Subdomains\SubdomainService::class),
                'hasSettings' => true,
                'settings' => [
                    [
                        'id' => 'domains',
                        'type' => 'domain_config',
                        'label' => 'Domain Configuration',
                        'description' => 'Configure domains with their CloudFlare zone IDs and choose whether each domain uses game-style SRV/A routing or website-style reverse proxy routing.',
                        'default' => [],
                    ],
                    [
                        'id' => 'cloudflare_api_token',
                        'type' => 'password',
                        'label' => 'CloudFlare API Token',
                        'description' => 'API token with DNS edit permissions for all zones. Create one at <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank">CloudFlare Dashboard</a>',
                        'default' => '',
                    ],
                    [
                        'id' => 'allowed_eggs',
                        'type' => 'egg_selector',
                        'label' => 'Allowed Eggs',
                        'description' => 'Select which eggs are allowed to use subdomains. Leave empty to allow all eggs.',
                        'default' => [],
                    ],
                    [
                        'id' => 'blacklisted_subdomains',
                        'type' => 'textarea',
                        'label' => 'Blacklisted Subdomains',
                        'description' => 'One subdomain per line. These exact names will be blocked from being created (e.g. admin, mail, www, ftp).',
                        'default' => '',
                    ],
                    [
                        'id' => 'blacklist_regex',
                        'type' => 'text',
                        'label' => 'Blacklist Regex Pattern',
                        'description' => 'Optional regex pattern to block subdomains. Do not include delimiters (e.g. <code>^(admin|mail|ns\\d+)$</code>).',
                        'default' => '',
                        'placeholder' => '^(admin|mail|ns\\d+)$',
                    ],
                ],
            ],
            [
                'id' => 'server_icon_changer',
                'name' => 'Server Icon Changer',
                'description' => 'Adds a button in the file manager to upload and set a Minecraft server icon. Automatically resizes and converts images to the correct 64x64 PNG format.',
                'author' => 'Buzz Development',
                'price' => '$4.99',
                'purchaseUrl' => 'https://builtbybit.com/resources/97989',
                'installed' => file_exists(base_path('app/Services/ServerIcon/ServerIconService.php')),
                'hasSettings' => true,
                'settings' => [
                    [
                        'id' => 'output_filename',
                        'type' => 'text',
                        'label' => 'Output Filename',
                        'description' => 'The filename for the server icon. Default is server-icon.png which is the standard for Minecraft servers.',
                        'default' => 'server-icon.png',
                    ],
                    [
                        'id' => 'icon_size',
                        'type' => 'select',
                        'label' => 'Icon Size',
                        'description' => 'The dimensions to resize the icon to. 64x64 is the Minecraft standard.',
                        'default' => '64',
                        'options' => [
                            ['value' => '32', 'label' => '32x32'],
                            ['value' => '64', 'label' => '64x64 (Minecraft Standard)'],
                            ['value' => '128', 'label' => '128x128'],
                        ],
                    ],
                    [
                        'id' => 'allowed_eggs',
                        'type' => 'egg_selector',
                        'label' => 'Allowed Eggs',
                        'description' => 'Select which eggs can use the server icon changer. Leave empty to allow all eggs.',
                        'default' => [],
                    ],
                ],
            ],
            [
                'id' => 'server_properties_editor',
                'name' => 'Server Properties Editor',
                'description' => 'Allows users to edit Minecraft server.properties files through a user-friendly form interface with two-column layout and tooltips.',
                'author' => 'Buzz Development',
                'price' => '$4.99',
                'purchaseUrl' => 'https://builtbybit.com/resources/server-properties-manager-for-luna.95398/',
                'installed' => file_exists(base_path('app/Services/ServerProperties/ServerPropertiesService.php')),
                'hasSettings' => true,
                'settings' => [
                    [
                        'id' => 'access_mode',
                        'type' => 'select',
                        'label' => 'Access Mode',
                        'description' => 'Choose how users can access the server properties editor',
                        'default' => 'both',
                        'options' => [
                            ['value' => 'file', 'label' => 'File Click Only'],
                            ['value' => 'sidebar', 'label' => 'Sidebar Link Only'],
                            ['value' => 'both', 'label' => 'Both File Click and Sidebar'],
                        ],
                    ],
                    [
                        'id' => 'allowed_eggs',
                        'type' => 'egg_selector',
                        'label' => 'Allowed Eggs',
                        'description' => 'Select which eggs are allowed to use the server properties editor. Leave empty to allow all eggs.',
                        'default' => [],
                    ],
                ],
            ],
            [
                'id' => 'environment_variable_manager',
                'name' => 'Environment Variable Manager',
                'description' => 'Manage .env files through a dedicated UI with visibility toggles, copy actions, import, export, and per-environment filtering.',
                'author' => 'Buzz Development',
                'price' => '$6.99',
                'purchaseUrl' => 'https://builtbybit.com/resources/98500',
                'installed' => file_exists(base_path('app/Services/EnvironmentVariables/EnvironmentVariableService.php')),
                'hasSettings' => true,
                'settings' => [
                    [
                        'id' => 'access_mode',
                        'type' => 'select',
                        'label' => 'Access Mode',
                        'description' => 'Choose how users can access the environment variables page',
                        'default' => 'both',
                        'options' => [
                            ['value' => 'file', 'label' => 'File Click Only'],
                            ['value' => 'sidebar', 'label' => 'Sidebar Link Only'],
                            ['value' => 'both', 'label' => 'Both File Click and Sidebar'],
                        ],
                    ],
                    [
                        'id' => 'allowed_eggs',
                        'type' => 'egg_selector',
                        'label' => 'Allowed Eggs',
                        'description' => 'Select which eggs are allowed to use the Environment Variable Manager. Leave empty to allow all eggs.',
                        'default' => [],
                    ],
                ],
            ],
            [
                'id' => 'free_servers',
                'name' => 'FreeServers',
                'description' => 'Automatically offer free servers to users on registration with configurable specs, expiry, and targeting.',
                'author' => 'Buzz Development',
                'price' => '$9.99',
                'purchaseUrl' => 'https://builtbybit.com/resources/101653',
                'installed' => file_exists(base_path('app/Services/FreeServers/FreeServerService.php')),
                'hasSettings' => true,
                'settings' => [
                    [
                        'id' => 'offers',
                        'type' => 'offer_config',
                        'label' => 'FreeServers',
                        'description' => 'Create and manage free server offers that are automatically assigned to new users on registration.',
                    ],
                    [
                        'id' => 'require_email_verified',
                        'type' => 'toggle',
                        'label' => 'Require Email Verification',
                        'description' => 'Users must verify their email address before they can claim offers. A verification email is sent on registration.',
                        'default' => false,
                    ],
                    [
                        'id' => 'require_2fa',
                        'type' => 'toggle',
                        'label' => 'Require Two-Factor Authentication',
                        'description' => 'Users must have 2FA enabled on their account before they can claim offers.',
                        'default' => false,
                    ],
                    [
                        'id' => 'auto_expire_unclaimed',
                        'type' => 'toggle',
                        'label' => 'Auto-Expire Unclaimed Offers',
                        'description' => 'Automatically expire unclaimed offers past their claim deadline. Runs hourly via scheduled task.',
                        'default' => true,
                    ],
                    [
                        'id' => 'auto_delete_expired_servers',
                        'type' => 'toggle',
                        'label' => 'Auto-Suspend Expired Servers',
                        'description' => 'Automatically suspend servers that have exceeded their expiry period and notify the user via email. Runs hourly via scheduled task.',
                        'default' => true,
                    ],
                    [
                        'id' => 'claims_list',
                        'type' => 'claims_list',
                        'label' => 'Issued Claims',
                        'description' => 'All issued offers with their current status, assigned users, and expiry countdowns.',
                    ],
                ],
            ],
            [
                'id' => 'reverse_proxy_manager',
                'name' => 'Reverse Proxy Manager',
                'description' => 'Allow users to attach their own domains to server allocations after pointing DNS to your reverse proxy server.',
                'author' => 'Buzz Development',
                'price' => '$19.99',
                'purchaseUrl' => 'https://builtbybit.com/resources/99989',
                'installed' => file_exists(base_path('app/Services/ReverseProxy/ReverseProxyService.php')),
                'hasSettings' => true,
                'settings' => [
                    [
                        'id' => 'ssl_type',
                        'type' => 'select',
                        'label' => 'SSL Certificate Type',
                        'description' => 'Choose how SSL certificates are handled',
                        'default' => 'certbot',
                        'options' => [
                            ['value' => 'none', 'label' => 'No SSL (HTTP only)'],
                            ['value' => 'certbot', 'label' => 'Let\'s Encrypt (Certbot)'],
                        ],
                    ],
                    [
                        'id' => 'access_level',
                        'type' => 'select',
                        'label' => 'Access Level',
                        'description' => 'Who can create reverse proxies',
                        'default' => 'server_owners',
                        'options' => [
                            ['value' => 'server_owners', 'label' => 'Server Owners Only'],
                            ['value' => 'admins_only', 'label' => 'Administrators Only'],
                        ],
                    ],
                    [
                        'id' => 'allowed_eggs',
                        'type' => 'egg_selector',
                        'label' => 'Allowed Eggs',
                        'description' => 'Select which eggs can use reverse proxies. Leave empty to allow all.',
                        'default' => [],
                    ],
                    [
                        'id' => 'certbot_email',
                        'type' => 'text',
                        'label' => 'Certbot Email',
                        'description' => 'Email address for Let\'s Encrypt certificate notifications (required if using Certbot)',
                        'default' => '',
                    ],
                    [
                        'id' => 'use_node_ip',
                        'type' => 'toggle',
                        'label' => 'Use Node IP For Reverse Proxy',
                        'description' => 'When enabled, new reverse proxies will use the IP of the node the server is on (resolved from the node FQDN). When disabled, the Public Proxy IP setting or the allocation IP is used.',
                        'default' => false,
                    ],
                    [
                        'id' => 'public_proxy_ip',
                        'type' => 'text',
                        'label' => 'Public Proxy IP',
                        'description' => 'Optional public IPv4 address that all reverse proxy hostnames should point to. Set this if your reverse proxy server sits in front of allocations on a different IP. Ignored when Use Node IP is enabled.',
                        'default' => '',
                        'placeholder' => '203.0.113.10',
                    ],
                    [
                        'id' => 'nginx_config_path',
                        'type' => 'text',
                        'label' => 'Nginx Config Directory',
                        'description' => 'Directory where Nginx site configs are stored',
                        'default' => '/etc/nginx/sites-available',
                        'placeholder' => '/etc/nginx/sites-available',
                    ],
                    [
                        'id' => 'nginx_enabled_path',
                        'type' => 'text',
                        'label' => 'Nginx Enabled Directory',
                        'description' => 'Directory for enabled Nginx sites (symlinks)',
                        'default' => '/etc/nginx/sites-enabled',
                        'placeholder' => '/etc/nginx/sites-enabled',
                    ],
                ],
            ],
            [
                'id' => 'server_importer',
                'name' => 'Server Importer',
                'description' => 'Lets users import their server files from another host over SFTP or FTP with folder selection.',
                'author' => 'Buzz Development',
                'price' => '$12.99',
                'purchaseUrl' => 'https://builtbybit.com/resources/111725',
                'installed' => file_exists(base_path('app/Services/ServerImport/ServerImportService.php')),
                'hasSettings' => true,
                'settings' => [
                    [
                        'id' => 'max_file_size_mb',
                        'type' => 'number',
                        'label' => 'Maximum File Size (MB)',
                        'description' => 'Files larger than this are skipped during import. Each file is buffered in memory, so keep this comfortably below your panel PHP memory limit.',
                        'default' => 256,
                    ],
                    [
                        'id' => 'connection_timeout',
                        'type' => 'number',
                        'label' => 'Connection Timeout (seconds)',
                        'description' => 'How long to wait when connecting to the source SFTP/FTP host before giving up.',
                        'default' => 30,
                    ],
                    [
                        'id' => 'allowed_eggs',
                        'type' => 'egg_selector',
                        'label' => 'Allowed Eggs',
                        'description' => 'Select which eggs are allowed to use the Server Importer. Leave empty to allow all eggs.',
                        'default' => [],
                    ],
                    [
                        'id' => 'force_cancel_all',
                        'type' => 'action',
                        'label' => 'Force Cancel All Transfers',
                        'description' => 'Immediately stop and clear every active SFTP/FTP import across all servers. Use this if transfers are stuck and locking servers from starting.',
                        'button_label' => 'Force Cancel All',
                        'button_style' => 'danger',
                        'button_icon' => 'ban',
                        'confirm' => 'This will immediately stop and clear all active imports on every server. Continue?',
                        'action' => 'force_cancel_server_imports',
                    ],
                ],
            ],
            [
                'id' => 'server_splitter',
                'name' => 'Server Splitter',
                'description' => 'Allows parent servers to create managed split servers by moving RAM, CPU, disk and other limits from the parent onto the new server.',
                'author' => 'Buzz Development',
                'price' => '$19.99',
                'purchaseUrl' => 'https://builtbybit.com/resources/114533/',
                'installed' => file_exists(base_path('app/Services/ServerSplitter/ServerSplitterService.php')),
                'hasSettings' => true,
                'settings' => [
                    [
                        'id' => 'max_splits',
                        'type' => 'number',
                        'label' => 'Maximum Splits',
                        'description' => 'Maximum number of split servers that a single parent server may create. Use 0 for no fixed count limit.',
                        'default' => 5,
                    ],
                    [
                        'id' => 'max_memory',
                        'type' => 'number',
                        'label' => 'Maximum RAM (MB)',
                        'description' => 'Maximum RAM a single split can take from its parent. Use 0 to only enforce the parent server limits.',
                        'default' => 4096,
                    ],
                    [
                        'id' => 'max_cpu',
                        'type' => 'number',
                        'label' => 'Maximum CPU (%)',
                        'description' => 'Maximum CPU a single split can take from its parent. Use 0 to only enforce the parent server limits.',
                        'default' => 100,
                    ],
                    [
                        'id' => 'max_disk',
                        'type' => 'number',
                        'label' => 'Maximum Disk (MB)',
                        'description' => 'Maximum disk a single split can take from its parent. Use 0 to only enforce the parent server limits.',
                        'default' => 10240,
                    ],
                    [
                        'id' => 'max_backups',
                        'type' => 'number',
                        'label' => 'Maximum Backups',
                        'description' => 'Maximum backup limit assigned to each split server.',
                        'default' => 0,
                    ],
                    [
                        'id' => 'max_databases',
                        'type' => 'number',
                        'label' => 'Maximum Databases',
                        'description' => 'Maximum database limit assigned to each split server.',
                        'default' => 0,
                    ],
                    [
                        'id' => 'max_allocations',
                        'type' => 'number',
                        'label' => 'Maximum Allocations',
                        'description' => 'Maximum number of port allocations taken for each split server.',
                        'default' => 1,
                    ],
                    [
                        'id' => 'min_parent_memory',
                        'type' => 'number',
                        'label' => 'Minimum Parent RAM (MB)',
                        'description' => 'Smallest amount of RAM a server must keep after splitting.',
                        'default' => 1024,
                    ],
                    [
                        'id' => 'min_parent_cpu',
                        'type' => 'number',
                        'label' => 'Minimum Parent CPU (%)',
                        'description' => 'Smallest amount of CPU a server must keep after splitting.',
                        'default' => 25,
                    ],
                    [
                        'id' => 'min_parent_disk',
                        'type' => 'number',
                        'label' => 'Minimum Parent Disk (MB)',
                        'description' => 'Smallest amount of disk a server must keep after splitting.',
                        'default' => 1024,
                    ],
                    [
                        'id' => 'split_eggs',
                        'type' => 'egg_selector',
                        'label' => 'Allowed eggs to split into',
                        'description' => 'Select which eggs users can choose when creating a split. Leave empty to only allow the parent server egg.',
                        'default' => [],
                    ],
                    [
                        'id' => 'allowed_nests',
                        'type' => 'textarea',
                        'label' => 'Allowed Nest IDs',
                        'description' => 'Optional comma or line separated nest IDs allowed for split servers. Leave empty to allow all nests.',
                        'default' => '',
                    ],
                    [
                        'id' => 'users_may_delete',
                        'type' => 'toggle',
                        'label' => 'Allow User Deletion',
                        'description' => 'Allow parent server owners to delete their split servers.',
                        'default' => true,
                    ],
                    [
                        'id' => 'users_may_recreate',
                        'type' => 'toggle',
                        'label' => 'Allow User Recreate',
                        'description' => 'Allow split server owners to reinstall their split servers from the client panel.',
                        'default' => true,
                    ],
                ],
            ],
        ];
    }

    private function getModpackTargetEggOptions(bool $restrictToEggChangerAvailable = true): array
    {
        $query = Egg::with('nest')->orderBy('name');
        if ($restrictToEggChangerAvailable) {
            $availableEggIds = ThemeSettings::getValue('addons.egg_changer.settings.available_eggs', []);
            if (is_array($availableEggIds) && !empty($availableEggIds)) {
                $query->whereIn('id', $availableEggIds);
            }
        }

        $options = [[
            'value' => '',
            'label' => 'Do not switch automatically',
        ]];

        foreach ($query->get() as $egg) {
            $options[] = [
                'value' => (string) $egg->id,
                'label' => sprintf('%s (%s)', $egg->name, $egg->nest?->name ?? 'Unknown'),
            ];
        }

        return $options;
    }
}
