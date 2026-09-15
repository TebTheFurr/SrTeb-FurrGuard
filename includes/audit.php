<?php

declare(strict_types=1);

/**
 * FurrGuard - traza de actividad (`activity_logs`).
 */

const ACTIVITY_LOG_TYPES = [
    'auth', 'whitelist', 'blacklist', 'providers', 'countries', 'continents', 'messages',
    'settings', 'users', 'furrperms', 'furrsecurity', 'security', 'players',
];

/**
 * Registra una acción. `$ip` por defecto es la IP real del cliente (null en CLI).
 *
 * @throws InvalidArgumentException si `$type` no está en ACTIVITY_LOG_TYPES.
 */
function logActivity(PDO $db, string $type, string $action, ?string $details = null, ?string $ip = null): void
{
    if (!in_array($type, ACTIVITY_LOG_TYPES, true)) {
        throw new InvalidArgumentException("Tipo de actividad desconocido: {$type}");
    }
    $ip = $ip !== null ? normalizeIp($ip) : (PHP_SAPI === 'cli' ? null : getClientIp());
    $stmt = $db->prepare('INSERT INTO activity_logs (type, action, details, ip_address) VALUES (?, ?, ?, ?)');
    $stmt->execute([
        $type,
        mb_substr($action, 0, 100),
        $details === null ? null : mb_strcut($details, 0, 65000, 'UTF-8'),
        $ip,
    ]);
}
