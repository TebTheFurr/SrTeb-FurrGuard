<?php

declare(strict_types=1);

/**
 * FurrGuard - panel: whitelist, blacklist y sanciones (docs/API.md §1.4 y §4.4).
 */

if (!defined('FURRGUARD_ROOT')) {
    http_response_code(404);
    exit;
}

// ─── Whitelist ──────────────────────────────────────────────────────────────

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array{items: list<mixed>, pagination: array{page: int, per_page: int, total: int, total_pages: int}}
 */
function adminGetWhitelist(PDO $db, array $in, array $user): array
{
    $type = inputOptionalEnum($in, 'type', LIST_TYPES);
    [$where, $params] = adminWhere([$type === null ? null : ['type = ?', [$type]], adminSearchCondition($in, ['value', 'reason', 'added_by'])]);
    $list = adminPaginate($db, $in, 'id, type, value, reason, added_by, created_at', "FROM whitelist{$where}", $params, 'created_at DESC, id DESC');
    return ['items' => adminWithMinecraftNames($db, $list['items']), 'pagination' => $list['pagination']];
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array{id: int}
 */
function adminAddWhitelist(PDO $db, array $in, array $user): array
{
    $entry = inputListEntry($in);
    $reason = inputOptionalString($in, 'reason', BAN_REASON_MAX);
    return withTransaction($db, static function (PDO $db) use ($user, $entry, $reason): array {
        $id = whitelistAdd($db, $entry['type'], $entry['value'], $reason, adminActor($user));
        adminRecord($db, $user, 'whitelist', 'add', listActivityDetails($entry['type'], $entry['value']));
        return ['id' => $id];
    });
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 */
function adminEditWhitelist(PDO $db, array $in, array $user): null
{
    $id = inputInt($in, 'id', 1);
    $entry = inputListEntry($in);
    $reason = inputOptionalString($in, 'reason', BAN_REASON_MAX);
    withTransaction($db, static function (PDO $db) use ($user, $id, $entry, $reason): void {
        $current = adminFindRow($db, 'whitelist', $id, 'type, value') ?? adminNotFound('Entrada de whitelist no encontrada.');
        try {
            $db->prepare('UPDATE whitelist SET type = ?, value = ?, reason = ? WHERE id = ?')->execute([$entry['type'], $entry['value'], $reason, $id]);
        } catch (PDOException $e) {
            throw isDuplicateKeyError($e) ? new HttpError(409, 'duplicate', 'Ese valor ya está en la whitelist.') : $e;
        }
        adminRecord($db, $user, 'whitelist', 'edit', listActivityDetails($entry['type'], $entry['value'], "antes {$current['type']}: {$current['value']}"));
    });
    return null;
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 */
function adminRemoveWhitelist(PDO $db, array $in, array $user): null
{
    $id = inputInt($in, 'id', 1);
    withTransaction($db, static function (PDO $db) use ($user, $id): void {
        $entry = adminFindRow($db, 'whitelist', $id, 'type, value') ?? adminNotFound('Entrada de whitelist no encontrada.');
        $db->prepare('DELETE FROM whitelist WHERE id = ?')->execute([$id]);
        adminRecord($db, $user, 'whitelist', 'remove', listActivityDetails((string) $entry['type'], (string) $entry['value']));
    });
    return null;
}

// ─── Blacklist ──────────────────────────────────────────────────────────────

/**
 * Padres de la página con sus hijas (una sola consulta) y nombres de Minecraft con caché.
 *
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array{items: list<mixed>, pagination: array{page: int, per_page: int, total: int, total_pages: int}}
 */
function adminGetBlacklist(PDO $db, array $in, array $user): array
{
    $type = inputOptionalEnum($in, 'type', LIST_TYPES);
    $status = inputEnum($in, 'status', ['all', 'active', 'inactive', 'expired'], 'all');
    $search = adminSearchCondition($in, ['b.value', 'b.ban_id', 'b.reason', 'c.value']);
    [$where, $params] = adminWhere([
        ['b.parent_id IS NULL', []],
        $type === null ? null : ['b.type = ?', [$type]],
        $status === 'all' ? null : [banStateSql($status, 'b'), []],
        $search === null ? null : [
            str_replace(' OR c.value LIKE ?', ' OR EXISTS (SELECT 1 FROM blacklist c WHERE c.parent_id = b.id AND c.value LIKE ?)', $search[0]),
            $search[1],
        ],
    ]);
    $list = adminPaginate(
        $db,
        $in,
        'b.id, b.ban_id, b.type, b.value, b.reason, b.added_by, b.active, b.expires_at, b.created_at',
        "FROM blacklist b{$where}",
        $params,
        'b.created_at DESC, b.id DESC'
    );

    $children = [];
    $ids = array_column($list['items'], 'id');
    if ($ids !== []) {
        $stmt = $db->prepare('SELECT id, parent_id, ban_id, type, value, active, expires_at FROM blacklist WHERE parent_id IN (' . sqlPlaceholders(count($ids)) . ') ORDER BY created_at, id');
        $stmt->execute($ids);
        foreach ($stmt->fetchAll() as $child) {
            $children[(int) $child['parent_id']][] = $child;
        }
    }
    $items = array_map(
        static fn (mixed $row): mixed => is_array($row) ? $row + ['children' => $children[(int) $row['id']] ?? []] : $row,
        adminWithMinecraftNames($db, $list['items'])
    );
    return ['items' => $items, 'pagination' => $list['pagination']];
}

/**
 * @param array<string, mixed> $in
 * @return array{0: ?string, 1: int, 2: bool} motivo, minutos (0 = permanente) y manchar IPs
 */
function adminBanOptions(array $in): array
{
    return [
        inputOptionalString($in, 'reason', BAN_REASON_MAX),
        inputInt($in, 'duration_minutes', 0, BAN_MAX_DURATION_MINUTES, 0),
        inputBool($in, 'stain_ip', false),
    ];
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array{id: int, ban_id: string, reactivated: bool}
 */
function adminAddBlacklist(PDO $db, array $in, array $user): array
{
    $entry = inputListEntry($in);
    [$reason, $minutes, $stain] = adminBanOptions($in);
    $ban = banAddManual($db, $entry, $reason, adminActor($user), $minutes, $stain);
    return ['id' => $ban['id'], 'ban_id' => $ban['ban_id'], 'reactivated' => $ban['status'] === 'reactivated'];
}

/**
 * Baneo por nombre: el servidor decide con Mojang (caché) si es premium (UUID) o no (nick). Cualquier
 * uuid/is_premium del cliente se ignora. Si Mojang no responde no se banea (B4).
 *
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array<string, mixed>
 */
function adminAddBlacklistUnified(PDO $db, array $in, array $user): array
{
    $name = inputNick($in, 'player_name');
    [$reason, $minutes, $stain] = adminBanOptions($in);
    $profile = minecraftProfileByName($db, $name);
    if ($profile['status'] === 'unknown') {
        throw new HttpError(503, 'mojang_unavailable', 'Mojang no responde y no se puede saber si la cuenta es premium. Inténtalo en unos minutos o usa el baneo avanzado.');
    }
    $premium = $profile['status'] === 'premium';
    $entry = $premium ? ['type' => 'uuid', 'value' => (string) $profile['uuid']] : ['type' => 'nick', 'value' => $name];
    $ban = banAddManual($db, $entry, $reason, adminActor($user), $minutes, $stain);
    return [
        'id' => $ban['id'],
        'ban_id' => $ban['ban_id'],
        'type' => $entry['type'],
        'value' => $entry['value'],
        'is_premium' => $premium,
        'player_name' => $premium ? $profile['name'] : $name,
    ];
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 */
function adminEditBlacklist(PDO $db, array $in, array $user): null
{
    $id = inputInt($in, 'id', 1);
    $reason = inputOptionalString($in, 'reason', BAN_REASON_MAX);
    $minutes = inputOptionalInt($in, 'duration_minutes', 0, BAN_MAX_DURATION_MINUTES);
    withTransaction($db, static function (PDO $db) use ($user, $id, $reason, $minutes): void {
        $ban = banEdit($db, $id, $reason, $minutes) ?? adminNotFound('Baneo no encontrado.');
        $expiry = match (true) {
            $minutes === null => 'expiración sin cambios',
            $minutes === 0 => 'ahora permanente, con sus hijas',
            default => "expira en {$minutes} min, con sus hijas",
        };
        adminRecord($db, $user, 'blacklist', 'edit', listActivityDetails((string) $ban['type'], (string) $ban['value'], (string) $ban['ban_id'], $expiry));
    });
    return null;
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 */
function adminSetBlacklistActive(PDO $db, array $in, array $user): null
{
    $id = inputInt($in, 'id', 1);
    $active = inputBool($in, 'active');
    withTransaction($db, static function (PDO $db) use ($user, $id, $active): void {
        $ban = banSetActive($db, $id, $active) ?? adminNotFound('Baneo no encontrado.');
        adminRecord($db, $user, 'blacklist', $active ? 'enable' : 'disable', listActivityDetails((string) $ban['type'], (string) $ban['value'], (string) $ban['ban_id'], 'con sus hijas'));
    });
    return null;
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 */
function adminRemoveBlacklist(PDO $db, array $in, array $user): null
{
    $id = inputInt($in, 'id', 1);
    withTransaction($db, static function (PDO $db) use ($user, $id): void {
        $ban = banFind($db, $id) ?? adminNotFound('Baneo no encontrado.');
        $children = $db->prepare('SELECT COUNT(*) FROM blacklist WHERE parent_id = ?');
        $children->execute([$id]);
        $childCount = (int) $children->fetchColumn();
        $db->prepare('DELETE FROM blacklist WHERE id = ?')->execute([$id]);
        adminRecord($db, $user, 'blacklist', 'remove', listActivityDetails((string) $ban['type'], (string) $ban['value'], (string) $ban['ban_id'], "{$childCount} hijas borradas"));
    });
    return null;
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array{id: int}
 */
function adminAddBlacklistIp(PDO $db, array $in, array $user): array
{
    $parentId = inputInt($in, 'parent_id', 1);
    $ip = inputIp($in);
    return withTransaction($db, static function (PDO $db) use ($user, $parentId, $ip): array {
        $parent = banFind($db, $parentId) ?? adminNotFound('Baneo padre no encontrado.');
        if ($parent['parent_id'] !== null) {
            throw new ValidationError('Solo se pueden añadir IPs a un baneo principal.', 'parent_id');
        }
        $child = upsertBan($db, [
            'type' => 'ip',
            'value' => $ip,
            'reason' => is_string($parent['reason']) ? $parent['reason'] : null,
            'added_by' => adminActor($user),
            'parent_id' => $parentId,
        ], 'manual');
        adminRecord($db, $user, 'blacklist', 'add_ip', listActivityDetails('ip', $ip, "hija de {$parent['ban_id']} ({$parent['type']} {$parent['value']})"));
        return ['id' => $child['id']];
    });
}

// ─── Sanciones ──────────────────────────────────────────────────────────────

/**
 * Todos los baneos (padres e hijas). `stats` usa los mismos criterios que los filtros.
 *
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array<string, mixed>
 */
function adminGetSanctions(PDO $db, array $in, array $user): array
{
    $filter = inputEnum($in, 'filter', BAN_STATES, 'all');
    [$where, $params] = adminWhere([
        $filter === 'all' ? null : [banStateSql($filter), []],
        adminSearchCondition($in, ['ban_id', 'value', 'reason', 'added_by']),
    ]);
    $list = adminPaginate($db, $in, 'id, ban_id, type, value, reason, added_by, active, expires_at, parent_id, created_at', "FROM blacklist{$where}", $params, 'created_at DESC, id DESC');
    $states = ['active', 'expired', 'inactive', 'permanent', 'temporary'];
    $stats = adminIntRow($db, 'SELECT COUNT(*) AS total, ' . implode(', ', array_map(
        static fn (string $state): string => 'COALESCE(SUM(' . banStateSql($state) . "), 0) AS {$state}",
        $states
    )) . ' FROM blacklist');
    return ['items' => adminWithMinecraftNames($db, $list['items']), 'pagination' => $list['pagination'], 'stats' => $stats];
}
