<?php

declare(strict_types=1);

/**
 * FurrGuard - panel: migraciones de mantenimiento por lotes (B7). `cursor` = último id procesado,
 * `batch_size` ≤ 25. Un estado desconocido de Mojang (429, red) se salta: nunca se decide con él y un
 * baneo por UUID premium nunca pasa a nick.
 */

if (!defined('FURRGUARD_ROOT')) {
    http_response_code(404);
    exit;
}

const MIGRATION_MAX_BATCH = 25;

/**
 * @param array<string, mixed> $in
 * @return array{0: int, 1: int} cursor y tamaño de lote
 */
function adminMigrationParams(array $in): array
{
    return [inputInt($in, 'cursor', 0, PHP_INT_MAX, 0), inputInt($in, 'batch_size', 1, MIGRATION_MAX_BATCH, MIGRATION_MAX_BATCH)];
}

/**
 * @param list<mixed> $rows
 * @param array{processed: int, skipped: int, changed: int, details: list<string>} $stats
 * @return array<string, mixed>
 */
function adminMigrationResult(array $rows, int $batch, int $total, array $stats): array
{
    $last = $rows === [] ? null : $rows[count($rows) - 1];
    return $stats + ['next_cursor' => count($rows) === $batch && is_array($last) ? (int) $last['id'] : null, 'total' => $total];
}

/**
 * premium | not_found | unknown de un UUID, con la caché de nombres de minecraft.php.
 */
function minecraftUuidStatus(PDO $db, string $uuid): string
{
    $cached = minecraftNameCacheRows($db, [$uuid])[$uuid] ?? null;
    return $cached !== null && $cached['fresh'] ? $cached['status'] : minecraftFetchNameByUuid($db, $uuid)['status'];
}

/**
 * Premium → uuid, no premium → nick, fusionando duplicados.
 *
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array<string, mixed>
 */
function adminMigrateBlacklist(PDO $db, array $in, array $user): array
{
    [$cursor, $batch] = adminMigrationParams($in);
    $scope = "FROM blacklist WHERE parent_id IS NULL AND type IN ('uuid', 'nick') AND id > ?";
    $count = $db->prepare("SELECT COUNT(*) {$scope}");
    $count->execute([$cursor]);
    $stmt = $db->prepare("SELECT id, ban_id, type, value {$scope} ORDER BY id LIMIT {$batch}");
    $stmt->execute([$cursor]);
    $rows = $stmt->fetchAll();

    $stats = ['processed' => 0, 'skipped' => 0, 'changed' => 0, 'details' => []];
    foreach ($rows as $ban) {
        [$outcome, $detail] = migrateBanIdentity($db, $user, $ban);
        $stats['processed']++;
        if ($outcome !== 'kept') {
            $stats[$outcome]++;
            $stats['details'][] = $detail;
        }
    }
    if ($stats['processed'] > 0) {
        adminRecord($db, $user, 'settings', 'migrate_blacklist', "Lote de blacklist: {$stats['processed']} revisados, {$stats['changed']} cambiados, {$stats['skipped']} omitidos", $stats['changed'] > 0);
    }
    return adminMigrationResult($rows, $batch, (int) $count->fetchColumn(), $stats);
}

/**
 * @param AdminUser $user
 * @param array<string, mixed> $ban
 * @return array{0: string, 1: string} kept | changed | skipped y detalle
 */
function migrateBanIdentity(PDO $db, array $user, array $ban): array
{
    $label = "{$ban['ban_id']} {$ban['type']}: {$ban['value']}";
    if ($ban['type'] === 'nick') {
        $profile = minecraftProfileByName($db, (string) $ban['value']);
        return match ($profile['status']) {
            'premium' => migrateBanTo($db, $user, $ban, 'uuid', (string) $profile['uuid'], $label),
            'not_found' => ['kept', "{$label}: no premium"],
            default => ['skipped', "{$label}: Mojang no responde, omitido"],
        };
    }
    $uuid = (string) $ban['value'];
    if (isMojangUuid($uuid)) {
        $status = minecraftUuidStatus($db, $uuid);
        return $status === 'premium'
            ? ['kept', "{$label}: premium"]
            : ['skipped', "{$label}: " . ($status === 'unknown' ? 'Mojang no responde' : 'UUID desconocido en Mojang') . ', omitido'];
    }
    $nick = $db->prepare('SELECT last_nick FROM players WHERE uuid = ?');
    $nick->execute([$uuid]);
    $name = $nick->fetchColumn();
    if (!is_string($name)) {
        return ['skipped', "{$label}: UUID offline sin nick conocido, omitido"];
    }
    $profile = minecraftProfileByName($db, $name);
    return match ($profile['status']) {
        'not_found' => migrateBanTo($db, $user, $ban, 'nick', $name, $label),
        'premium' => ['skipped', "{$label}: el nick {$name} es ahora de una cuenta premium, omitido"],
        default => ['skipped', "{$label}: Mojang no responde, omitido"],
    };
}

/**
 * Cambia el tipo/valor de un baneo raíz. Si ya existe otro con el destino se fusionan: queda el que
 * esté en vigor (o el existente) y recibe las hijas del otro.
 *
 * @param AdminUser $user
 * @param array<string, mixed> $ban
 * @return array{0: string, 1: string}
 */
function migrateBanTo(PDO $db, array $user, array $ban, string $type, string $value, string $label): array
{
    return withTransaction($db, static function (PDO $db) use ($user, $ban, $type, $value, $label): array {
        $id = (int) $ban['id'];
        $stmt = $db->prepare('SELECT id, ban_id, parent_id, ' . banInForceSql() . ' AS in_force FROM blacklist WHERE type = ? AND value = ? AND id <> ?');
        $stmt->execute([$type, $value, $id]);
        $existing = $stmt->fetch();
        if (!is_array($existing)) {
            $db->prepare('UPDATE blacklist SET type = ?, value = ? WHERE id = ?')->execute([$type, $value, $id]);
            adminRecord($db, $user, 'blacklist', 'edit', listActivityDetails($type, $value, (string) $ban['ban_id'], "migrado desde {$ban['type']} {$ban['value']}"), false);
            return ['changed', "{$label} → {$type}: {$value}"];
        }
        $inForce = $db->prepare('SELECT ' . banInForceSql() . ' FROM blacklist WHERE id = ?');
        $inForce->execute([$id]);
        if ((int) $inForce->fetchColumn() === 1 && (int) $existing['in_force'] !== 1 && $existing['parent_id'] === null) {
            $db->prepare('UPDATE blacklist SET parent_id = ? WHERE parent_id = ?')->execute([$id, $existing['id']]);
            $db->prepare('DELETE FROM blacklist WHERE id = ?')->execute([$existing['id']]);
            $db->prepare('UPDATE blacklist SET type = ?, value = ? WHERE id = ?')->execute([$type, $value, $id]);
            adminRecord($db, $user, 'blacklist', 'edit', listActivityDetails($type, $value, (string) $ban['ban_id'], "fusionado con {$existing['ban_id']}"), false);
            return ['changed', "{$label} → {$type}: {$value} (sustituye a {$existing['ban_id']}, que no estaba en vigor)"];
        }
        $rootId = (int) ($existing['parent_id'] ?? $existing['id']);
        $db->prepare('UPDATE blacklist SET parent_id = ? WHERE parent_id = ?')->execute([$rootId, $id]);
        $db->prepare('DELETE FROM blacklist WHERE id = ?')->execute([$id]);
        adminRecord($db, $user, 'blacklist', 'remove', listActivityDetails((string) $ban['type'], (string) $ban['value'], (string) $ban['ban_id'], "duplicado de {$existing['ban_id']} ({$type} {$value})"), false);
        return ['changed', "{$label}: duplicado de {$existing['ban_id']} ({$type}: {$value}), fusionado"];
    });
}

/**
 * Jugadores con UUID offline cuyo último nick es premium pasan a su UUID premium (si nadie más lo usa).
 *
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array<string, mixed>
 */
function adminMigratePlayers(PDO $db, array $in, array $user): array
{
    [$cursor, $batch] = adminMigrationParams($in);
    $count = $db->prepare('SELECT COUNT(*) FROM players WHERE id > ?');
    $count->execute([$cursor]);
    $stmt = $db->prepare("SELECT id, uuid, last_nick FROM players WHERE id > ? ORDER BY id LIMIT {$batch}");
    $stmt->execute([$cursor]);
    $rows = $stmt->fetchAll();

    $stats = ['processed' => 0, 'skipped' => 0, 'changed' => 0, 'details' => []];
    foreach ($rows as $player) {
        $stats['processed']++;
        $nick = (string) $player['last_nick'];
        $uuid = (string) $player['uuid'];
        $profile = minecraftProfileByName($db, $nick);
        if ($profile['status'] === 'unknown') {
            $stats['skipped']++;
            $stats['details'][] = "{$nick}: Mojang no responde, omitido";
            continue;
        }
        if ($profile['status'] !== 'premium' || $profile['uuid'] === $uuid) {
            continue;
        }
        if (isMojangUuid($uuid)) {
            $stats['skipped']++;
            $stats['details'][] = "{$nick}: su UUID premium es otro ({$uuid}); el nombre es de otra cuenta, omitido";
            continue;
        }
        $taken = $db->prepare('SELECT COUNT(*) FROM players WHERE uuid = ?');
        $taken->execute([$profile['uuid']]);
        if ((int) $taken->fetchColumn() > 0) {
            $stats['skipped']++;
            $stats['details'][] = "{$nick}: el UUID premium {$profile['uuid']} ya es de otro jugador, omitido";
            continue;
        }
        $db->prepare('UPDATE players SET uuid = ? WHERE id = ?')->execute([$profile['uuid'], $player['id']]);
        $stats['changed']++;
        $stats['details'][] = "{$nick}: {$uuid} → {$profile['uuid']}";
    }
    if ($stats['processed'] > 0) {
        adminRecord($db, $user, 'players', 'migrate_players', "Lote de jugadores: {$stats['processed']} revisados, {$stats['changed']} cambiados, {$stats['skipped']} omitidos", false);
    }
    return adminMigrationResult($rows, $batch, (int) $count->fetchColumn(), $stats);
}
