<?php

declare(strict_types=1);

/**
 * FurrGuard - whitelist y blacklist (docs/API.md §1.4).
 *
 * - `UNIQUE(type, value)` en las dos tablas y cotejo `utf8mb4_unicode_ci`: `value = ?` no distingue
 *   mayúsculas, así que un nick coincide sin importar cómo se escriba.
 * - Un baneo "en vigor" está activo y sin caducar.
 * - Las hijas (`parent_id`) cuelgan siempre de un padre raíz (un solo nivel), heredan su expiración,
 *   le siguen al activar, desactivar o editar la expiración y se borran con él (FK en cascada).
 */

require_once __DIR__ . '/sql.php';

const LIST_TYPES = ['uuid', 'nick', 'ip', 'ip_range', 'as'];
const BAN_ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const BAN_REASON_MAX = 500;
const BAN_MAX_DURATION_MINUTES = 5256000;
const BAN_STATES = ['all', 'active', 'inactive', 'expired', 'permanent', 'temporary'];
const BAN_COLUMNS = 'id, ban_id, type, value, reason, added_by, active, expires_at, parent_id, created_at';
const ACTIVITY_DETAILS_SEPARATOR = ' · ';
const LIST_VALUE_ERRORS = [
    'uuid' => 'El UUID no es válido.',
    'nick' => 'El nick no es válido: 1-16 caracteres (letras, números y _), con . o * delante en Bedrock.',
    'ip' => 'La IP no es válida.',
    'ip_range' => 'El rango no es válido: usa CIDR con prefijo mínimo /8 en IPv4 y /16 en IPv6.',
    'as' => 'El AS no es válido (p. ej. AS3352).',
];

// ─── Valores ────────────────────────────────────────────────────────────────

/**
 * Valor canónico de una entrada según su tipo (docs/API.md §0).
 *
 * @throws ValidationError
 */
function normalizeListValue(string $type, string $value): string
{
    $value = trim($value);
    $normalized = match ($type) {
        'uuid' => normalizeUuid($value),
        'nick' => isValidNick($value) ? $value : null,
        'ip' => normalizeIp($value),
        'ip_range' => normalizeCidr($value),
        'as' => normalizeAsn($value),
        default => throw new ValidationError('El tipo no es válido.', 'type'),
    };
    if ($normalized === null) {
        throw new ValidationError(LIST_VALUE_ERRORS[$type], 'value');
    }
    return $normalized;
}

/**
 * `type` + `value` de una petición, validados y normalizados.
 *
 * @param array<array-key, mixed> $in
 * @return array{type: string, value: string}
 */
function inputListEntry(array $in): array
{
    $type = inputEnum($in, 'type', LIST_TYPES);
    return ['type' => $type, 'value' => normalizeListValue($type, inputString($in, 'value', 255))];
}

/**
 * Objetivo de un baneo automático de IP: la IPv4 exacta o la red /64 de una IPv6 (una IPv6 suelta
 * rota). Las IPs privadas o reservadas nunca se banean solas: null.
 *
 * @return array{type: string, value: string}|null
 */
function autoBanIpTarget(string $ip): ?array
{
    $ip = normalizeIp($ip);
    if ($ip === null || !isPublicIp($ip)) {
        return null;
    }
    $range = ipv6Prefix64Cidr($ip);
    return $range === null ? ['type' => 'ip', 'value' => $ip] : ['type' => 'ip_range', 'value' => $range];
}

function isPublicIp(string $ip): bool
{
    return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false;
}

/**
 * Detalle de traza de whitelist/blacklist. Empieza SIEMPRE por "tipo: valor": el plugin lo lee en
 * poll_changes (que recorta lo que va tras el separador) para sus avisos in-game.
 */
function listActivityDetails(string $type, string $value, string ...$extra): string
{
    return implode(ACTIVITY_DETAILS_SEPARATOR, ["{$type}: {$value}", ...array_filter($extra, static fn (string $part): bool => $part !== '')]);
}

function generateBanId(): string
{
    $id = '';
    $max = strlen(BAN_ID_ALPHABET) - 1;
    for ($i = 0; $i < 12; $i++) {
        $id .= BAN_ID_ALPHABET[random_int(0, $max)];
    }
    return $id;
}

// ─── Estados ────────────────────────────────────────────────────────────────

/**
 * Condición SQL de un estado de baneo. Mismos criterios en filtros, pestañas y estadísticas:
 * activo = activo y sin caducar; expirado = activo con fecha pasada; inactivo = desactivado;
 * permanente y temporal son subconjuntos de activo.
 */
function banStateSql(string $state, string $alias = ''): string
{
    $p = $alias === '' ? '' : $alias . '.';
    return match ($state) {
        'active' => "({$p}active = 1 AND ({$p}expires_at IS NULL OR {$p}expires_at > NOW()))",
        'expired' => "({$p}active = 1 AND {$p}expires_at IS NOT NULL AND {$p}expires_at <= NOW())",
        'inactive' => "({$p}active IS NULL OR {$p}active <> 1)",
        'permanent' => "({$p}active = 1 AND {$p}expires_at IS NULL)",
        'temporary' => "({$p}active = 1 AND {$p}expires_at > NOW())",
        default => '(1 = 1)',
    };
}

function banInForceSql(string $alias = ''): string
{
    return banStateSql('active', $alias);
}

// ─── Escritura ──────────────────────────────────────────────────────────────

/**
 * @return array<string, mixed>|null
 */
function banFind(PDO $db, int $id): ?array
{
    $stmt = $db->prepare('SELECT ' . BAN_COLUMNS . ' FROM blacklist WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return is_array($row) ? $row : null;
}

/**
 * Inserta o reactiva una fila sin tocar nunca una que ya esté en vigor.
 *
 * Con `parent_id` la fila hereda la expiración del padre y sus propias hijas pasan al padre (un
 * solo nivel). Sin padre, `duration_seconds` null = permanente. La expiración se calcula en SQL.
 *
 * @param array{type: string, value: string, reason: ?string, added_by: string, parent_id?: ?int, duration_seconds?: ?int} $ban
 * @return array{id: int, ban_id: string, status: string} status: created | reactivated | in_force
 */
function banWrite(PDO $db, array $ban): array
{
    $parentId = $ban['parent_id'] ?? null;
    $inherited = $parentId === null ? null : banFind($db, $parentId)['expires_at'] ?? null;
    $values = [
        generateBanId(),
        $ban['reason'] === null || $ban['reason'] === '' ? null : mb_substr($ban['reason'], 0, BAN_REASON_MAX),
        mb_substr($ban['added_by'], 0, 100),
        $inherited,
        $parentId === null ? ($ban['duration_seconds'] ?? null) : null,
        $parentId,
        $ban['type'],
        $ban['value'],
    ];
    $expires = 'COALESCE(?, NOW() + INTERVAL ? SECOND)';

    $update = $db->prepare(
        "UPDATE blacklist SET ban_id = ?, reason = ?, added_by = ?, active = 1, expires_at = {$expires}, parent_id = ?, created_at = NOW()
         WHERE type = ? AND value = ? AND NOT " . banInForceSql()
    );
    $update->execute($values);
    $status = $update->rowCount() > 0 ? 'reactivated' : 'created';
    if ($status === 'created') {
        try {
            $db->prepare(
                "INSERT INTO blacklist (ban_id, reason, added_by, active, expires_at, parent_id, type, value, created_at)
                 VALUES (?, ?, ?, 1, {$expires}, ?, ?, ?, NOW())"
            )->execute($values);
        } catch (PDOException $e) {
            if (!isDuplicateKeyError($e)) {
                throw $e;
            }
            $status = 'in_force';
        }
    }

    $stmt = $db->prepare('SELECT id, ban_id FROM blacklist WHERE type = ? AND value = ?');
    $stmt->execute([$ban['type'], $ban['value']]);
    $row = $stmt->fetch();
    if (!is_array($row)) {
        throw new RuntimeException('No se pudo guardar el baneo.');
    }
    $id = (int) $row['id'];
    if ($parentId !== null && $status !== 'in_force') {
        $db->prepare('UPDATE blacklist SET parent_id = ? WHERE parent_id = ?')->execute([$parentId, $id]);
    }
    return ['id' => $id, 'ban_id' => (string) $row['ban_id'], 'status' => $status];
}

/**
 * Crea o reactiva un baneo (docs/API.md §1.4).
 *
 * - `manual`: si ya hay uno en vigor → 409. Si existe inactivo o expirado se reactiva con ban_id,
 *   motivo, autor, expiración y padre nuevos.
 * - `auto` (cuenta comprometida, FurrSecurity, evasión): uno en vigor no se toca; si no, se crea o
 *   reactiva como permanente (o con la expiración del padre si es hija). Siempre deja traza `security`.
 *
 * @param array{type: string, value: string, reason: ?string, added_by: string, parent_id?: ?int, duration_seconds?: ?int} $ban
 * @return array{id: int, ban_id: string, status: string}
 * @throws HttpError 409 en modo manual
 */
function upsertBan(PDO $db, array $ban, string $mode): array
{
    if ($mode === 'auto' && !array_key_exists('duration_seconds', $ban)) {
        $ban['duration_seconds'] = null; // permanente salvo que el llamante fije una duración
    }
    $result = banWrite($db, $ban);
    if ($mode === 'manual' && $result['status'] === 'in_force') {
        throw new HttpError(409, 'duplicate', 'Ya hay un baneo en vigor para ese valor.');
    }
    if ($mode === 'auto') {
        $labels = ['created' => 'creado', 'reactivated' => 'reactivado', 'in_force' => 'ya estaba en vigor'];
        logActivity($db, 'security', 'auto_ban', listActivityDetails(
            $ban['type'],
            $ban['value'],
            $result['ban_id'],
            $labels[$result['status']],
            'Motivo: ' . ($ban['reason'] ?? '—'),
            'Por ' . $ban['added_by']
        ));
    }
    return $result;
}

/**
 * Baneo manual desde el panel o un comando del plugin: 409 si ya hay uno en vigor; con `$stainIps`
 * (y tipo uuid/nick) sus IPs conocidas se banean como hijas. Deja traza y avisa a los plugins.
 *
 * @param array{type: string, value: string} $entry normalizado
 * @return array{id: int, ban_id: string, status: string, stained: int}
 */
function banAddManual(PDO $db, array $entry, ?string $reason, string $author, int $durationMinutes, bool $stainIps): array
{
    return withTransaction($db, static function (PDO $db) use ($entry, $reason, $author, $durationMinutes, $stainIps): array {
        $ban = upsertBan($db, $entry + [
            'reason' => $reason,
            'added_by' => $author,
            'duration_seconds' => $durationMinutes > 0 ? $durationMinutes * 60 : null,
        ], 'manual');
        $stained = $stainIps ? banStainIps($db, $entry + ['id' => $ban['id'], 'reason' => $reason, 'added_by' => $author]) : 0;
        logActivity($db, 'blacklist', $ban['status'] === 'reactivated' ? 'reactivate' : 'add', listActivityDetails(
            $entry['type'],
            $entry['value'],
            $ban['ban_id'],
            $durationMinutes > 0 ? "{$durationMinutes} min" : 'permanente',
            $stained > 0 ? "{$stained} IPs manchadas" : '',
            "Por {$author}"
        ));
        incrementCacheVersion($db);
        return $ban + ['stained' => $stained];
    });
}

/**
 * "IP manchada": las IPs conocidas de un jugador baneado por uuid o nick pasan a ser hijas del baneo
 * (IPv6 como /64; nunca IPs privadas). Las que ya tienen un baneo en vigor no se tocan.
 *
 * @param array{id: int, type: string, value: string, reason: ?string, added_by: string} $root
 * @return int hijas creadas o reactivadas
 */
function banStainIps(PDO $db, array $root): int
{
    $sql = match ($root['type']) {
        'uuid' => 'SELECT DISTINCT pi.ip FROM player_ips pi JOIN players p ON p.id = pi.player_id WHERE p.uuid = ?',
        'nick' => 'SELECT DISTINCT pi.ip FROM player_ips pi JOIN player_nicks pn ON pn.player_id = pi.player_id WHERE pn.nick = ?',
        default => null,
    };
    if ($sql === null) {
        return 0;
    }
    $stmt = $db->prepare($sql);
    $stmt->execute([$root['value']]);
    $targets = [];
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $ip) {
        $target = autoBanIpTarget((string) $ip);
        if ($target !== null) {
            $targets[$target['type'] . ' ' . $target['value']] = $target;
        }
    }
    $stained = 0;
    foreach ($targets as $target) {
        $child = banWrite($db, $target + ['reason' => $root['reason'], 'added_by' => $root['added_by'], 'parent_id' => $root['id']]);
        $stained += $child['status'] === 'in_force' ? 0 : 1;
    }
    return $stained;
}

/**
 * Activa o desactiva un baneo y sus hijas. Devuelve la fila previa o null si no existe.
 *
 * @return array<string, mixed>|null
 */
function banSetActive(PDO $db, int $id, bool $active): ?array
{
    $ban = banFind($db, $id);
    if ($ban !== null) {
        $db->prepare('UPDATE blacklist SET active = ? WHERE id = ? OR parent_id = ?')->execute([$active ? 1 : 0, $id, $id]);
    }
    return $ban;
}

/**
 * Cambia el motivo y, si `$durationMinutes` no es null, la expiración desde ahora (0 = permanente),
 * que se propaga a las hijas. Devuelve la fila previa o null si no existe.
 *
 * @return array<string, mixed>|null
 */
function banEdit(PDO $db, int $id, ?string $reason, ?int $durationMinutes): ?array
{
    $ban = banFind($db, $id);
    if ($ban === null) {
        return null;
    }
    $db->prepare('UPDATE blacklist SET reason = ? WHERE id = ?')->execute([$reason, $id]);
    if ($durationMinutes !== null) {
        $db->prepare('UPDATE blacklist SET expires_at = IF(? = 0, NULL, NOW() + INTERVAL ? MINUTE) WHERE id = ? OR parent_id = ?')
            ->execute([$durationMinutes, $durationMinutes, $id, $id]);
    }
    return $ban;
}

// ─── Coincidencias ──────────────────────────────────────────────────────────

/**
 * Baneo en vigor que afecta a una identidad, por prioridad uuid > nick > as > ip > ip_range
 * (los rangos se evalúan en PHP con ipInCidr).
 *
 * @param list<string> $uuids normalizados
 * @return array<string, mixed>|null
 */
function findActiveBan(PDO $db, array $uuids, ?string $nick, ?string $ip, ?string $asn): ?array
{
    [$conditions, $params] = listMatchConditions($uuids, $nick, $ip, $asn);
    $stmt = $db->prepare(
        'SELECT ' . BAN_COLUMNS . ' FROM blacklist WHERE ' . banInForceSql() . ' AND (' . implode(' OR ', $conditions) . ")
         ORDER BY FIELD(type, 'uuid', 'nick', 'as', 'ip', 'ip_range'), created_at DESC, id DESC"
    );
    $stmt->execute($params);
    return firstListMatch($stmt->fetchAll(), $ip);
}

/**
 * Entrada de whitelist que cubre una identidad (uuid, nick, ip, ip_range, as).
 *
 * @return array<string, mixed>|null
 */
function findWhitelistEntry(PDO $db, ?string $uuid, ?string $nick, ?string $ip, ?string $asn): ?array
{
    [$conditions, $params] = listMatchConditions($uuid === null ? [] : [$uuid], $nick, $ip, $asn);
    $stmt = $db->prepare(
        'SELECT id, type, value, reason, added_by, created_at FROM whitelist WHERE ' . implode(' OR ', $conditions)
        . " ORDER BY FIELD(type, 'uuid', 'nick', 'as', 'ip', 'ip_range'), id"
    );
    $stmt->execute($params);
    return firstListMatch($stmt->fetchAll(), $ip);
}

/**
 * @param list<string> $uuids
 * @return array{0: list<string>, 1: list<string>}
 */
function listMatchConditions(array $uuids, ?string $nick, ?string $ip, ?string $asn): array
{
    $conditions = ["type = 'ip_range'"];
    $params = [];
    if ($uuids !== []) {
        $conditions[] = "(type = 'uuid' AND value IN (" . sqlPlaceholders(count($uuids)) . '))';
        array_push($params, ...$uuids);
    }
    foreach (['nick' => $nick, 'as' => $asn, 'ip' => $ip] as $type => $value) {
        if ($value !== null) {
            $conditions[] = "(type = '{$type}' AND value = ?)";
            $params[] = $value;
        }
    }
    return [$conditions, $params];
}

/**
 * @param array<array-key, mixed> $rows ya ordenadas por prioridad
 * @return array<string, mixed>|null
 */
function firstListMatch(array $rows, ?string $ip): ?array
{
    foreach ($rows as $row) {
        if (is_array($row) && ($row['type'] !== 'ip_range' || ($ip !== null && ipInCidr($ip, (string) $row['value'])))) {
            return $row;
        }
    }
    return null;
}

/**
 * EXISTS de "jugador en whitelist/blacklist" (por uuid o último nick; en blacklist solo en vigor).
 */
function playerListedSql(string $table, string $playerAlias = 'p'): string
{
    $inForce = $table === 'blacklist' ? ' AND ' . banInForceSql('l') : '';
    return "EXISTS (SELECT 1 FROM {$table} l WHERE ((l.type = 'uuid' AND l.value = {$playerAlias}.uuid)"
        . " OR (l.type = 'nick' AND l.value = {$playerAlias}.last_nick)){$inForce})";
}

// ─── Whitelist ──────────────────────────────────────────────────────────────

/**
 * @throws HttpError 409 si ya existe
 */
function whitelistAdd(PDO $db, string $type, string $value, ?string $reason, string $addedBy): int
{
    try {
        $db->prepare('INSERT INTO whitelist (type, value, reason, added_by, created_at) VALUES (?, ?, ?, ?, NOW())')
            ->execute([$type, $value, $reason, mb_substr($addedBy, 0, 100)]);
    } catch (PDOException $e) {
        throw isDuplicateKeyError($e) ? new HttpError(409, 'duplicate', 'Ese valor ya está en la whitelist.') : $e;
    }
    return (int) $db->lastInsertId();
}
