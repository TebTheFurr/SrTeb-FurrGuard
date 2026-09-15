<?php

declare(strict_types=1);

/**
 * FurrGuard - vuelta de Discord OAuth del panel: state de la sesión, code, usuario de Discord, rol e
 * inicio de sesión. Siempre redirige a /admin/ (con ?error=<código> si algo falla).
 *
 * @author GrinchHorizon
 * @copyright Tebby Services S.L.
 * @website https://tebby.lgbt
 */

require_once dirname(__DIR__) . '/config.php';
require_once FURRGUARD_ROOT . '/includes/discord.php';

const ADMIN_CALLBACK_ATTEMPTS = 10;
const ADMIN_CALLBACK_WINDOW = 300;

function adminCallbackRedirect(?string $error = null): never
{
    header('Cache-Control: no-store');
    header('Location: /admin/' . ($error === null ? '' : '?error=' . rawurlencode($error)), true, 302);
    exit;
}

if (!rateLimitCheck('admin_oauth_callback:' . getClientIp(), ADMIN_CALLBACK_ATTEMPTS, ADMIN_CALLBACK_WINDOW)['allowed']) {
    adminCallbackRedirect('rate_limited');
}

// El state es de un solo uso: se consume antes de comprobarlo.
$expectedState = $_SESSION['oauth_state'] ?? null;
unset($_SESSION['oauth_state']);
$state = $_GET['state'] ?? null;
if (!is_string($expectedState) || !is_string($state) || !hash_equals($expectedState, $state)) {
    adminCallbackRedirect('invalid_state');
}
if (array_key_exists('error', $_GET)) {
    adminCallbackRedirect('discord_error');
}
$code = $_GET['code'] ?? null;
if (!is_string($code) || preg_match(DISCORD_CODE_PATTERN, $code) !== 1) {
    adminCallbackRedirect('invalid_code');
}

$db = db();
if ($db === null) {
    http_response_code(503);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'El panel no está disponible ahora mismo. Inténtalo de nuevo en unos minutos.';
    exit;
}

$accessToken = discordExchangeCode($code, DISCORD_REDIRECT_URI !== '' ? DISCORD_REDIRECT_URI : APP_URL . '/admin/callback.php');
$discordUser = $accessToken === null ? null : discordFetchUser($accessToken);
if ($discordUser === null) {
    adminCallbackRedirect('discord_error');
}

try {
    $role = getUserRole($db, $discordUser['id']);
    if ($role === null) {
        logActivity($db, 'auth', 'login_denied', "{$discordUser['username']} ({$discordUser['id']}) no tiene acceso al panel.");
        adminCallbackRedirect('no_access');
    }
    adminSessionStart($db, ['discord_id' => $discordUser['id'], 'username' => $discordUser['username'], 'avatar' => $discordUser['avatar']], $role);
    logActivity($db, 'auth', 'login', "{$discordUser['username']} ({$discordUser['id']}) inició sesión como {$role}.");
} catch (PDOException $e) {
    error_log('FurrGuard callback: ' . $e->getMessage());
    adminCallbackRedirect('discord_error');
}

adminCallbackRedirect();
