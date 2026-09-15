<?php

declare(strict_types=1);

/**
 * FurrGuard - arranque común (APIs de plugin, CLI y web). No inicia sesión ni envía cabeceras:
 * la web usa `config.php`, que carga este archivo y añade sesión y cabeceras.
 *
 * Constantes que se pueden definir ANTES de cargarlo (tests):
 *   FURRGUARD_SKIP_DOTENV  true para no leer `.env`
 *   FURRGUARD_STORAGE      carpeta de datos en tiempo de ejecución (por defecto `storage/`)
 *
 * @author GrinchHorizon
 * @copyright Tebby Services S.L.
 */

define('FURRGUARD_ROOT', dirname(__DIR__));
define('FURRGUARD_VERSION', '2.0.0');

require_once FURRGUARD_ROOT . '/config/env.php';

if (!defined('FURRGUARD_SKIP_DOTENV') || FURRGUARD_SKIP_DOTENV !== true) {
    loadEnv(FURRGUARD_ROOT . '/.env');
}
if (!defined('FURRGUARD_STORAGE')) {
    define('FURRGUARD_STORAGE', FURRGUARD_ROOT . '/storage');
}

define('APP_ENV', env('APP_ENV', 'production') === 'development' ? 'development' : 'production');
define('APP_URL', rtrim(env('APP_URL'), '/'));
define('DISCORD_CLIENT_ID', env('DISCORD_CLIENT_ID'));
define('DISCORD_CLIENT_SECRET', env('DISCORD_CLIENT_SECRET'));
define('DISCORD_REDIRECT_URI', env('DISCORD_REDIRECT_URI'));
define('FOUNDER_DISCORD_ID', env('FOUNDER_DISCORD_ID'));

// B1: PHP y MySQL en UTC. Los clientes convierten a Europe/Madrid al mostrar.
date_default_timezone_set('UTC');

error_reporting(E_ALL);
ini_set('display_errors', APP_ENV === 'development' ? '1' : '0');
ini_set('log_errors', '1');

// Dependencias de Composer (lector MaxMind). Opcionales: sin ellas el espejo GeoIP se desactiva.
if (is_file(FURRGUARD_ROOT . '/vendor/autoload.php')) {
    require_once FURRGUARD_ROOT . '/vendor/autoload.php';
}

require_once FURRGUARD_ROOT . '/config/database.php';
require_once __DIR__ . '/identity.php';
require_once __DIR__ . '/http.php';
require_once __DIR__ . '/ratelimit.php';
require_once __DIR__ . '/security.php';
require_once __DIR__ . '/audit.php';
require_once __DIR__ . '/settings.php';
require_once __DIR__ . '/apikey.php';
require_once __DIR__ . '/geo.php';
require_once __DIR__ . '/minecraft.php';
require_once __DIR__ . '/admin_session.php';

/**
 * Ruta dentro de la carpeta de datos (`storage/`).
 */
function storagePath(string $relative = ''): string
{
    return $relative === '' ? FURRGUARD_STORAGE : FURRGUARD_STORAGE . '/' . ltrim($relative, '/');
}
