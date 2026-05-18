<?php
/**
 * FurrGuard - Main Configuration
 *
 * @author GrinchHorizon
 * @copyright SrTeb Limited
 * @website https://srteb.eu
 */

require_once __DIR__ . '/config/env.php';

define('FURRGUARD_VERSION', '1.5.0');
define('DISCORD_CLIENT_ID', getenv('DISCORD_CLIENT_ID') ?: '');
define('DISCORD_CLIENT_SECRET', getenv('DISCORD_CLIENT_SECRET') ?: '');
define('DISCORD_REDIRECT_URI', getenv('DISCORD_REDIRECT_URI') ?: '');
define('FOUNDER_DISCORD_ID', getenv('FOUNDER_DISCORD_ID') ?: '');

define('ROLE_PERMISSIONS', [
    'founder' => ['overview','players','connections','ips','whitelist','blacklist','sanctions','providers','countries','continents','messages','logs','settings','users','modules','furrperms','furrsecurity'],
    'owner'   => ['overview','players','connections','ips','whitelist','blacklist','sanctions','countries','continents','messages','logs','modules','furrperms','furrsecurity'],
    'manager' => ['overview','players','connections','ips','whitelist','blacklist','sanctions','modules'],
    'sradmin' => ['overview','players','whitelist','blacklist','sanctions','modules'],
    'admin'   => ['overview','players','whitelist','blacklist','sanctions','modules'],
]);

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/includes/security.php';

// Configure secure session BEFORE starting it
configureSecureSession();

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Apply security headers
applySecurityHeaders();

date_default_timezone_set('Europe/Madrid');

function getUserRole(string $discord_id): ?string {
    if ($discord_id === FOUNDER_DISCORD_ID) {
        return 'founder';
    }
    try {
        $db = db();
        if ($db === null) {
            error_log("Error getting user role: Database connection unavailable");
            return null;
        }
        $stmt = $db->prepare("SELECT role FROM admin_users WHERE discord_id = ?");
        $stmt->execute([$discord_id]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result ? $result['role'] : null;
    } catch (Exception $e) {
        error_log("Error getting user role: " . $e->getMessage());
        return null;
    }
}

function hasPermission(string $role, string $section): bool {
    return isset(ROLE_PERMISSIONS[$role]) && in_array($section, ROLE_PERMISSIONS[$role]);
}

function isAuthenticated(): bool {
    return isset($_SESSION['furrguard_admin']) && !empty($_SESSION['furrguard_admin']['discord_id']);
}

function requireAuth(): void {
    if (!isAuthenticated()) {
        header('HTTP/1.1 401 Unauthorized');
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
}

function getStoredApiKey(): ?string {
    try {
        $db = db();
        $stmt = $db->prepare("SELECT value FROM settings WHERE `key` = 'api_key'");
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        return $result ? $result['value'] : null;
    } catch (Exception $e) {
        error_log("Error getting API key: " . $e->getMessage());
        return null;
    }
}

function validateApiKey(): bool {
    $apiKey = null;

    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        $apiKey = $headers['X-API-Key'] ?? $headers['x-api-key'] ?? $headers['X-Api-Key'] ?? null;
    }

    if ($apiKey === null) {
        $apiKey = $_SERVER['HTTP_X_API_KEY'] ?? null;
    }

    if ($apiKey === null) {
        return false;
    }

    $storedKey = getStoredApiKey();
    return $storedKey !== null && hash_equals($storedKey, $apiKey);
}

function requireApiKey(): void {
    if (!validateApiKey()) {
        header('HTTP/1.1 401 Unauthorized');
        echo json_encode(['error' => 'Invalid API key']);
        exit;
    }
}

function getDiscordLoginUrl(): string {
    if (empty($_SESSION['oauth_state'])) {
        $_SESSION['oauth_state'] = bin2hex(random_bytes(32));
    }
    $params = http_build_query([
        'client_id' => DISCORD_CLIENT_ID,
        'redirect_uri' => DISCORD_REDIRECT_URI,
        'response_type' => 'code',
        'scope' => 'identify',
        'state' => $_SESSION['oauth_state'],
    ]);
    return 'https://discord.com/api/oauth2/authorize?' . $params;
}
?>