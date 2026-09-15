<?php

declare(strict_types=1);

/**
 * FurrGuard - cabeceras de seguridad, sesión web, CSRF, IP del cliente y búsquedas LIKE.
 *
 * @author GrinchHorizon
 */

const SESSION_GC_MAXLIFETIME = 28800;
const VITE_DEV_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

/**
 * Rangos de Cloudflare (https://www.cloudflare.com/ips/). Revisar si Cloudflare los cambia.
 */
const CLOUDFLARE_RANGES = [
    '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18',
    '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17',
    '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
    '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32',
    '2a06:98c0::/29', '2c0f:f248::/32',
];

// ─── Entorno ────────────────────────────────────────────────────────────────

function isDevelopment(): bool
{
    return APP_ENV === 'development';
}

function appUsesHttps(): bool
{
    return str_starts_with(strtolower(APP_URL), 'https://');
}

/**
 * Origen (`esquema://host[:puerto]`) de APP_URL en minúsculas, o '' si no está configurada.
 */
function appOrigin(): string
{
    return originOf(APP_URL);
}

function originOf(string $url): string
{
    $parts = parse_url($url);
    if (!is_array($parts) || !isset($parts['scheme'], $parts['host'])) {
        return '';
    }
    $scheme = strtolower($parts['scheme']);
    $origin = $scheme . '://' . strtolower($parts['host']);
    $port = $parts['port'] ?? null;
    if ($port !== null && !(($scheme === 'https' && $port === 443) || ($scheme === 'http' && $port === 80))) {
        $origin .= ':' . $port;
    }
    return $origin;
}

// ─── Cabeceras ──────────────────────────────────────────────────────────────

function getCspNonce(): string
{
    static $nonce = null;
    return $nonce ??= base64_encode(random_bytes(18));
}

function buildContentSecurityPolicy(string $nonce, bool $development): string
{
    $dev = $development ? ' ' . implode(' ', VITE_DEV_ORIGINS) : '';
    $devSockets = $development ? ' ws://localhost:5173 ws://127.0.0.1:5173' : '';
    return implode('; ', [
        "default-src 'self'",
        "script-src 'self' 'nonce-{$nonce}'{$dev}",
        "style-src 'self' 'unsafe-inline'{$dev}",
        "img-src 'self' data: https://cdn.discordapp.com https://mc-heads.net https://flagcdn.com{$dev}",
        "font-src 'self'{$dev}",
        "connect-src 'self'{$dev}{$devSockets}",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "object-src 'none'",
        "form-action 'self' https://discord.com",
    ]);
}

/**
 * Cabeceras de las páginas web (panel, landing, verificación).
 */
function applySecurityHeaders(): void
{
    if (headers_sent()) {
        return;
    }
    header('Content-Security-Policy: ' . buildContentSecurityPolicy(getCspNonce(), isDevelopment()));
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    if (appUsesHttps()) {
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    }
    if (isSensitivePath((string) ($_SERVER['SCRIPT_NAME'] ?? ''), (string) ($_SERVER['REQUEST_URI'] ?? ''))) {
        header('Cache-Control: no-store');
        header('Pragma: no-cache');
    }
}

/**
 * Panel (`/admin/…`) y verificación (`/verify.php`) nunca se cachean.
 */
function isSensitivePath(string $scriptName, string $requestUri): bool
{
    $path = (string) parse_url($requestUri, PHP_URL_PATH);
    foreach ([$scriptName, $path] as $candidate) {
        if (str_contains($candidate, '/admin/') || str_ends_with($candidate, '/verify.php')) {
            return true;
        }
    }
    return false;
}

// ─── Sesión web ─────────────────────────────────────────────────────────────

/**
 * Configura la sesión (llamar antes de session_start). La cookie es `Secure` según APP_URL,
 * nunca según cabeceras del cliente.
 */
function configureSecureSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $secure = appUsesHttps();
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_trans_sid', '0');
    ini_set('session.cookie_httponly', '1');
    ini_set('session.cookie_samesite', 'Lax');
    ini_set('session.cookie_secure', $secure ? '1' : '0');
    ini_set('session.cookie_lifetime', '0');
    ini_set('session.gc_maxlifetime', (string) SESSION_GC_MAXLIFETIME);
    // Debian pone gc_probability=0 y limpia solo su carpeta por cron: la nuestra la limpia PHP.
    ini_set('session.gc_probability', '1');
    ini_set('session.gc_divisor', '100');
    session_name($secure ? '__Host-furrguard' : 'furrguard');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    $path = storagePath('sessions');
    if ((is_dir($path) || @mkdir($path, 0700, true)) && is_writable($path)) {
        session_save_path($path);
    } else {
        error_log("FurrGuard: no se puede usar {$path} para sesiones; se usa la ruta por defecto de PHP");
    }
}

function startWebSession(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        configureSecureSession();
        session_start();
    }
}

// ─── CSRF ───────────────────────────────────────────────────────────────────

/**
 * Token CSRF de la sesión (se crea si no existe). Requiere sesión iniciada.
 */
function csrfToken(): string
{
    $token = $_SESSION['csrf_token'] ?? null;
    if (!is_string($token) || strlen($token) !== 64) {
        $token = rotateCsrfToken();
    }
    return $token;
}

function rotateCsrfToken(): string
{
    $token = bin2hex(random_bytes(32));
    $_SESSION['csrf_token'] = $token;
    return $token;
}

function validateCsrfToken(?string $token): bool
{
    $expected = $_SESSION['csrf_token'] ?? null;
    return is_string($expected) && $expected !== '' && is_string($token) && hash_equals($expected, $token);
}

/**
 * ¿Cumple la petición las reglas del API del panel (docs/API.md §4.2)?
 *
 * @param array<string, mixed> $server $_SERVER
 */
function isValidAdminApiRequest(array $server, ?string $expectedToken, string $appOrigin): bool
{
    if (strtoupper((string) ($server['REQUEST_METHOD'] ?? '')) !== 'POST') {
        return false;
    }
    $contentType = (string) ($server['CONTENT_TYPE'] ?? $server['HTTP_CONTENT_TYPE'] ?? '');
    if (strtolower(trim(explode(';', $contentType, 2)[0])) !== 'application/json') {
        return false;
    }
    $token = $server['HTTP_X_CSRF_TOKEN'] ?? null;
    if ($expectedToken === null || $expectedToken === '' || !is_string($token) || !hash_equals($expectedToken, $token)) {
        return false;
    }
    if (isset($server['HTTP_ORIGIN']) && ($appOrigin === '' || originOf((string) $server['HTTP_ORIGIN']) !== $appOrigin)) {
        return false;
    }
    if (isset($server['HTTP_SEC_FETCH_SITE']) && strtolower((string) $server['HTTP_SEC_FETCH_SITE']) !== 'same-origin') {
        return false;
    }
    return true;
}

/**
 * Exige POST + JSON + `X-CSRF-Token` + `Origin`/`Sec-Fetch-Site` coherentes. Si no → 403 `csrf`.
 * Requiere sesión iniciada.
 */
function enforceAdminApiRequest(): void
{
    $expected = $_SESSION['csrf_token'] ?? null;
    if (!isValidAdminApiRequest($_SERVER, is_string($expected) ? $expected : null, appOrigin())) {
        respondPanelError(403, 'Token CSRF inválido o petición no permitida. Recarga la página.', 'csrf');
    }
}

// ─── IP del cliente ─────────────────────────────────────────────────────────

function isCloudflareIp(string $ip): bool
{
    foreach (CLOUDFLARE_RANGES as $range) {
        if (ipInCidr($ip, $range)) {
            return true;
        }
    }
    return false;
}

/**
 * @return list<string> IPs o CIDR de TRUSTED_PROXIES.
 */
function trustedProxies(): array
{
    return array_values(array_filter(array_map('trim', explode(',', env('TRUSTED_PROXIES')))));
}

/**
 * @param list<string> $trusted
 */
function isTrustedProxy(string $ip, array $trusted): bool
{
    foreach ($trusted as $entry) {
        if (ipInCidr($ip, $entry)) {
            return true;
        }
    }
    return false;
}

/**
 * IP real del cliente, normalizada.
 *
 * 1. Si REMOTE_ADDR es un proxy de TRUSTED_PROXIES, se recorre X-Forwarded-For de derecha a
 *    izquierda saltando proxies de confianza; la primera IP que no lo es es el cliente (M4: la
 *    entrada de la izquierda la escribe el cliente y no vale).
 * 2. Si el salto resultante es de Cloudflare, se usa CF-Connecting-IP.
 * 3. '0.0.0.0' si no hay ninguna IP válida (CLI).
 *
 * @param array<string, mixed>|null $server $_SERVER (para tests)
 * @param list<string>|null $trusted TRUSTED_PROXIES (para tests)
 */
function getClientIp(?array $server = null, ?array $trusted = null): string
{
    $server ??= $_SERVER;
    $trusted ??= trustedProxies();
    $ip = normalizeIp(is_string($server['REMOTE_ADDR'] ?? null) ? $server['REMOTE_ADDR'] : null);
    if ($ip === null) {
        return '0.0.0.0';
    }

    if ($trusted !== [] && isTrustedProxy($ip, $trusted) && is_string($server['HTTP_X_FORWARDED_FOR'] ?? null)) {
        $hops = array_reverse(array_map('trim', explode(',', $server['HTTP_X_FORWARDED_FOR'])));
        foreach ($hops as $hop) {
            $hopIp = normalizeIp($hop);
            if ($hopIp === null) {
                break;
            }
            $ip = $hopIp;
            if (!isTrustedProxy($hopIp, $trusted)) {
                break;
            }
        }
    }

    if (isCloudflareIp($ip) && is_string($server['HTTP_CF_CONNECTING_IP'] ?? null)) {
        $cfIp = normalizeIp($server['HTTP_CF_CONNECTING_IP']);
        if ($cfIp !== null) {
            $ip = $cfIp;
        }
    }
    return $ip;
}

// ─── Búsquedas ──────────────────────────────────────────────────────────────

/**
 * Patrón LIKE "contiene" con `%`, `_` y `\` escapados: `WHERE col LIKE ?` con likePattern($q).
 */
function likePattern(string $term): string
{
    return '%' . addcslashes($term, '\\%_') . '%';
}
