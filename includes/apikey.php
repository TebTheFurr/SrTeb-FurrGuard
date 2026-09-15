<?php

declare(strict_types=1);

/**
 * FurrGuard - API key de plugins y módulos (docs/API.md §1.1).
 *
 * Solo se guarda el SHA-256 (`api_key_hash`), el prefijo (10 caracteres) y la fecha de creación.
 * La clave en claro se muestra una única vez al regenerarla.
 */

const API_KEY_PLACEHOLDER = 'fg_change_this_api_key_immediately';
const API_KEY_PREFIX_LENGTH = 10;
const API_AUTH_FAILURES_PER_MIN = 30;
const API_RATE_LIMIT_DEFAULT = 6000;

function apiKeyHash(string $key): string
{
    return hash('sha256', $key);
}

function storedApiKeyHash(PDO $db): ?string
{
    $hash = getSetting($db, 'api_key_hash');
    return is_string($hash) && preg_match('/^[0-9a-f]{64}\z/', $hash) ? $hash : null;
}

function apiKeyConfigured(PDO $db): bool
{
    return storedApiKeyHash($db) !== null;
}

/**
 * ¿Coincide la clave con la guardada? La clave de ejemplo de install.sql nunca es válida (C5).
 */
function apiKeyValidate(PDO $db, ?string $candidate): bool
{
    return apiKeyMatches(storedApiKeyHash($db), $candidate);
}

function apiKeyMatches(?string $storedHash, ?string $candidate): bool
{
    if ($storedHash === null || $candidate === null || $candidate === '' || strlen($candidate) > 200 || $candidate === API_KEY_PLACEHOLDER) {
        return false;
    }
    return hash_equals($storedHash, apiKeyHash($candidate));
}

/**
 * Genera una clave nueva (`fg_` + 48 hex), invalida la anterior y deja traza.
 *
 * @return array{api_key: string, prefix: string}
 */
function apiKeyRegenerate(PDO $db, ?string $actor = null): array
{
    $key = 'fg_' . bin2hex(random_bytes(24));
    $prefix = substr($key, 0, API_KEY_PREFIX_LENGTH);

    $ownTransaction = !$db->inTransaction();
    if ($ownTransaction) {
        $db->beginTransaction();
    }
    try {
        setSetting($db, 'api_key_hash', apiKeyHash($key));
        setSetting($db, 'api_key_prefix', $prefix);
        setSetting($db, 'api_key_created_at', gmdate('Y-m-d H:i:s'));
        $db->exec("DELETE FROM settings WHERE `key` = 'api_key'");
        logActivity($db, 'settings', 'api_key_regenerated', ($actor !== null ? "Por {$actor}. " : '') . "Prefijo {$prefix}");
        if ($ownTransaction) {
            $db->commit();
        }
    } catch (Throwable $e) {
        if ($ownTransaction && $db->inTransaction()) {
            $db->rollBack();
        }
        throw $e;
    }
    return ['api_key' => $key, 'prefix' => $prefix];
}

/**
 * Información pública de la clave para el panel (nunca el hash).
 *
 * @return array{configured: bool, prefix: ?string, created_at: ?string}
 */
function apiKeyInfo(PDO $db): array
{
    if (!apiKeyConfigured($db)) {
        return ['configured' => false, 'prefix' => null, 'created_at' => null];
    }
    $info = getSettings($db, ['api_key_prefix', 'api_key_created_at']);
    return ['configured' => true, 'prefix' => $info['api_key_prefix'], 'created_at' => $info['api_key_created_at']];
}

function apiRateLimitPerMinute(): int
{
    $value = env('API_RATE_LIMIT_PER_MIN');
    return preg_match('/^\d{1,7}\z/', $value) && (int) $value > 0 ? (int) $value : API_RATE_LIMIT_DEFAULT;
}

/**
 * Autentica una petición de plugin/módulo o responde y termina:
 *  - 503 `api_key_not_configured` si el founder aún no generó clave;
 *  - 401 `invalid_api_key`, sumando un fallo al cubo de la IP; pasados 30 fallos/min → 429;
 *  - 429 si la clave supera API_RATE_LIMIT_PER_MIN (cubo por clave, nunca por IP: A2).
 *
 * Una clave válida nunca consulta el cubo de fallos: todo el tráfico sale de la IP del proxy y un
 * módulo con la clave antigua no debe dejar sin servicio a los que usan la buena.
 */
function authenticatePluginRequest(PDO $db): void
{
    $storedHash = storedApiKeyHash($db);
    if ($storedHash === null) {
        respondPluginError(503, 'api_key_not_configured', 'No hay API key configurada. Genérala desde el panel.');
    }

    $candidate = $_SERVER['HTTP_X_API_KEY'] ?? null;
    if (!is_string($candidate) || !apiKeyMatches($storedHash, $candidate)) {
        $failures = rateLimitCheck('plugin_auth_fail:' . getClientIp(), API_AUTH_FAILURES_PER_MIN, 60);
        if (!$failures['allowed']) {
            respondTooManyRequests($failures['retry_after'], 'plugin');
        }
        respondPluginError(401, 'invalid_api_key', 'API key inválida.');
    }

    $keyBucket = rateLimitCheck('plugin_key:' . substr(apiKeyHash($candidate), 0, 16), apiRateLimitPerMinute(), 60);
    if (!$keyBucket['allowed']) {
        respondTooManyRequests($keyBucket['retry_after'], 'plugin');
    }
}
