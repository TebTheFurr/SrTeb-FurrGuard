<?php

declare(strict_types=1);

/**
 * Esquema "legado": el de install.sql + los .sql de los módulos + las tablas que solo existían en
 * producción (DDL tomado de SHOW CREATE TABLE de producción). Todo con IF NOT EXISTS y semillas que
 * solo insertan lo que falta, para que instalación limpia y actualización sigan el mismo camino.
 * Las correcciones de esquema van en 0002.
 */
return static function (PDO $db): void {
    $options = TABLE_OPTIONS;
    $tables = [
        'settings' => "CREATE TABLE IF NOT EXISTS settings (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `key` VARCHAR(100) NOT NULL,
            value TEXT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uk_key (`key`)
        ) {$options}",
        'messages' => "CREATE TABLE IF NOT EXISTS messages (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            `key` VARCHAR(100) NOT NULL,
            value TEXT NOT NULL,
            description VARCHAR(255) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uk_key (`key`)
        ) {$options}",
        'players' => "CREATE TABLE IF NOT EXISTS players (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            uuid VARCHAR(36) NOT NULL,
            first_nick VARCHAR(16) NOT NULL,
            last_nick VARCHAR(16) NOT NULL,
            first_ip VARCHAR(45) NULL,
            last_ip VARCHAR(45) NULL,
            last_country VARCHAR(100) NULL,
            last_country_code VARCHAR(5) NULL,
            is_online TINYINT(1) NULL DEFAULT 0,
            is_whitelisted TINYINT(1) NULL DEFAULT 0,
            is_blacklisted TINYINT(1) NULL DEFAULT 0,
            total_connections INT UNSIGNED NULL DEFAULT 1,
            first_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_seen TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uk_uuid (uuid),
            KEY idx_last_nick (last_nick),
            KEY idx_is_online (is_online),
            KEY idx_last_seen (last_seen)
        ) {$options}",
        'player_nicks' => "CREATE TABLE IF NOT EXISTS player_nicks (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            player_id INT UNSIGNED NOT NULL,
            nick VARCHAR(16) NOT NULL,
            first_used TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_used TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uk_player_nick (player_id, nick),
            KEY idx_nick (nick),
            CONSTRAINT fk_nick_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
        ) {$options}",
        'player_ips' => "CREATE TABLE IF NOT EXISTS player_ips (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            player_id INT UNSIGNED NOT NULL,
            ip VARCHAR(45) NOT NULL,
            country VARCHAR(100) NULL,
            country_code VARCHAR(5) NULL,
            isp VARCHAR(255) NULL,
            asn VARCHAR(255) NULL,
            first_used TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_used TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uk_player_ip (player_id, ip),
            KEY idx_ip (ip),
            CONSTRAINT fk_ip_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
        ) {$options}",
        'player_connections' => "CREATE TABLE IF NOT EXISTS player_connections (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            uuid VARCHAR(36) NULL,
            nick VARCHAR(16) NOT NULL,
            ip VARCHAR(45) NOT NULL,
            ip_version ENUM('ipv4','ipv6') NULL DEFAULT 'ipv4',
            country VARCHAR(100) NULL,
            country_code VARCHAR(5) NULL,
            region VARCHAR(100) NULL,
            city VARCHAR(100) NULL,
            isp VARCHAR(255) NULL,
            org VARCHAR(255) NULL,
            asn VARCHAR(255) NULL,
            asname VARCHAR(255) NULL,
            is_proxy TINYINT(1) NULL DEFAULT 0,
            is_vpn TINYINT(1) NULL DEFAULT 0,
            is_hosting TINYINT(1) NULL DEFAULT 0,
            is_mobile TINYINT(1) NULL DEFAULT 0,
            latitude DECIMAL(10,8) NULL,
            longitude DECIMAL(11,8) NULL,
            timezone VARCHAR(50) NULL,
            game_version VARCHAR(20) NULL,
            blocked TINYINT(1) NULL DEFAULT 0,
            block_reason VARCHAR(100) NULL,
            raw_data JSON NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_uuid (uuid),
            KEY idx_nick (nick),
            KEY idx_ip (ip),
            KEY idx_blocked (blocked),
            KEY idx_created_at (created_at)
        ) {$options}",
        'whitelist' => "CREATE TABLE IF NOT EXISTS whitelist (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            type ENUM('uuid','nick','ip','as','ip_range') NOT NULL,
            value VARCHAR(255) NOT NULL,
            reason TEXT NULL,
            added_by VARCHAR(100) NULL DEFAULT 'System',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uk_type_value (type, value),
            KEY idx_type (type),
            KEY idx_value (value)
        ) {$options}",
        'blacklist' => "CREATE TABLE IF NOT EXISTS blacklist (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            ban_id VARCHAR(12) NOT NULL,
            type ENUM('uuid','nick','ip','as','ip_range') NOT NULL,
            value VARCHAR(255) NOT NULL,
            reason TEXT NULL,
            added_by VARCHAR(100) NULL DEFAULT 'System',
            active TINYINT(1) NULL DEFAULT 1,
            expires_at DATETIME NULL DEFAULT NULL,
            parent_id INT UNSIGNED NULL DEFAULT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uk_ban_id (ban_id),
            UNIQUE KEY uk_type_value (type, value),
            KEY idx_type (type),
            KEY idx_value (value),
            KEY idx_active (active),
            KEY idx_expires_at (expires_at),
            KEY idx_parent_id (parent_id),
            CONSTRAINT fk_blacklist_parent FOREIGN KEY (parent_id) REFERENCES blacklist (id) ON DELETE CASCADE
        ) {$options}",
        'blocked_providers' => "CREATE TABLE IF NOT EXISTS blocked_providers (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            name VARCHAR(255) NOT NULL,
            pattern VARCHAR(255) NOT NULL,
            type ENUM('hosting','vpn','proxy') NOT NULL,
            block_count INT UNSIGNED NULL DEFAULT 0,
            active TINYINT(1) NULL DEFAULT 1,
            added_by VARCHAR(100) NULL DEFAULT 'System',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uk_pattern_type (pattern, type),
            KEY idx_type (type),
            KEY idx_active (active)
        ) {$options}",
        'blocked_countries' => "CREATE TABLE IF NOT EXISTS blocked_countries (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            country_code CHAR(2) NOT NULL,
            country_name VARCHAR(100) NOT NULL,
            kick_message TEXT NULL,
            block_count INT UNSIGNED NULL DEFAULT 0,
            active TINYINT(1) NULL DEFAULT 1,
            added_by VARCHAR(100) NULL DEFAULT 'System',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uk_country_code (country_code),
            KEY idx_active (active)
        ) {$options}",
        'blocked_continents' => "CREATE TABLE IF NOT EXISTS blocked_continents (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            continent_code CHAR(2) NOT NULL,
            continent_name VARCHAR(100) NOT NULL,
            kick_message TEXT NULL,
            block_count INT UNSIGNED NULL DEFAULT 0,
            active TINYINT(1) NULL DEFAULT 1,
            added_by VARCHAR(100) NULL DEFAULT 'System',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uk_continent_code (continent_code),
            KEY idx_active (active)
        ) {$options}",
        'activity_logs' => "CREATE TABLE IF NOT EXISTS activity_logs (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            type VARCHAR(50) NOT NULL,
            action VARCHAR(100) NOT NULL,
            details TEXT NULL,
            ip_address VARCHAR(45) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_type (type),
            KEY idx_created_at (created_at)
        ) {$options}",
        'minecraft_names_cache' => "CREATE TABLE IF NOT EXISTS minecraft_names_cache (
            uuid CHAR(36) NOT NULL,
            username VARCHAR(16) NOT NULL,
            expires_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (uuid),
            KEY idx_expires_at (expires_at)
        ) {$options}",
        'admin_sessions' => "CREATE TABLE IF NOT EXISTS admin_sessions (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            discord_id VARCHAR(20) NOT NULL,
            discord_username VARCHAR(100) NULL,
            discord_avatar VARCHAR(255) NULL,
            session_token VARCHAR(255) NOT NULL,
            ip_address VARCHAR(45) NULL,
            expires_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uk_session_token (session_token),
            KEY idx_discord_id (discord_id),
            KEY idx_expires_at (expires_at)
        ) {$options}",
        'admin_users' => "CREATE TABLE IF NOT EXISTS admin_users (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            discord_id VARCHAR(20) NOT NULL,
            role ENUM('founder','owner','manager','sradmin','admin') NOT NULL DEFAULT 'admin',
            created_by VARCHAR(20) NULL DEFAULT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uk_discord_id (discord_id)
        ) {$options}",
        'ip_cache' => "CREATE TABLE IF NOT EXISTS ip_cache (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            ip VARCHAR(45) NOT NULL,
            data JSON NOT NULL,
            status ENUM('success','fail','cached') NOT NULL DEFAULT 'success',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            hit_count INT UNSIGNED NOT NULL DEFAULT 1,
            PRIMARY KEY (id),
            UNIQUE KEY ip (ip),
            KEY idx_ip (ip),
            KEY idx_expires (expires_at)
        ) {$options}",
        'ip_api_logs' => "CREATE TABLE IF NOT EXISTS ip_api_logs (
            id INT NOT NULL AUTO_INCREMENT,
            ip VARCHAR(45) NOT NULL,
            success TINYINT(1) NOT NULL,
            created_at DATETIME NOT NULL,
            PRIMARY KEY (id),
            KEY idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci",
        'fur_perms_whitelist' => "CREATE TABLE IF NOT EXISTS fur_perms_whitelist (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            nick VARCHAR(16) NOT NULL,
            uuid VARCHAR(36) NULL,
            added_by VARCHAR(100) NULL DEFAULT 'System',
            reason TEXT NULL,
            active TINYINT(1) NULL DEFAULT 1,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uk_nick (nick),
            KEY idx_uuid (uuid),
            KEY idx_active (active)
        ) {$options} COMMENT='Whitelist de jugadores permitidos para comandos sensibles (FurrPerms)'",
        'fur_perms_command_logs' => "CREATE TABLE IF NOT EXISTS fur_perms_command_logs (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            player_uuid VARCHAR(36) NULL,
            player_nick VARCHAR(16) NOT NULL,
            command VARCHAR(255) NOT NULL,
            server_name VARCHAR(100) NULL,
            allowed TINYINT(1) NULL DEFAULT 1,
            reason VARCHAR(255) NULL,
            ip_address VARCHAR(45) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_player_nick (player_nick),
            KEY idx_player_uuid (player_uuid),
            KEY idx_command (command),
            KEY idx_created_at (created_at),
            KEY idx_allowed (allowed)
        ) {$options} COMMENT='Logs de comandos sensibles ejecutados (FurrPerms)'",
        'furrsecurity_staff' => "CREATE TABLE IF NOT EXISTS furrsecurity_staff (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            discord_id VARCHAR(32) NOT NULL,
            minecraft_nick VARCHAR(16) NOT NULL,
            added_by VARCHAR(32) NOT NULL,
            added_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uk_discord_id (discord_id),
            UNIQUE KEY uk_nick (minecraft_nick),
            KEY idx_discord_id (discord_id),
            KEY idx_nick (minecraft_nick)
        ) {$options} COMMENT='Staff whitelist para verificación de cuentas (FurrSecurity)'",
        'furrsecurity_verifications' => "CREATE TABLE IF NOT EXISTS furrsecurity_verifications (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            uuid VARCHAR(36) NOT NULL,
            discord_id VARCHAR(32) NULL,
            minecraft_nick VARCHAR(16) NOT NULL,
            verification_token VARCHAR(64) NOT NULL,
            token_expires_at DATETIME NULL DEFAULT NULL,
            status ENUM('pending','verified','expired','token_expired') NULL DEFAULT 'pending',
            verified_at DATETIME NULL DEFAULT NULL,
            expires_at DATETIME NOT NULL,
            ip_address VARCHAR(45) NULL,
            created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uk_token (verification_token),
            KEY idx_uuid (uuid),
            KEY idx_token (verification_token),
            KEY idx_status (status),
            KEY idx_expires_at (expires_at)
        ) {$options} COMMENT='Sesiones de verificación activas (FurrSecurity)'",
        'furrsecurity_logs' => "CREATE TABLE IF NOT EXISTS furrsecurity_logs (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT,
            uuid VARCHAR(36) NULL,
            minecraft_nick VARCHAR(16) NULL,
            discord_id VARCHAR(32) NULL,
            action VARCHAR(50) NOT NULL,
            details TEXT NULL,
            ip_address VARCHAR(45) NULL,
            created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_uuid (uuid),
            KEY idx_nick (minecraft_nick),
            KEY idx_action (action),
            KEY idx_created_at (created_at)
        ) {$options} COMMENT='Logs de auditoría de verificación (FurrSecurity)'",
        'furrsecurity_failed_attempts' => "CREATE TABLE IF NOT EXISTS furrsecurity_failed_attempts (
            id INT NOT NULL AUTO_INCREMENT,
            uuid VARCHAR(36) NOT NULL,
            minecraft_nick VARCHAR(16) NOT NULL,
            failed_attempts INT NULL DEFAULT 1,
            last_attempt DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
            last_ip VARCHAR(45) NULL,
            PRIMARY KEY (id),
            UNIQUE KEY unique_uuid (uuid),
            KEY idx_nick (minecraft_nick),
            KEY idx_last_attempt (last_attempt)
        ) {$options}",
    ];

    foreach ($tables as $table => $ddl) {
        if (!dbTableExists($db, $table)) {
            $db->exec($ddl);
            migrationLog("  creada {$table}");
        }
    }

    // ── Semillas (solo lo que falta) ──
    seedSettingsIfMissing($db, [
        'block_proxy' => '1', 'block_vpn' => '1', 'block_hosting' => '1', 'block_mobile' => '0',
        'notify_connections' => '0', 'notify_hispanic' => '0',
        'server_name' => 'FurrGuard', 'discord_url' => '',
        'country_change_detection_enabled' => '1', 'country_change_min_connections' => '3',
        'country_change_min_percentage' => '70', 'country_change_continent_only' => '0',
        'fur_perms_enabled' => '1', 'fur_perms_log_allowed' => '1', 'fur_perms_log_blocked' => '1',
        'furrsecurity_enabled' => '1', 'furrsecurity_session_duration' => '28800',
        'furrsecurity_alert_times' => '3600,1800,300,240,180,120,60,30', 'furrsecurity_early_verify_time' => '300',
        'furrsecurity_lock_movement' => '1', 'furrsecurity_lock_commands' => '1', 'furrsecurity_lock_inventory' => '1',
        'furrsecurity_lock_server_switch' => '1', 'furrsecurity_notify_admins' => '1',
        'furrsecurity_admin_permission' => 'furrsecurity.notify',
    ]);

    // Textos con saltos de línea escritos como \n (se convierten al sembrar).
    $messages = array_map(
        static fn (array $m): array => [$m[0], str_replace('\n', "\n", $m[1]), $m[2]],
        [
            ['prefix', '&8[&a&lFurrGuard&8] &7', 'Prefijo del plugin'],
            ['kick_proxy', '&6&l{server_name}\n\n&c✘ &cSe ha detectado que estás usando un Proxy &c✘\n\nRazón: &fProxy detectado\n\n&7Si crees que fue un error, abre ticket en &b&lDISCORD\n\n&b{discord}\n\n&8ID# {id}', 'Mensaje al detectar proxy'],
            ['kick_vpn', '&6&l{server_name}\n\n&c✘ &cSe ha detectado que estás usando una VPN &c✘\n\nRazón: &fVPN detectada\n\n&7Si crees que fue un error, abre ticket en &b&lDISCORD\n\n&b{discord}\n\n&8ID# {id}', 'Mensaje al detectar VPN'],
            ['kick_hosting', '&6&l{server_name}\n\n&c✘ &cTu conexión proviene de un servidor/datacenter &c✘\n\nRazón: &fHosting detectado\n\n&7Si crees que fue un error, abre ticket en &b&lDISCORD\n\n&b{discord}\n\n&8ID# {id}', 'Mensaje al detectar hosting'],
            ['kick_mobile', '&6&l{server_name}\n\n&c✘ &cLas conexiones desde redes móviles no están permitidas &c✘\n\nRazón: &fRed móvil detectada\n\n&7Si crees que fue un error, abre ticket en &b&lDISCORD\n\n&b{discord}\n\n&8ID# {id}', 'Mensaje al detectar red móvil'],
            ['kick_blacklisted', '&6&l{server_name}\n\n&c✘ &c¡Tu cuenta ha sido suspendida{time_remaining}! &c✘\n\nRazón: &f{reason}\n\n&7Si crees que fue un error, abre ticket en &b&lDISCORD\n\n&b{discord}\n\n&8ID# {id}', 'Mensaje al estar en blacklist. Variables: {time_remaining} muestra tiempo restante si es temporal'],
            ['kick_blocked_provider', '&6&l{server_name}\n\n&c✘ &cTu proveedor de internet está bloqueado &c✘\n\nISP: &f{isp}\n\n&7Si crees que fue un error, abre ticket en &b&lDISCORD\n\n&b{discord}\n\n&8ID# {id}', 'Mensaje proveedor bloqueado'],
            ['kick_blocked_country', '&6&l{server_name}\n\n&c✘ &cTu país está bloqueado &c✘\n\nPaís: &f{country} ({country_code})\n\n&7Si crees que fue un error, abre ticket en &b&lDISCORD\n\n&b{discord}\n\n&8ID# {id}', 'Mensaje país bloqueado'],
            ['kick_blocked_continent', '&6&l{server_name}\n\n&c✘ &cTu continente está bloqueado &c✘\n\nContinente: &f{continent}\n\n&7Si crees que fue un error, abre ticket en &b&lDISCORD\n\n&b{discord}\n\n&8ID# {id}', 'Mensaje continente bloqueado'],
            ['kick_compromised_account', '&6&l{server_name}\n\n&c✘ &c¡CUENTA COMPROMETIDA! &c✘\n\n&7Se ha detectado un cambio sospechoso de ubicación.\n\n&7País habitual: &f{historical_country}\n&7País actual: &f{current_country}\n\n&7Por seguridad, tu cuenta ha sido bloqueada.\n&7Si eres el dueño legítimo, contacta con &b&lDISCORD\n\n&b{discord}', 'Mensaje cuenta comprometida por cambio de país'],
            ['whitelist_added', '&a✔ &7Whitelist añadida: &f{type} &8= &f{value}', 'Mensaje whitelist añadido'],
            ['whitelist_removed', '&c✘ &7Whitelist eliminada: &f{type} &8= &f{value}', 'Mensaje whitelist eliminado'],
            ['blacklist_added', '&c✘ &7Blacklist añadida: &f{type} &8= &f{value}', 'Mensaje blacklist añadido'],
            ['blacklist_removed', '&a✔ &7Blacklist eliminada: &f{type} &8= &f{value}', 'Mensaje blacklist eliminado'],
            ['player_allowed', '&a✔ &f{player} &7permitido desde &f{country}', 'Mensaje jugador permitido'],
            ['player_blocked', '&c✘ &c{player} &7bloqueado: &f{reason}', 'Mensaje jugador bloqueado'],
            ['no_permission', '&c✘ &7No tienes permiso para usar este comando', 'Sin permisos'],
            ['reload_success', '&a✔ &7Configuración recargada correctamente', 'Recarga exitosa'],
            ['command_usage', '&7⚠ Uso: &f{usage}', 'Uso de comando'],
            ['player_not_found', '&c✘ &7Jugador no encontrado', 'Jugador no encontrado'],
            ['invalid_type', '&c✘ &7Tipo inválido. Usa: &fuuid, nick, ip, as', 'Tipo inválido'],
            ['notify_proxy_blocked', '&c✘ &c{player} &7bloqueado desde &f{ip} &7(Proxy detectado)', 'Notificación a admins: proxy detectado'],
            ['notify_vpn_blocked', '&c✘ &c{player} &7bloqueado desde &f{ip} &7(VPN detectada)', 'Notificación a admins: VPN detectada'],
            ['notify_hosting_blocked', '&c✘ &c{player} &7bloqueado desde &f{ip} &7(Hosting detectado)', 'Notificación a admins: hosting detectado'],
            ['notify_provider_blocked', '&c✘ &c{player} &7bloqueado desde &f{ip} &7(Proveedor bloqueado: &f{isp}&7)', 'Notificación a admins: proveedor bloqueado'],
            ['notify_country_blocked', '&c✘ &c{player} &7bloqueado desde &f{ip} &7(País bloqueado: &f{country}&7)', 'Notificación a admins: país bloqueado'],
            ['notify_blacklisted', '&c✘ &c{player} &7bloqueado desde &f{ip} &7(Blacklist) &8[#{ban_id}]', 'Notificación a admins: blacklist'],
            ['notify_whitelisted', '&a✔ &a{player} &7permitido desde &f{ip} &7(Whitelist)', 'Notificación a admins: whitelist'],
            ['notify_player_join', '&e➤ &e{player} &7conectó desde &f{country} &8({country_code})', 'Notificación a admins: jugador conectó (hispano)'],
            ['notify_non_hispanic_join', '&e⚠ &f{player} &7conectó desde &f{country} &8({country_code})', 'Notificación a admins: jugador conectó (no hispano)'],
            ['notify_compromised_account', '&c⚠ &c{player} &7bloqueado - &c&lCUENTA COMPROMETIDA &7({historical_country} → {current_country})', 'Notificación a admins: cuenta comprometida'],
            ['fur_perms_no_permission', '&c✘ &cNo tienes permiso para ejecutar este comando. Solo administradores autorizados pueden usar comandos de gestión de permisos.', 'Mensaje cuando un jugador no permitido intenta ejecutar un comando restringido'],
            ['fur_perms_command_blocked', '&c✘ &cEl comando &f{command} &cestá restringido por FurrPerms. Solo usuarios autorizados pueden ejecutarlo.', 'Mensaje cuando un comando es bloqueado'],
            ['fur_perms_logged', '&c✘ &cTu intento de ejecutar &f{command} &cha sido registrado en los logs del sistema.', 'Mensaje adicional indicando que el intento fue logueado'],
            ['fur_perms_notify_blocked', '&c⚠ &f{player} &7intentó ejecutar &f{command} &7en servidor &f{server}', 'Notificación a admins cuando un comando es bloqueado'],
            ['fur_perms_notify_allowed', '&a✔ &f{player} &7ejecutó &f{command} &7en servidor &f{server}', 'Notificación a admins cuando un comando permitido es ejecutado'],
            ['kick_default', '&8╔════════════════════════════════════╗\n&8║  &6&l{server_name}&8                    ║\n&8║                                    ║\n&8║     &c&l✘ CONEXIÓN DENEGADA ✘&8        ║\n&8║                                    ║\n&8║   &7No se permite tu conexión      ║\n&8║   &7a este servidor.               ║\n&8║                                    ║\n&8║   &7Si crees que es un error,       ║\n&8║   &fcontacta con la administración. ║\n&8║                                    ║\n&8║   &8Discord: &b{discord}&8\n&8║   &8ID: &7{id}&8                       ║\n&8╚════════════════════════════════════╝', 'Kick genérico sin razón específica'],
            ['kick_api_error', '&8╔════════════════════════════════════╗\n&8║     &c&l✘ ERROR DE VERIFICACIÓN ✘&8   ║\n&8║                                    ║\n&8║   &7No se pudo verificar tu        ║\n&8║   &7conexión en este momento.       ║\n&8║                                    ║\n&8║   &7Por favor, inténtalo de nuevo.  ║\n&8║                                    ║\n&8║   &8ID: &7{id}&8                       ║\n&8╚════════════════════════════════════╝', 'Error al conectar con la API'],
            ['kick_timeout', '&8╔════════════════════════════════════╗\n&8║     &c&l✘ TIEMPO DE ESPERA AGOTADO ✘&8 ║\n&8║                                    ║\n&8║   &7La verificación tardó demasiado║\n&8║   &7en completarse.                 ║\n&8║                                    ║\n&8║   &7Por favor, inténtalo de nuevo.  ║\n&8║                                    ║\n&8║   &8ID: &7{id}&8                       ║\n&8╚════════════════════════════════════╝', 'Timeout de verificación'],
            ['kick_interrupted', '&8╔════════════════════════════════════╗\n&8║     &c&l✘ ERROR DE VERIFICACIÓN ✘&8   ║\n&8║                                    ║\n&8║   &7La verificación fue             ║\n&8║   &7interrumpida.                   ║\n&8║                                    ║\n&8║   &7Por favor, inténtalo de nuevo.  ║\n&8║                                    ║\n&8║   &8ID: &7{id}&8                       ║\n&8╚════════════════════════════════════╝', 'Verificación interrumpida'],
            ['kick_execution_error', '&8╔════════════════════════════════════╗\n&8║     &c&l✘ ERROR DE VERIFICACIÓN ✘&8   ║\n&8║                                    ║\n&8║   &7Error interno al verificar      ║\n&8║   &7tu conexión.                    ║\n&8║                                    ║\n&8║   &7Por favor, inténtalo de nuevo.  ║\n&8║                                    ║\n&8║   &8ID: &7{id}&8                       ║\n&8╚════════════════════════════════════╝', 'Error de ejecución'],
            ['kick_completion_error', '&8╔════════════════════════════════════╗\n&8║     &c&l✘ ERROR DE VERIFICACIÓN ✘&8   ║\n&8║                                    ║\n&8║   &7Error al completar la           ║\n&8║   &7verificación de conexión.       ║\n&8║                                    ║\n&8║   &7Por favor, inténtalo de nuevo.  ║\n&8║                                    ║\n&8║   &8ID: &7{id}&8                       ║\n&8╚════════════════════════════════════╝', 'Error de completitud'],
            ['kick_unknown_error', '&8╔════════════════════════════════════╗\n&8║     &c&l✘ ERROR DE VERIFICACIÓN ✘&8   ║\n&8║                                    ║\n&8║   &7Error inesperado al verificar   ║\n&8║   &7tu conexión.                    ║\n&8║                                    ║\n&8║   &7Por favor, inténtalo de nuevo.  ║\n&8║                                    ║\n&8║   &8ID: &7{id}&8                       ║\n&8╚════════════════════════════════════╝', 'Error desconocido'],
            ['notify_continent_blocked', '&c&l🛡 &c{player} &7bloqueado &8• &f{ip} &8• &cContinente: &f{continent}', 'Notificación: continente bloqueado'],
            ['furr_security_prefix', '&c&lFurrSecurity &8| &7', 'Prefijo FurrSecurity'],
            ['furr_security_verification_required', '&cDebes verificar tu identidad para continuar.', 'Verificación requerida'],
            ['furr_security_verification_link', '&eHaz click para verificar: &b{url}', 'Link de verificación'],
            ['furr_security_verification_proxy_mode', '&eVerifica tu identidad en el proxy para continuar.', 'Verificación en proxy'],
            ['furr_security_verification_success', '&aVerificacion completada. Ahora puedes jugar.', 'Verificación exitosa'],
            ['furr_security_verification_failed', '&cVerificacion fallida. Contacta a un administrador.', 'Verificación fallida'],
            ['furr_security_session_expired', '&cTu sesion ha expirado. Por favor, verifica nuevamente.', 'Sesión expirada'],
            ['furr_security_session_expiring', '&eTu sesion expira en &c{time}&e. Verifica nuevamente.', 'Sesión expirando'],
            ['furr_security_not_staff', '&7No necesitas verificacion (no eres staff).', 'No es staff'],
            ['furr_security_already_verified', '&aYa estas verificado.', 'Ya verificado'],
            ['furr_security_locked_movement', '&cEstas bloqueado hasta verificar tu identidad.', 'Bloqueo: movimiento'],
            ['furr_security_locked_command', '&cNo puedes ejecutar comandos hasta verificar.', 'Bloqueo: comandos'],
            ['furr_security_locked_inventory', '&cNo puedes interactuar con inventarios hasta verificar.', 'Bloqueo: inventario'],
            ['furr_security_locked_chat', '&cNo puedes enviar mensajes hasta verificar.', 'Bloqueo: chat'],
            ['furr_security_locked_server_switch', '&cNo puedes cambiar de servidor hasta verificar.', 'Bloqueo: cambio servidor'],
            ['furr_security_admin_notification', '&c[FurrSecurity] &7{player} &erequiere verificacion.', 'Notificación admin'],
            ['furr_security_reload_success', '&aConfiguracion recargada.', 'Config recargada'],
            ['furr_security_no_permission', '&cNo tienes permiso para esto.', 'Sin permisos'],
            ['furr_security_player_not_found', '&cJugador no encontrado.', 'Jugador no encontrado'],
            ['furr_security_stats_header', '&8&m------------------&c FurrSecurity &8&m------------------', 'Header stats'],
            ['furr_security_stats_line', '&7{key}: &f{value}', 'Línea stats'],
            ['furr_security_kick_unverified', '&cNo completaste la verificacion a tiempo.\n&7Por favor, vuelve a entrar e intenta de nuevo.', 'Kick: no verificado'],
            ['furr_security_kick_blacklisted', '&cHas sido añadido a la lista negra por seguridad.\n&7Contacta a un administrador.', 'Kick: blacklist seguridad'],
            ['furr_security_verification_timeout', '&eTu enlace de verificacion ha expirado. Saliendo...', 'Link expirado'],
            ['furr_security_auto_blacklisted', '&cHas sido añadido a la blacklist automaticamente por 3 intentos fallidos.', 'Auto-blacklist'],
        ]
    );
    $inserted = seedMessagesIfMissing($db, $messages);
    migrationLog("  mensajes insertados: {$inserted}");

    // El founder de install.sql y los proveedores solo en una tabla vacía: en una actualización no se
    // resucitan filas que un administrador borró a propósito.
    if ((int) $db->query('SELECT COUNT(*) FROM admin_users')->fetchColumn() === 0) {
        $db->exec("INSERT INTO admin_users (discord_id, role) VALUES ('1227233322044887082', 'founder')");
    }
    if ((int) $db->query('SELECT COUNT(*) FROM blocked_providers')->fetchColumn() === 0) {
        $rows = loadProvidersTsv();
        foreach (array_chunk($rows, 500) as $chunk) {
            $stmt = $db->prepare(
                'INSERT IGNORE INTO blocked_providers (name, pattern, type, added_by) VALUES '
                . implode(',', array_fill(0, count($chunk), "(?, ?, ?, 'System')"))
            );
            $stmt->execute(array_merge(...$chunk));
        }
        migrationLog('  proveedores insertados: ' . count($rows));
    }
};
