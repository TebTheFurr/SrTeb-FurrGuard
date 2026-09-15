<?php

declare(strict_types=1);

/**
 * FurrGuard - jugadores: validación de identidades que llegan de los plugins, registro de
 * conexiones y ficha del jugador.
 *
 * La ficha se identifica SOLO por UUID: dos jugadores distintos con el mismo nick (modo offline)
 * nunca se fusionan. `last_seen` y `last_used` se actualizan explícitamente (ya no hay ON UPDATE).
 */

require_once __DIR__ . '/sql.php';

// ─── Entrada ────────────────────────────────────────────────────────────────

/**
 * @param array<array-key, mixed> $in
 */
function inputOptionalUuid(array $in, string $key = 'uuid'): ?string
{
    $raw = inputOptionalString($in, $key, 64);
    if ($raw === null) {
        return null;
    }
    return normalizeUuid($raw) ?? throw new ValidationError("El campo {$key} no es un UUID válido.", $key);
}

/**
 * @param array<array-key, mixed> $in
 */
function inputUuid(array $in, string $key = 'uuid'): string
{
    return inputOptionalUuid($in, $key) ?? throw new ValidationError("El campo {$key} es obligatorio.", $key);
}

/**
 * @param array<array-key, mixed> $in
 */
function inputNick(array $in, string $key = 'nick'): string
{
    $nick = inputString($in, $key, 32);
    if (!isValidNick($nick)) {
        throw new ValidationError("El campo {$key} no es un nick válido.", $key);
    }
    return $nick;
}

/**
 * @param array<array-key, mixed> $in
 */
function inputOptionalIp(array $in, string $key = 'ip'): ?string
{
    $raw = inputOptionalString($in, $key, 64);
    if ($raw === null) {
        return null;
    }
    return normalizeIp($raw) ?? throw new ValidationError("El campo {$key} no es una IP válida.", $key);
}

/**
 * @param array<array-key, mixed> $in
 */
function inputIp(array $in, string $key = 'ip'): string
{
    return inputOptionalIp($in, $key) ?? throw new ValidationError("El campo {$key} es obligatorio.", $key);
}

// ─── Registro ───────────────────────────────────────────────────────────────

/**
 * Guarda un intento de conexión. `is_vpn` es 1 solo si se bloqueó por VPN (ip-api no marca VPN).
 *
 * @param array{uuid: ?string, nick: string, ip: string, game_version?: ?string} $player
 * @param array<string, mixed> $geo
 */
function logPlayerConnection(PDO $db, array $player, array $geo, bool $blocked, ?string $reason, ?string $geoSource = null): void
{
    $text = static function (string $key, int $max) use ($geo): ?string {
        $value = $geo[$key] ?? null;
        return is_string($value) && trim($value) !== '' ? mb_substr(trim($value), 0, $max) : null;
    };
    $flag = static fn (string $key): int => ($geo[$key] ?? null) === true ? 1 : 0;
    $coordinate = static function (string $key, float $limit) use ($geo): ?float {
        $value = $geo[$key] ?? null;
        return (is_int($value) || is_float($value)) && abs($value) <= $limit ? round((float) $value, 6) : null;
    };

    $db->prepare(
        'INSERT INTO player_connections
            (uuid, nick, ip, ip_version, country, country_code, region, city, isp, org, asn, asname, is_proxy, is_vpn,
             is_hosting, is_mobile, latitude, longitude, timezone, game_version, blocked, block_reason, raw_data, geo_source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())'
    )->execute([
        $player['uuid'],
        $player['nick'],
        $player['ip'],
        ipFamily($player['ip']) ?? 'ipv4',
        $text('country', 100),
        $text('countryCode', 5),
        $text('regionName', 100),
        $text('city', 100),
        $text('isp', 255),
        $text('org', 255),
        $text('as', 255),
        $text('asname', 255),
        $flag('proxy'),
        $reason === 'vpn_detected' ? 1 : 0,
        $flag('hosting'),
        $flag('mobile'),
        $coordinate('lat', 90),
        $coordinate('lon', 180),
        $text('timezone', 50),
        isset($player['game_version']) ? mb_substr($player['game_version'], 0, 20) : null,
        $blocked ? 1 : 0,
        $reason,
        json_encode((object) $geo, JSON_FLAGS),
        $geoSource === null ? null : mb_substr($geoSource, 0, 64),
    ]);
}

/**
 * Crea o actualiza la ficha del jugador por UUID y sus nicks e IPs conocidas. Sin `$online`
 * (check_player) suma una conexión; con `$online` (player_join) solo marca al jugador conectado.
 *
 * @param array<string, mixed> $geo
 */
function updatePlayerInfo(PDO $db, string $uuid, string $nick, string $ip, array $geo, bool $online = false): void
{
    $country = is_string($geo['country'] ?? null) ? mb_substr($geo['country'], 0, 100) : null;
    $countryCode = is_string($geo['countryCode'] ?? null) ? mb_substr($geo['countryCode'], 0, 5) : null;
    $db->prepare(
        'INSERT INTO players (uuid, first_nick, last_nick, first_ip, last_ip, last_country, last_country_code, is_online, total_connections, first_seen, last_seen)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
         ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), last_nick = VALUES(last_nick), last_ip = VALUES(last_ip),
             last_country = COALESCE(VALUES(last_country), last_country),
             last_country_code = COALESCE(VALUES(last_country_code), last_country_code),
             is_online = IF(VALUES(is_online) = 1, 1, is_online),
             total_connections = IF(VALUES(is_online) = 1, total_connections, COALESCE(total_connections, 0) + 1),
             last_seen = NOW()'
    )->execute([$uuid, $nick, $nick, $ip, $ip, $country, $countryCode, $online ? 1 : 0]);
    $playerId = (int) $db->lastInsertId();

    $db->prepare(
        'INSERT INTO player_nicks (player_id, nick, first_used, last_used) VALUES (?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE last_used = NOW()'
    )->execute([$playerId, $nick]);
    $db->prepare(
        'INSERT INTO player_ips (player_id, ip, country, country_code, isp, asn, first_used, last_used)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE last_used = NOW(), country = COALESCE(VALUES(country), country),
             country_code = COALESCE(VALUES(country_code), country_code), isp = COALESCE(VALUES(isp), isp),
             asn = COALESCE(VALUES(asn), asn)'
    )->execute([
        $playerId,
        $ip,
        $country,
        $countryCode,
        is_string($geo['isp'] ?? null) ? mb_substr($geo['isp'], 0, 255) : null,
        is_string($geo['as'] ?? null) ? mb_substr($geo['as'], 0, 255) : null,
    ]);
}

function playerQuit(PDO $db, string $uuid): void
{
    $db->prepare('UPDATE players SET is_online = 0 WHERE uuid = ?')->execute([$uuid]);
}

/**
 * Jugador por nick (último nick y, si no, cualquier nick que haya usado), el más reciente.
 *
 * @return array<string, mixed>|null
 */
function findPlayerByNick(PDO $db, string $nick): ?array
{
    $columns = 'p.id, p.uuid, p.last_nick, p.last_ip, p.is_online, p.first_seen, p.last_seen';
    foreach ([
        "SELECT {$columns} FROM players p WHERE p.last_nick = ? ORDER BY p.last_seen DESC LIMIT 1",
        "SELECT {$columns} FROM player_nicks pn JOIN players p ON p.id = pn.player_id WHERE pn.nick = ? ORDER BY pn.last_used DESC LIMIT 1",
    ] as $sql) {
        $stmt = $db->prepare($sql);
        $stmt->execute([$nick]);
        $row = $stmt->fetch();
        if (is_array($row)) {
            return $row;
        }
    }
    return null;
}
