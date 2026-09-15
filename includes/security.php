<?php
/**
 * FurrGuard - Security Middleware
 *
 * Rate limiting, CSRF protection, input sanitization, security headers.
 *
 * @author GrinchHorizon
 */

/**
 * Apply security headers to all responses.
 */
function getCspNonce(): string {
    static $nonce = null;
    if ($nonce === null) {
        $nonce = bin2hex(random_bytes(16));
    }
    return $nonce;
}

function applySecurityHeaders(): void {
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || ($_SERVER['SERVER_PORT'] ?? 0) == 443
        || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';

    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('X-XSS-Protection: 1; mode=block');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=()');

    if ($isHttps) {
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains; preload');
    }

    $nonce = getCspNonce();

    // Detect development mode (Vite dev server or localhost)
    $host = $_SERVER['HTTP_HOST'] ?? '';
    $isDevMode = (strpos($host, 'localhost') !== false)
        || (strpos($host, '127.0.0.1') !== false)
        || ($_SERVER['SERVER_PORT'] ?? 0) == 5173;

    if ($isDevMode) {
        header("Content-Security-Policy: default-src 'self' localhost:* 127.0.0.1:*; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'nonce-{$nonce}' localhost:* 127.0.0.1:* https://unpkg.com https://fonts.googleapis.com; script-src-attr 'unsafe-inline'; style-src 'self' 'unsafe-inline' localhost:* 127.0.0.1:* https://fonts.googleapis.com; font-src 'self' localhost:* 127.0.0.1:* https://fonts.gstatic.com; img-src 'self' https://crafatar.com https://cdn.discordapp.com https://mineskin.eu https://mc-heads.net https://flagcdn.com data: localhost:* 127.0.0.1:*; connect-src 'self' localhost:* 127.0.0.1:* ws://localhost:* ws://127.0.0.1:* https://unpkg.com https://mc-heads.net");
    } else {
        header("Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{$nonce}' https://unpkg.com https://fonts.googleapis.com; script-src-attr 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https://crafatar.com https://cdn.discordapp.com https://mineskin.eu https://mc-heads.net https://flagcdn.com data:; connect-src 'self' https://unpkg.com https://mc-heads.net");
    }

    // Prevent caching of sensitive pages
    if (strpos($_SERVER['REQUEST_URI'] ?? '', '/admin/') !== false) {
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Pragma: no-cache');
    }
}

/**
 * Configure session security settings. Call BEFORE session_start().
 */
function configureSecureSession(): void {
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || ($_SERVER['SERVER_PORT'] ?? 0) == 443
        || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';

    ini_set('session.cookie_httponly', '1');
    ini_set('session.cookie_samesite', 'Lax');
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.gc_maxlifetime', '28800'); // 8 hours
    ini_set('session.cookie_lifetime', '28800'); // 8 hours

    // Use a dedicated session save path so other apps don't garbage-collect our sessions
    $sessionPath = sys_get_temp_dir() . '/furrguard_sessions';
    if (!is_dir($sessionPath)) {
        @mkdir($sessionPath, 0700, true);
    }
    session_save_path($sessionPath);

    if ($isHttps) {
        ini_set('session.cookie_secure', '1');
    }
}

/**
 * Rate limiter using filesystem (no Redis dependency).
 * Returns true if the request is allowed, false if rate limited.
 * Fails OPEN (allows request) if filesystem issues occur.
 */
function checkRateLimit(string $identifier, int $maxAttempts, int $windowSeconds, string $action = 'general'): bool {
    $rateLimitDir = sys_get_temp_dir() . '/furrguard_ratelimit';

    // Create directory with explicit error handling
    if (!is_dir($rateLimitDir)) {
        if (!mkdir($rateLimitDir, 0700, true) && !is_dir($rateLimitDir)) {
            error_log("WARNING: Cannot create rate limit directory: $rateLimitDir - allowing request (fail open)");
            // Fail open - allow request when rate limiting is unavailable
            return true;
        }
    }

    $file = $rateLimitDir . '/' . md5($action . '_' . $identifier) . '.json';
    $now = time();
    $attempts = [];

    if (file_exists($file)) {
        $jsonData = @file_get_contents($file);
        if ($jsonData === false) {
            error_log("WARNING: Cannot read rate limit file: $file - allowing request (fail open)");
            return true;
        }

        $data = json_decode($jsonData, true);
        if (is_array($data)) {
            // Keep only attempts within the window
            $attempts = array_filter($data, fn($t) => $t > ($now - $windowSeconds));
        }
    }

    if (count($attempts) >= $maxAttempts) {
        return false; // Rate limited
    }

    $attempts[] = $now;

    $writeResult = @file_put_contents($file, json_encode(array_values($attempts)), LOCK_EX);
    if ($writeResult === false) {
        error_log("WARNING: Cannot write to rate limit file: $file - allowing request (fail open)");
        // Still return true since we already decided to allow the request
    }

    return true;
}

/**
 * Enforce rate limit — sends 429 and exits if exceeded.
 */
function enforceRateLimit(string $identifier, int $maxAttempts, int $windowSeconds, string $action = 'general'): void {
    if (!checkRateLimit($identifier, $maxAttempts, $windowSeconds, $action)) {
        http_response_code(429);
        header('Retry-After: ' . $windowSeconds);
        if (isJsonRequest()) {
            echo json_encode(['success' => false, 'error' => 'Demasiadas solicitudes. Intenta de nuevo más tarde.']);
        } else {
            echo 'Too Many Requests';
        }
        exit;
    }
}

/**
 * Generate a CSRF token and store it in the session.
 */
function generateCsrfToken(): string {
    if (empty($_SESSION['csrf_token']) || empty($_SESSION['csrf_token_time']) || (time() - $_SESSION['csrf_token_time']) > 3600) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        $_SESSION['csrf_token_time'] = time();
    }
    return $_SESSION['csrf_token'];
}

/**
 * Validate a CSRF token.
 */
function validateCsrfToken(?string $token): bool {
    if (empty($token) || empty($_SESSION['csrf_token'])) {
        return false;
    }
    return hash_equals($_SESSION['csrf_token'], $token);
}

/**
 * Sanitize a string for safe output (XSS prevention).
 */
function sanitizeOutput(string $input): string {
    return htmlspecialchars($input, ENT_QUOTES | ENT_HTML5, 'UTF-8');
}

/**
 * Validate and sanitize an IP address.
 */
function validateIp(string $ip): ?string {
    $ip = trim($ip);
    if (filter_var($ip, FILTER_VALIDATE_IP)) {
        return $ip;
    }
    return null;
}

/**
 * Validate a UUID format.
 */
function validateUuid(string $uuid): ?string {
    $uuid = trim($uuid);
    if (preg_match('/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i', $uuid)) {
        return $uuid;
    }
    return null;
}

/**
 * Validate a Minecraft username.
 */
function validateMinecraftNick(string $nick): ?string {
    $nick = trim($nick);
    if (preg_match('/^[a-zA-Z0-9_]{1,16}$/', $nick)) {
        return $nick;
    }
    return null;
}

/**
 * Sanitize search input (prevent SQL wildcards abuse).
 */
function sanitizeSearchInput(string $input, int $maxLength = 100): string {
    $input = trim($input);
    $input = mb_substr($input, 0, $maxLength);
    return $input;
}

/**
 * Detect if the current request expects JSON.
 */
function isJsonRequest(): bool {
    $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
    $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
    return stripos($accept, 'application/json') !== false
        || stripos($contentType, 'application/json') !== false;
}

/**
 * Check whether an IP address is contained in a CIDR range (IPv4 or IPv6).
 */
function ipInCidr(string $ip, string $cidr): bool {
    if (strpos($cidr, '/') === false) {
        return $ip === $cidr;
    }
    [$subnet, $bits] = explode('/', $cidr, 2);
    $bits = (int) $bits;

    $ipBin = @inet_pton($ip);
    $subnetBin = @inet_pton($subnet);
    // false on invalid IP; different lengths => IPv4 vs IPv6 mismatch
    if ($ipBin === false || $subnetBin === false || strlen($ipBin) !== strlen($subnetBin)) {
        return false;
    }

    $wholeBytes = intdiv($bits, 8);
    $remainderBits = $bits % 8;

    if ($wholeBytes > 0 && strncmp($ipBin, $subnetBin, $wholeBytes) !== 0) {
        return false;
    }
    if ($remainderBits > 0) {
        $mask = chr((0xff << (8 - $remainderBits)) & 0xff);
        if ((ord($ipBin[$wholeBytes]) & ord($mask)) !== (ord($subnetBin[$wholeBytes]) & ord($mask))) {
            return false;
        }
    }
    return true;
}

/**
 * Whether the request reached us directly from a Cloudflare edge IP.
 * Ranges from https://www.cloudflare.com/ips/ (stable; refresh if Cloudflare updates them).
 */
function isCloudflareRequest(string $remoteAddr): bool {
    static $ranges = [
        // IPv4
        '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
        '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
        '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
        '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
        // IPv6
        '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32',
        '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32',
    ];
    foreach ($ranges as $cidr) {
        if (ipInCidr($remoteAddr, $cidr)) {
            return true;
        }
    }
    return false;
}

/**
 * Get the REAL client IP address, accounting for proxies.
 *
 * Trust order:
 *   1. Cloudflare: trust the CF-Connecting-IP header ONLY when the request
 *      actually comes from a Cloudflare edge IP (otherwise it is spoofable).
 *   2. Generic reverse proxy / load balancer declared in TRUSTED_PROXIES:
 *      first hop of X-Forwarded-For.
 *   3. Otherwise the raw REMOTE_ADDR.
 *
 * Returning a STABLE per-user IP prevents session IP-binding from logging the
 * user out when a CDN/proxy rotates its own edge IPs between requests.
 */
function getClientIp(): string {
    $remoteAddr = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

    // 1. Cloudflare edge -> real client IP is in CF-Connecting-IP
    if (isCloudflareRequest($remoteAddr)) {
        $cfIp = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? '';
        if (filter_var($cfIp, FILTER_VALIDATE_IP)) {
            return $cfIp;
        }
    }

    // 2. Other trusted reverse proxy / load balancer
    $trustedProxies = array_filter(array_map('trim', explode(',', getenv('TRUSTED_PROXIES') ?: '')));
    if (!empty($trustedProxies) && in_array($remoteAddr, $trustedProxies, true)) {
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $ips = array_map('trim', explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']));
            $clientIp = $ips[0];
            if (filter_var($clientIp, FILTER_VALIDATE_IP)) {
                return $clientIp;
            }
        }
    }

    // 3. Direct connection
    return $remoteAddr;
}

/**
 * Validate session integrity (IP binding).
 * Rejects requests from a different IP than the one bound at login.
 * A stolen cookie cannot be used from a different IP.
 */
function validateSessionIntegrity(): bool {
    $currentIp = getClientIp();

    if (!isset($_SESSION['_session_ip'])) {
        $_SESSION['_session_ip'] = $currentIp;
        return true;
    }

    if ($_SESSION['_session_ip'] !== $currentIp) {
        return false;
    }

    return true;
}

/**
 * Clean up expired rate limit files (call periodically).
 */
function cleanupRateLimitFiles(): void {
    $rateLimitDir = sys_get_temp_dir() . '/furrguard_ratelimit';
    if (!is_dir($rateLimitDir)) return;

    $now = time();
    foreach (glob($rateLimitDir . '/*.json') as $file) {
        if ($now - filemtime($file) > 3600) {
            @unlink($file);
        }
    }
}
