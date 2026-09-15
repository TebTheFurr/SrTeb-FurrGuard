<?php

declare(strict_types=1);

/**
 * Normaliza los valores de whitelist/blacklist por tipo y `players.uuid` (docs/API.md §0).
 *
 * Si al normalizar dos filas chocan con el índice único, se conserva la activa más antigua (en
 * blacklist, activa = active=1 y sin caducar) y se borra la otra; las hijas del baneo descartado
 * pasan al conservado para que el borrado en cascada no se las lleve. Los valores que no se pueden
 * normalizar se dejan tal cual y se cuentan.
 */
return static function (PDO $db): void {
    $normalizers = [
        'uuid' => 'normalizeUuid',
        'nick' => static fn (string $value): ?string => trim($value) === '' ? null : trim($value),
        'ip' => 'normalizeIp',
        'ip_range' => 'normalizeCidr',
        'as' => 'normalizeAsn',
    ];

    foreach (['whitelist', 'blacklist'] as $table) {
        $stats = ['normalizadas' => 0, 'fusionadas' => 0, 'inválidas' => 0];
        $order = $table === 'blacklist'
            ? '(active = 1 AND (expires_at IS NULL OR expires_at > NOW())) DESC, created_at ASC, id ASC'
            : 'created_at ASC, id ASC';

        foreach ($db->query("SELECT id, type, value FROM {$table} ORDER BY id")->fetchAll() as $row) {
            $id = (int) $row['id'];
            $normalized = $normalizers[$row['type']]((string) $row['value']);
            if ($normalized === null) {
                $stats['inválidas']++;
                continue;
            }
            if ($normalized === $row['value']) {
                continue;
            }
            $exists = $db->prepare("SELECT COUNT(*) FROM {$table} WHERE id = ?");
            $exists->execute([$id]);
            if ((int) $exists->fetchColumn() === 0) {
                continue; // ya se fusionó con otra fila
            }

            $conflict = $db->prepare("SELECT id FROM {$table} WHERE type = ? AND value = ? AND id <> ?");
            $conflict->execute([$row['type'], $normalized, $id]);
            $otherId = $conflict->fetchColumn();
            if ($otherId === false) {
                $db->prepare("UPDATE {$table} SET value = ? WHERE id = ?")->execute([$normalized, $id]);
                $stats['normalizadas']++;
                continue;
            }

            $otherId = (int) $otherId;
            $keepId = (int) $db->query("SELECT id FROM {$table} WHERE id IN ({$id}, {$otherId}) ORDER BY {$order} LIMIT 1")->fetchColumn();
            $discardId = $keepId === $id ? $otherId : $id;
            if ($table === 'blacklist') {
                $parent = $db->query("SELECT parent_id FROM blacklist WHERE id = {$discardId}")->fetchColumn();
                $db->prepare('UPDATE blacklist SET parent_id = ? WHERE id = ? AND parent_id = ?')
                    ->execute([$parent === false ? null : $parent, $keepId, $discardId]);
                $db->prepare('UPDATE blacklist SET parent_id = ? WHERE parent_id = ?')->execute([$keepId, $discardId]);
            }
            $db->prepare("DELETE FROM {$table} WHERE id = ?")->execute([$discardId]);
            if ($keepId === $id) {
                $db->prepare("UPDATE {$table} SET value = ? WHERE id = ?")->execute([$normalized, $id]);
            }
            $stats['fusionadas']++;
        }
        migrationLog("  {$table}: " . json_encode($stats, JSON_UNESCAPED_UNICODE));
    }

    $stats = ['normalizadas' => 0, 'fusionadas' => 0, 'inválidas' => 0];
    foreach ($db->query('SELECT id, uuid FROM players ORDER BY id')->fetchAll() as $row) {
        $id = (int) $row['id'];
        $normalized = normalizeUuid((string) $row['uuid']);
        if ($normalized === null) {
            $stats['inválidas']++;
            continue;
        }
        if ($normalized === $row['uuid'] || (int) $db->query("SELECT COUNT(*) FROM players WHERE id = {$id}")->fetchColumn() === 0) {
            continue;
        }
        $conflict = $db->prepare('SELECT id FROM players WHERE uuid = ? AND id <> ?');
        $conflict->execute([$normalized, $id]);
        $otherId = $conflict->fetchColumn();
        if ($otherId === false) {
            $db->prepare('UPDATE players SET uuid = ? WHERE id = ?')->execute([$normalized, $id]);
            $stats['normalizadas']++;
            continue;
        }
        $otherId = (int) $otherId;
        $keepId = (int) $db->query("SELECT id FROM players WHERE id IN ({$id}, {$otherId}) ORDER BY first_seen ASC, id ASC LIMIT 1")->fetchColumn();
        $discardId = $keepId === $id ? $otherId : $id;
        $db->exec("UPDATE IGNORE player_nicks SET player_id = {$keepId} WHERE player_id = {$discardId}");
        $db->exec("UPDATE IGNORE player_ips SET player_id = {$keepId} WHERE player_id = {$discardId}");
        $db->exec(
            "UPDATE players k JOIN players d ON d.id = {$discardId}
             SET k.total_connections = COALESCE(k.total_connections, 0) + COALESCE(d.total_connections, 0),
                 k.first_seen = LEAST(k.first_seen, d.first_seen), k.last_seen = GREATEST(k.last_seen, d.last_seen)
             WHERE k.id = {$keepId}"
        );
        $db->exec("DELETE FROM players WHERE id = {$discardId}");
        if ($keepId === $id) {
            $db->prepare('UPDATE players SET uuid = ? WHERE id = ?')->execute([$normalized, $id]);
        }
        $stats['fusionadas']++;
    }
    migrationLog('  players: ' . json_encode($stats, JSON_UNESCAPED_UNICODE));
};
