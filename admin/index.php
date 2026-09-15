<?php

declare(strict_types=1);

/**
 * FurrGuard - panel (admin/dist) para cualquier ruta /admin/*, con window.__FURRGUARD__ (docs/API.md §4.1).
 * El cierre de sesión es la acción `logout` del API (POST con CSRF), nunca un GET.
 *
 * @author GrinchHorizon
 * @copyright SrTeb Limited
 * @website https://srteb.eu
 */

require_once dirname(__DIR__) . '/config.php';
require_once FURRGUARD_ROOT . '/includes/spa.php';

const ADMIN_LOGIN_ERRORS = ['invalid_code', 'invalid_state', 'discord_error', 'no_access', 'session_expired', 'access_revoked', 'rate_limited'];

function adminPanelUnavailable(): never
{
    http_response_code(503);
    header('Content-Type: text/html; charset=utf-8');
    header('Retry-After: 30');
    echo '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>FurrGuard</title></head>'
        . '<body><p>El panel no está disponible ahora mismo. Inténtalo de nuevo en unos minutos.</p></body></html>';
    exit;
}

$db = db() ?? adminPanelUnavailable();
try {
    $validation = adminSessionValidate($db);
} catch (PDOException $e) {
    error_log('FurrGuard panel: ' . $e->getMessage());
    adminPanelUnavailable();
}

$user = $validation['user'];
$loginError = $validation['error'];
$queryError = $_GET['error'] ?? null;
if ($user === null && $loginError === null && is_string($queryError) && in_array($queryError, ADMIN_LOGIN_ERRORS, true)) {
    $loginError = $queryError;
}

$boot = [
    'version' => FURRGUARD_VERSION,
    'csrfToken' => csrfToken(),
    'loginUrl' => $user === null && DISCORD_CLIENT_ID !== '' ? getDiscordLoginUrl() : '',
    'loginError' => $user === null ? $loginError : null,
    'user' => $user === null ? null : [
        'discord_id' => $user['discord_id'],
        'username' => $user['username'] ?? $user['discord_id'],
        'avatar' => $user['avatar'],
        'role' => $user['role'],
    ],
    'permissions' => $user === null ? [] : rolePermissions($user['role']),
    'canSeeIps' => $user !== null && hasPermission($user['role'], 'ips'),
];

serveSpa(__DIR__ . '/dist/index.html', 'window.__FURRGUARD__ = ' . spaJson($boot) . ';');
