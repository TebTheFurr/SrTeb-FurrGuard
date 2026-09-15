<?php

declare(strict_types=1);

// Arranque de PHPUnit: sin .env del proyecto, con APP_URL de prueba y storage temporal.

define('FURRGUARD_SKIP_DOTENV', true);
define('FURRGUARD_STORAGE', sys_get_temp_dir() . '/furrguard-tests-' . getmypid());

$testEnv = [
    'APP_ENV' => 'production',
    'APP_URL' => 'https://furrguard.test',
    'FOUNDER_DISCORD_ID' => '111111111111111111',
    'GEO_PROVIDERS' => 'ip-api',
    'DISCORD_CLIENT_ID' => '123456789012345678',
    'DISCORD_CLIENT_SECRET' => 'test-secret',
    // Puente de Pterodactyl (docs/API.md §9)
    'PTERODACTYL_URL' => 'https://panel.test',
    'PTERODACTYL_PANEL_KEY' => str_repeat('ab', 32),
];
foreach ($testEnv as $key => $value) {
    putenv("{$key}={$value}");
    $_ENV[$key] = $value;
}

// Los error_log esperados (Mojang 429, etc.) van a un archivo temporal en vez de ensuciar la salida.
@mkdir(FURRGUARD_STORAGE, 0700, true);
ini_set('error_log', FURRGUARD_STORAGE . '/php-errors.log');

require_once dirname(__DIR__, 2) . '/vendor/autoload.php';
require_once dirname(__DIR__, 2) . '/includes/bootstrap.php';
require_once dirname(__DIR__, 2) . '/database/lib.php';
// Dominio y API del panel (router.php carga plugin_api.php → detection, bans, players, furrperms, furrsecurity).
require_once dirname(__DIR__, 2) . '/admin/api/router.php';
require_once dirname(__DIR__, 2) . '/includes/panel_bridge.php';
require_once dirname(__DIR__, 2) . '/includes/spa.php';
require_once __DIR__ . '/Integration/DatabaseTestCase.php';
require_once __DIR__ . '/Integration/DomainTestCase.php';

register_shutdown_function(static function (): void {
    $dir = FURRGUARD_STORAGE;
    if (!is_dir($dir)) {
        return;
    }
    $items = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($items as $item) {
        $item->isDir() ? @rmdir($item->getPathname()) : @unlink($item->getPathname());
    }
    @rmdir($dir);
});
