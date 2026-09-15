<?php

declare(strict_types=1);

/**
 * FurrSecurity - verificación web del staff (docs/API.md §3).
 *
 *   GET  ?token=…         → confirmación con la IP, el país y la hora de la solicitud
 *   POST action=confirm   → CSRF, token en sesión y 303 a Discord OAuth (state aleatorio)
 *   GET  ?code=…&state=…  → state de la sesión, token aún pendiente y Discord del staff
 *   GET  (sin parámetros) → la confirmación del token guardado en sesión (la SPA limpia la URL)
 *
 * @author GrinchHorizon
 * @copyright SrTeb Limited
 */

require_once __DIR__ . '/config.php';
require_once FURRGUARD_ROOT . '/includes/furrsecurity.php';
require_once FURRGUARD_ROOT . '/includes/discord.php';
require_once FURRGUARD_ROOT . '/includes/spa.php';

const VERIFY_SESSION_KEY = 'furrsecurity_verify';
const VERIFY_EXPIRED_MESSAGE = 'Este enlace de verificación ya no es válido. Vuelve a entrar al servidor para generar uno nuevo.';

header('Cache-Control: no-store');
header('Referrer-Policy: no-referrer');
header('X-Robots-Tag: noindex, nofollow');

/**
 * @param array<string, mixed> $data VerifyData
 */
function verifyRespond(array $data, int $status = 200): never
{
    serveSpa(FURRGUARD_ROOT . '/public/dist/index.html', 'window.__VERIFY_DATA__ = ' . spaJson($data) . ';', $status);
}

function verifyError(int $status, string $code, string $title, string $message): never
{
    verifyRespond(['state' => 'error', 'title' => $title, 'message' => $message, 'code' => $code], $status);
}

/**
 * Fila de un token que sigue pendiente y sin caducar, o error "enlace caducado".
 *
 * @return array<string, mixed>
 */
function verifyPendingRow(PDO $db, string $token): array
{
    $row = furrSecurityVerificationByToken($db, $token);
    if ($row === null || $row['status'] !== 'pending' || (int) $row['token_alive'] !== 1 || normalizeIp((string) $row['ip_address']) === null) {
        verifyError(410, 'token_expired', 'Enlace caducado', VERIFY_EXPIRED_MESSAGE);
    }
    return $row;
}

function verifyShow(PDO $db): never
{
    $stored = $_SESSION[VERIFY_SESSION_KEY] ?? null;
    $token = $_GET['token'] ?? (is_array($stored) ? ($stored['token'] ?? null) : null);
    if ($token === null) {
        verifyError(400, 'missing_token', 'Token no proporcionado', 'Abre el enlace de verificación que te ha dado el servidor de Minecraft.');
    }
    if (!is_string($token) || preg_match(FURRSECURITY_TOKEN_PATTERN, $token) !== 1) {
        verifyError(400, 'invalid_token', 'Enlace no válido', 'El enlace de verificación no es válido. Cópialo entero desde el juego.');
    }
    $row = furrSecurityVerificationByToken($db, $token);
    if ($row === null) {
        verifyError(404, 'token_not_found', 'Enlace no encontrado', VERIFY_EXPIRED_MESSAGE);
    }
    if ($row['status'] === 'verified' && (int) $row['session_alive'] === 1) {
        verifyRespond(['state' => 'success', 'title' => 'Ya verificado', 'message' => 'Esta verificación ya está completada. Puedes volver a Minecraft.']);
    }
    $row = verifyPendingRow($db, $token);
    $_SESSION[VERIFY_SESSION_KEY] = ['token' => $token];
    $ip = (string) normalizeIp((string) $row['ip_address']);
    $geo = geoLookup($db, $ip, false)['data'];
    verifyRespond([
        'state' => 'confirm',
        'csrf' => csrfToken(),
        'token' => $token,
        'minecraft_nick' => $row['minecraft_nick'],
        'request_ip' => $ip,
        'request_country' => is_string($geo['country'] ?? null) ? $geo['country'] : null,
        'request_country_code' => is_string($geo['countryCode'] ?? null) ? $geo['countryCode'] : null,
        'requested_at' => $row['created_at'],
        'token_expires_at' => $row['token_expires_at'],
    ]);
}

function verifyConfirm(PDO $db): never
{
    inputEnum($_POST, 'action', ['confirm']);
    $csrf = $_POST['csrf'] ?? null;
    if (!validateCsrfToken(is_string($csrf) ? $csrf : null)) {
        verifyError(403, 'session_expired', 'La página ha caducado', 'Vuelve a abrir el enlace de verificación e inténtalo de nuevo.');
    }
    $token = (string) inputVerificationToken($_POST);
    verifyPendingRow($db, $token);
    $state = bin2hex(random_bytes(32));
    $_SESSION[VERIFY_SESSION_KEY] = ['token' => $token, 'state' => $state];
    header('Location: ' . discordAuthorizeUrl(APP_URL . '/verify.php', $state), true, 303);
    exit;
}

function verifyOAuthReturn(PDO $db): never
{
    $stored = $_SESSION[VERIFY_SESSION_KEY] ?? null;
    $expected = is_array($stored) && is_string($stored['state'] ?? null) ? $stored['state'] : null;
    $token = is_array($stored) && is_string($stored['token'] ?? null) ? $stored['token'] : null;
    $state = $_GET['state'] ?? null;
    if ($expected === null || $token === null || !is_string($state) || !hash_equals($expected, $state)) {
        verifyError(400, 'invalid_state', 'Solicitud no válida', 'La vuelta desde Discord no corresponde a esta verificación. Abre de nuevo el enlace.');
    }
    $_SESSION[VERIFY_SESSION_KEY] = ['token' => $token];
    if (array_key_exists('error', $_GET)) {
        verifyError(400, 'discord_denied', 'Verificación cancelada', 'Has cancelado la autorización en Discord. Abre de nuevo el enlace si quieres reintentarlo.');
    }
    $code = $_GET['code'] ?? null;
    if (!is_string($code) || preg_match(DISCORD_CODE_PATTERN, $code) !== 1) {
        verifyError(400, 'invalid_code', 'Solicitud no válida', 'Discord devolvió un código no válido. Abre de nuevo el enlace.');
    }
    $pending = verifyPendingRow($db, $token);

    $accessToken = discordExchangeCode($code, APP_URL . '/verify.php');
    $discordUser = $accessToken === null ? null : discordFetchUser($accessToken);
    if ($discordUser === null) {
        verifyError(503, 'discord_error', 'Discord no responde', 'No se pudo confirmar tu cuenta de Discord. Inténtalo de nuevo en unos minutos.');
    }

    $result = furrSecurityCompleteVerification($db, $token, $discordUser['id'], getClientIp());
    if ($result['result'] !== 'mismatch') {
        unset($_SESSION[VERIFY_SESSION_KEY]);
    }
    match ($result['result']) {
        'verified' => verifyRespond(['state' => 'success', 'title' => 'Verificación completada', 'message' => 'Tu identidad está confirmada. Ya puedes volver a Minecraft.']),
        'blacklisted' => verifyError(403, 'auto_blacklisted', 'Cuenta bloqueada', 'Se han superado los intentos con una cuenta de Discord que no es la del staff. Contacta con un administrador.'),
        'mismatch' => verifyError(403, 'discord_mismatch', 'Cuenta de Discord incorrecta', sprintf(
            'Esta cuenta de Discord no es la del staff %s. Intento %d de %d: al llegar al máximo la cuenta se bloquea.',
            (string) $pending['minecraft_nick'],
            $result['attempts'],
            $result['max_attempts']
        )),
        default => verifyError(410, 'token_expired', 'Enlace caducado', VERIFY_EXPIRED_MESSAGE),
    };
}

$db = db();
if ($db === null) {
    verifyError(503, 'service_unavailable', 'Servicio no disponible', 'No se puede verificar ahora mismo. Inténtalo de nuevo en unos minutos.');
}
if (APP_URL === '' || DISCORD_CLIENT_ID === '') {
    verifyError(503, 'not_configured', 'Verificación no configurada', 'La verificación con Discord no está configurada en el servidor.');
}

try {
    if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) === 'POST') {
        verifyConfirm($db);
    }
    if (array_key_exists('code', $_GET) || array_key_exists('state', $_GET) || array_key_exists('error', $_GET)) {
        verifyOAuthReturn($db);
    }
    verifyShow($db);
} catch (ValidationError) {
    verifyError(400, 'invalid_request', 'Solicitud no válida', 'El formulario de verificación no es válido. Abre de nuevo el enlace.');
} catch (Throwable $e) {
    error_log('FurrGuard verify: ' . $e);
    verifyError(503, 'service_unavailable', 'Servicio no disponible', 'No se puede verificar ahora mismo. Inténtalo de nuevo en unos minutos.');
}
