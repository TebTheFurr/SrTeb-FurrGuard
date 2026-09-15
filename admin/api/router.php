<?php

declare(strict_types=1);

/**
 * FurrGuard - API del panel (docs/API.md §4.2–§4.4): CSRF, sesión, límites y mapa acción → sección.
 *
 * Toda acción declara su sección (null = cualquier usuario con sesión); lo que no está en el mapa es
 * 404 (falla en cerrado). Los handlers reciben (PDO, entrada JSON, usuario) y devuelven `data` o
 * lanzan HttpError.
 */

if (!defined('FURRGUARD_ROOT')) {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/overview.php';
require_once __DIR__ . '/players.php';
require_once __DIR__ . '/lists.php';
require_once __DIR__ . '/filters.php';
require_once __DIR__ . '/system.php';
require_once __DIR__ . '/migrations.php';
require_once __DIR__ . '/modules.php';

const ADMIN_USER_RATE_LIMIT = 300;
const ADMIN_IP_RATE_LIMIT = 60;

/**
 * 429 con Retry-After: se lanza en la comprobación y se responde en adminApiRun().
 */
final class RateLimitedError extends HttpError
{
    public function __construct(public readonly int $retryAfter)
    {
        parent::__construct(429, 'rate_limited', 'Demasiadas solicitudes.');
    }
}

/**
 * @return array<string, array{section: ?string, handler: callable(PDO, array<string, mixed>, AdminUser): mixed}>
 */
function adminApiActions(): array
{
    return [
        'logout' => ['section' => null, 'handler' => adminLogout(...)],
        'get_overview' => ['section' => 'overview', 'handler' => adminGetOverview(...)],
        'get_players' => ['section' => 'players', 'handler' => adminGetPlayers(...)],
        'get_player_detail' => ['section' => 'players', 'handler' => adminGetPlayerDetail(...)],
        'lookup_player' => ['section' => 'players', 'handler' => adminLookupPlayer(...)],
        'get_name_history' => ['section' => 'players', 'handler' => adminGetNameHistory(...)],
        'get_connections' => ['section' => 'connections', 'handler' => adminGetConnections(...)],
        'get_connection_detail' => ['section' => 'connections', 'handler' => adminGetConnectionDetail(...)],
        'get_ips' => ['section' => 'ips', 'handler' => adminGetIps(...)],
        'get_ip_detail' => ['section' => 'ips', 'handler' => adminGetIpDetail(...)],
        'get_whitelist' => ['section' => 'whitelist', 'handler' => adminGetWhitelist(...)],
        'add_whitelist' => ['section' => 'whitelist', 'handler' => adminAddWhitelist(...)],
        'edit_whitelist' => ['section' => 'whitelist', 'handler' => adminEditWhitelist(...)],
        'remove_whitelist' => ['section' => 'whitelist', 'handler' => adminRemoveWhitelist(...)],
        'get_blacklist' => ['section' => 'blacklist', 'handler' => adminGetBlacklist(...)],
        'add_blacklist' => ['section' => 'blacklist', 'handler' => adminAddBlacklist(...)],
        'add_blacklist_unified' => ['section' => 'blacklist', 'handler' => adminAddBlacklistUnified(...)],
        'edit_blacklist' => ['section' => 'blacklist', 'handler' => adminEditBlacklist(...)],
        'set_blacklist_active' => ['section' => 'blacklist', 'handler' => adminSetBlacklistActive(...)],
        'remove_blacklist' => ['section' => 'blacklist', 'handler' => adminRemoveBlacklist(...)],
        'add_blacklist_ip' => ['section' => 'blacklist', 'handler' => adminAddBlacklistIp(...)],
        'get_sanctions' => ['section' => 'sanctions', 'handler' => adminGetSanctions(...)],
        'get_providers' => ['section' => 'providers', 'handler' => adminGetProviders(...)],
        'add_provider' => ['section' => 'providers', 'handler' => adminAddProvider(...)],
        'toggle_provider' => ['section' => 'providers', 'handler' => adminToggleProvider(...)],
        'delete_provider' => ['section' => 'providers', 'handler' => adminDeleteProvider(...)],
        'get_countries' => ['section' => 'countries', 'handler' => adminGetCountries(...)],
        'add_country' => ['section' => 'countries', 'handler' => adminAddCountry(...)],
        'edit_country' => ['section' => 'countries', 'handler' => adminEditCountry(...)],
        'toggle_country' => ['section' => 'countries', 'handler' => adminToggleCountry(...)],
        'delete_country' => ['section' => 'countries', 'handler' => adminDeleteCountry(...)],
        'get_continents' => ['section' => 'continents', 'handler' => adminGetContinents(...)],
        'add_continent' => ['section' => 'continents', 'handler' => adminAddContinent(...)],
        'edit_continent' => ['section' => 'continents', 'handler' => adminEditContinent(...)],
        'toggle_continent' => ['section' => 'continents', 'handler' => adminToggleContinent(...)],
        'delete_continent' => ['section' => 'continents', 'handler' => adminDeleteContinent(...)],
        'get_messages' => ['section' => 'messages', 'handler' => adminGetMessages(...)],
        'save_messages' => ['section' => 'messages', 'handler' => adminSaveMessages(...)],
        'get_logs' => ['section' => 'logs', 'handler' => adminGetLogs(...)],
        'get_settings' => ['section' => 'settings', 'handler' => adminGetSettings(...)],
        'save_settings' => ['section' => 'settings', 'handler' => adminSaveSettings(...)],
        'regenerate_api_key' => ['section' => 'settings', 'handler' => adminRegenerateApiKey(...)],
        'export_data' => ['section' => 'settings', 'handler' => adminExportData(...)],
        'migrate_blacklist' => ['section' => 'settings', 'handler' => adminMigrateBlacklist(...)],
        'migrate_players' => ['section' => 'settings', 'handler' => adminMigratePlayers(...)],
        'get_admin_users' => ['section' => 'users', 'handler' => adminGetAdminUsers(...)],
        'add_admin_user' => ['section' => 'users', 'handler' => adminAddAdminUser(...)],
        'remove_admin_user' => ['section' => 'users', 'handler' => adminRemoveAdminUser(...)],
        'get_furr_perms_whitelist' => ['section' => 'furrperms', 'handler' => adminGetFurrPermsWhitelist(...)],
        'add_furr_perms_whitelist' => ['section' => 'furrperms', 'handler' => adminAddFurrPermsWhitelist(...)],
        'remove_furr_perms_whitelist' => ['section' => 'furrperms', 'handler' => adminRemoveFurrPermsWhitelist(...)],
        'get_furr_perms_logs' => ['section' => 'furrperms', 'handler' => adminGetFurrPermsLogs(...)],
        'clear_furr_perms_logs' => ['section' => 'furrperms', 'handler' => adminClearFurrPermsLogs(...)],
        'furrsecurity_get_staff' => ['section' => 'furrsecurity', 'handler' => adminFurrSecurityGetStaff(...)],
        'furrsecurity_add_staff' => ['section' => 'furrsecurity', 'handler' => adminFurrSecurityAddStaff(...)],
        'furrsecurity_remove_staff' => ['section' => 'furrsecurity', 'handler' => adminFurrSecurityRemoveStaff(...)],
        'furrsecurity_get_sessions' => ['section' => 'furrsecurity', 'handler' => adminFurrSecurityGetSessions(...)],
        'furrsecurity_get_logs' => ['section' => 'furrsecurity', 'handler' => adminFurrSecurityGetLogs(...)],
        'furrsecurity_revoke_session' => ['section' => 'furrsecurity', 'handler' => adminFurrSecurityRevokeSession(...)],
        'furrsecurity_get_stats' => ['section' => 'furrsecurity', 'handler' => adminFurrSecurityGetStats(...)],
    ];
}

/**
 * POST + JSON + X-CSRF-Token + Origin/Sec-Fetch-Site coherentes (§4.2), o 403 `csrf`. Los intentos
 * fallidos cuentan en el cubo por IP de las peticiones sin autenticar.
 */
function adminApiCheckRequest(): void
{
    $expected = $_SESSION['csrf_token'] ?? null;
    if (!isValidAdminApiRequest($_SERVER, is_string($expected) ? $expected : null, appOrigin())) {
        adminApiThrottle('panel_ip:' . getClientIp(), ADMIN_IP_RATE_LIMIT);
        throw new HttpError(403, 'csrf', 'Token CSRF inválido o petición no permitida. Recarga la página.');
    }
}

/**
 * Usuario de la sesión del panel o 401 (con el motivo como código). Aplica los límites por usuario
 * (300/min) y por IP sin autenticar (60/min).
 *
 * @return AdminUser
 */
function adminApiAuthenticate(PDO $db): array
{
    $validation = adminSessionValidate($db);
    $user = $validation['user'];
    if ($user === null) {
        adminApiThrottle('panel_ip:' . getClientIp(), ADMIN_IP_RATE_LIMIT);
        throw new HttpError(401, $validation['error'] ?? 'unauthorized', 'Tu sesión ha caducado. Vuelve a iniciar sesión.');
    }
    adminApiThrottle('panel_user:' . $user['discord_id'], ADMIN_USER_RATE_LIMIT);
    return $user;
}

function adminApiThrottle(string $bucket, int $limit): void
{
    $result = rateLimitCheck($bucket, $limit, 60);
    if (!$result['allowed']) {
        throw new RateLimitedError($result['retry_after']);
    }
}

/**
 * @param AdminUser $user
 * @param array<string, mixed> $input
 */
function adminApiDispatch(PDO $db, array $user, array $input): mixed
{
    $action = $input['action'] ?? null;
    $route = is_string($action) ? (adminApiActions()[$action] ?? null) : null;
    if ($route === null) {
        throw new HttpError(404, 'unknown_action', 'Acción desconocida.');
    }
    if ($route['section'] !== null && !hasPermission($user['role'], $route['section'])) {
        throw new HttpError(403, 'forbidden', 'No tienes permiso para esta sección.');
    }
    return ($route['handler'])($db, $input, $user);
}

function adminApiRun(): never
{
    try {
        adminApiCheckRequest();
        $db = db() ?? throw new HttpError(503, 'database_unavailable', 'Base de datos no disponible.');
        $user = adminApiAuthenticate($db);
        respondPanelOk(adminApiDispatch($db, $user, readJsonBody()));
    } catch (RateLimitedError $e) {
        respondTooManyRequests($e->retryAfter, 'panel');
    } catch (HttpError $e) {
        respondHttpError($e, 'panel');
    } catch (PDOException $e) {
        error_log('FurrGuard API del panel: ' . $e->getMessage());
        if (isDatabaseUnavailableError($e)) {
            respondPanelError(503, 'Base de datos no disponible. Inténtalo de nuevo en unos segundos.', 'database_unavailable');
        }
        respondPanelError(500, 'Error interno del servidor.', 'internal_error');
    } catch (Throwable $e) {
        error_log('FurrGuard API del panel: ' . $e);
        respondPanelError(500, 'Error interno del servidor.', 'internal_error');
    }
}
