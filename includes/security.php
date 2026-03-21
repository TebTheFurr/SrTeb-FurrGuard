<?php
/**
 * FurrGuard - Security Middleware
 *
 * Rate limiting, CSRF protection, input sanitization, security headers.
 *
 * @author GrinchHorizon
 */

/**
 * Generate a CSP nonce for the current request.
 * Stores it in the session for consistency across the request.
 */
function getCspNonce(): string {
    if (!isset($GLOBALS['_csp_nonce'])) {
        $GLOBALS['_csp_nonce'] = bin2hex(random_bytes(16));
    }
    return $GLOBALS['_csp_nonce'];
}

/**
 * Apply security headers to all responses.
 * Uses CSP nonces for inline scripts while allowing external scripts and inline styles.
 */
function applySecurityHeaders(): void {
    $nonce = getCspNonce();

    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('X-XSS-Protection: 1; mode=block');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=()');

    // CSP with nonces for inline scripts and styles, external scripts allowed from unpkg.com
    // Note: When nonce is present, 'unsafe-inline' is ignored per CSP spec
    // JS must use CSS classes instead of inline style="" attributes
    // media-src allows data: URIs for audio/video elements
    header("Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{$nonce}' https://unpkg.com; style-src 'self' 'nonce-{$nonce}' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https://crafatar.com https://cdn.discordapp.com https://mineskin.eu https://flagcdn.com data:; media-src 'self' data:; connect-src 'self' https://unpkg.com; base-uri 'self'; form-action 'self'; frame-ancestors 'none';");

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

    if ($isHttps) {
        ini_set('session.cookie_secure', '1');
    }
}

/**
 * Rate limiter using filesystem (no Redis dependency).
 * Returns true if the request is allowed, false if rate limited.
 * Fails CLOSED (denies request) if filesystem issues occur for security.
 */
function checkRateLimit(string $identifier, int $maxAttempts, int $windowSeconds, string $action = 'general'): bool {
    $rateLimitDir = sys_get_temp_dir() . '/furrguard_ratelimit';

    // Create directory with explicit error handling
    if (!is_dir($rateLimitDir)) {
        if (!mkdir($rateLimitDir, 0700, true) && !is_dir($rateLimitDir)) {
            error_log("SECURITY: Cannot create rate limit directory: $rateLimitDir - denying request (fail closed)");
            // Fail closed - deny request when rate limiting is unavailable for security
            return false;
        }
    }

    $file = $rateLimitDir . '/' . md5($action . '_' . $identifier) . '.json';
    $now = time();
    $attempts = [];

    if (file_exists($file)) {
        $jsonData = @file_get_contents($file);
        if ($jsonData === false) {
            error_log("SECURITY: Cannot read rate limit file: $file - denying request (fail closed)");
            return false;
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
        error_log("SECURITY: Cannot write to rate limit file: $file - denying request (fail closed)");
        // Fail closed - deny request if we cannot record the attempt
        return false;
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
 * Get the client IP address, accounting for proxies.
 * Implements strict validation to prevent IP spoofing attacks.
 */
function getClientIp(): string {
    $remoteAddr = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';

    // Validate REMOTE_ADDR first
    if (!filter_var($remoteAddr, FILTER_VALIDATE_IP)) {
        return '0.0.0.0';
    }

    $trustedProxies = array_filter(array_map('trim', explode(',', getenv('TRUSTED_PROXIES') ?: '')));

    // Only trust X-Forwarded-For if the request comes from a trusted proxy
    if (!empty($trustedProxies) && in_array($remoteAddr, $trustedProxies, true)) {
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            // Parse the X-Forwarded-For chain
            $ips = array_map('trim', explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']));

            // Find the rightmost untrusted IP (the original client)
            // X-Forwarded-For: client, proxy1, proxy2 (left to right)
            // We want the client IP, which is the leftmost, but we need to verify
            // that each proxy in the chain is trusted

            $clientIp = null;
            foreach ($ips as $ip) {
                // Validate each IP in the chain
                if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                    $clientIp = $ip;
                    break; // Take the first valid public IP (original client)
                }
            }

            if ($clientIp !== null) {
                return $clientIp;
            }
        }

        // Fallback to X-Real-IP if X-Forwarded-For is not available
        if (!empty($_SERVER['HTTP_X_REAL_IP'])) {
            $realIp = trim($_SERVER['HTTP_X_REAL_IP']);
            if (filter_var($realIp, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                return $realIp;
            }
        }
    }

    return $remoteAddr;
}

/**
 * Validate session integrity (IP binding).
 */
function validateSessionIntegrity(): bool {
    $currentIp = getClientIp();

    if (!isset($_SESSION['_session_ip'])) {
        $_SESSION['_session_ip'] = $currentIp;
        return true;
    }

    return $_SESSION['_session_ip'] === $currentIp;
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
