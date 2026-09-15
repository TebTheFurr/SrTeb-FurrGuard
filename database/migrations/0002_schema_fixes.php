<?php

declare(strict_types=1);

/**
 * Correcciones de esquema de la auditoría (sección 3). Cada cambio comprueba el estado actual,
 * así que se puede repetir sin efecto. TIMESTAMP → DATETIME con la sesión en UTC (sin desplazar
 * valores): evita el límite de 2038 y los ON UPDATE implícitos. Solo `updated_at` conserva ON UPDATE.
 */
return static function (PDO $db): void {
    $datetime = static fn (string $table, string $column, bool $nullable = false, ?string $default = 'CURRENT_TIMESTAMP', bool $onUpdate = false): ?string
        => datetimeColumnClause($db, $table, $column, $nullable, $default, $onUpdate);
    $created = static fn (string $table): ?string => $datetime($table, 'created_at');
    $updated = static fn (string $table): ?string => $datetime($table, 'updated_at', false, 'CURRENT_TIMESTAMP', true);

    foreach (['settings', 'messages', 'blocked_providers', 'blocked_countries', 'blocked_continents', 'fur_perms_whitelist'] as $table) {
        dbAlter($db, $table, [$created($table), $updated($table)]);
    }
    foreach (['admin_users', 'fur_perms_command_logs'] as $table) {
        dbAlter($db, $table, [$created($table)]);
    }

    // players: last_seen sin ON UPDATE (marcar desconectado no es "visto"); el estado de listas se
    // calcula con EXISTS.
    dbAlter($db, 'players', [
        $datetime('players', 'first_seen'),
        $datetime('players', 'last_seen'),
        dropColumnClause($db, 'players', 'is_whitelisted'),
        dropColumnClause($db, 'players', 'is_blacklisted'),
        addIndexClause($db, 'players', 'idx_first_nick', 'first_nick'),
    ]);
    foreach (['player_nicks', 'player_ips'] as $table) {
        dbAlter($db, $table, [$datetime($table, 'first_used'), $datetime($table, 'last_used')]);
    }
    dbAlter($db, 'player_connections', [
        $created('player_connections'),
        addIndexClause($db, 'player_connections', 'idx_uuid_created', 'uuid, created_at'),
        dropIndexClause($db, 'player_connections', 'idx_uuid'),
    ]);

    // Listas: uk_type_value ya empieza por type.
    foreach (['whitelist', 'blacklist'] as $table) {
        dbAlter($db, $table, [
            $created($table),
            $updated($table),
            addIndexClause($db, $table, 'idx_created_at', 'created_at'),
            dropIndexClause($db, $table, 'idx_type'),
        ]);
    }

    dbAlter($db, 'activity_logs', [
        $created('activity_logs'),
        addIndexClause($db, 'activity_logs', 'idx_type_created', 'type, created_at'),
        dropIndexClause($db, 'activity_logs', 'idx_type'),
    ]);
    $renamed = $db->exec("UPDATE activity_logs SET type = 'auth' WHERE type = 'login'");
    migrationLog("  activity_logs login → auth: {$renamed}");

    // Caché de nombres por UUID: caché negativa (username NULL + status) y expires_at sin ON UPDATE.
    $username = dbColumnInfo($db, 'minecraft_names_cache', 'username');
    dbAlter($db, 'minecraft_names_cache', [
        $username !== null && !$username['nullable'] ? 'MODIFY COLUMN `username` VARCHAR(16) NULL DEFAULT NULL' : null,
        addColumnClause($db, 'minecraft_names_cache', 'status', "ENUM('premium','not_found') NOT NULL DEFAULT 'premium' AFTER `username`"),
        $datetime('minecraft_names_cache', 'expires_at', true, null),
        $created('minecraft_names_cache'),
        $updated('minecraft_names_cache'),
    ]);

    $db->exec("CREATE TABLE IF NOT EXISTS minecraft_profiles (
        lookup_name VARCHAR(16) NOT NULL,
        status ENUM('premium','not_found') NOT NULL,
        uuid CHAR(36) NULL DEFAULT NULL,
        name VARCHAR(16) NULL DEFAULT NULL,
        checked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        PRIMARY KEY (lookup_name),
        KEY idx_uuid (uuid),
        KEY idx_expires_at (expires_at)
    ) " . TABLE_OPTIONS);

    // Sesiones del panel (§5): solo el hash del token, IP aprendida por familia, inactividad y
    // revocación. Las sesiones antiguas no son compatibles: se descartan (hay que volver a entrar).
    if (!dbColumnExists($db, 'admin_sessions', 'session_token_hash')) {
        $db->exec('DROP TABLE IF EXISTS admin_sessions');
        $db->exec('CREATE TABLE admin_sessions (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            discord_id VARCHAR(20) NOT NULL,
            discord_username VARCHAR(100) NULL DEFAULT NULL,
            discord_avatar VARCHAR(255) NULL DEFAULT NULL,
            session_token_hash CHAR(64) NOT NULL,
            ipv4_address VARCHAR(15) NULL DEFAULT NULL,
            ipv6_address VARCHAR(45) NULL DEFAULT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            revoked_at DATETIME NULL DEFAULT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uk_session_token_hash (session_token_hash),
            KEY idx_discord_id (discord_id),
            KEY idx_expires_at (expires_at)
        ) ' . TABLE_OPTIONS);
        migrationLog('  admin_sessions rehecha');
    }

    dbAlter($db, 'ip_cache', [dropIndexClause($db, 'ip_cache', 'idx_ip')]);
    if (dbTableCollation($db, 'ip_api_logs') !== 'utf8mb4_unicode_ci') {
        $db->exec('ALTER TABLE ip_api_logs CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        migrationLog('  ip_api_logs → utf8mb4_unicode_ci');
    }

    dbAlter($db, 'furrsecurity_staff', [
        dropIndexClause($db, 'furrsecurity_staff', 'idx_discord_id'),
        dropIndexClause($db, 'furrsecurity_staff', 'idx_nick'),
    ]);
    dbAlter($db, 'furrsecurity_verifications', [
        addIndexClause($db, 'furrsecurity_verifications', 'idx_uuid_status_expires', 'uuid, status, expires_at'),
        dropIndexClause($db, 'furrsecurity_verifications', 'idx_token'),
        dropIndexClause($db, 'furrsecurity_verifications', 'idx_uuid'),
    ]);

    // Intentos fallidos: inicio de la ventana (furrsecurity_failed_attempts_window).
    if (!dbColumnExists($db, 'furrsecurity_failed_attempts', 'window_started_at')) {
        $db->exec('ALTER TABLE furrsecurity_failed_attempts
            ADD COLUMN window_started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER failed_attempts');
        $db->exec('UPDATE furrsecurity_failed_attempts SET window_started_at = last_attempt WHERE last_attempt IS NOT NULL');
    }
};
