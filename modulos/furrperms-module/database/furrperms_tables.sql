-- ============================================
-- FurrPerms Module Database Tables
-- Módulo de protección de comandos sensibles
--
-- @author GrinchHorizon
-- @copyright SrTeb Limited
-- @website https://srteb.eu
-- @version 1.0.0
-- ============================================

-- -------------------------------------------
-- Table: fur_perms_whitelist
-- Jugadores permitidos para ejecutar comandos sensibles
-- -------------------------------------------
DROP TABLE IF EXISTS `fur_perms_whitelist`;
CREATE TABLE `fur_perms_whitelist` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `nick` VARCHAR(16) NOT NULL,
    `uuid` VARCHAR(36),
    `added_by` VARCHAR(100) DEFAULT 'System',
    `reason` TEXT,
    `active` TINYINT(1) DEFAULT 1,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_nick` (`nick`),
    KEY `idx_uuid` (`uuid`),
    KEY `idx_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Whitelist de jugadores permitidos para comandos sensibles (FurrPerms)';

-- -------------------------------------------
-- Table: fur_perms_command_logs
-- Logs de ejecución de comandos sensibles
-- -------------------------------------------
DROP TABLE IF EXISTS `fur_perms_command_logs`;
CREATE TABLE `fur_perms_command_logs` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `player_uuid` VARCHAR(36),
    `player_nick` VARCHAR(16) NOT NULL,
    `command` VARCHAR(255) NOT NULL,
    `server_name` VARCHAR(100),
    `allowed` TINYINT(1) DEFAULT 1,
    `reason` VARCHAR(255),
    `ip_address` VARCHAR(45),
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_player_nick` (`player_nick`),
    KEY `idx_player_uuid` (`player_uuid`),
    KEY `idx_command` (`command`),
    KEY `idx_created_at` (`created_at`),
    KEY `idx_allowed` (`allowed`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Logs de comandos sensibles ejecutados (FurrPerms)';

-- -------------------------------------------
-- Insertar mensajes por defecto para FurrPerms
-- -------------------------------------------
INSERT INTO `messages` (`key`, `value`, `description`) VALUES
('fur_perms_no_permission', '&c✘ &cNo tienes permiso para ejecutar este comando. Solo administradores autorizados pueden usar comandos de gestión de permisos.', 'Mensaje cuando un jugador no permitido intenta ejecutar un comando restringido'),
('fur_perms_command_blocked', '&c✘ &cEl comando &f{command} &cestá restringido por FurrPerms. Solo usuarios autorizados pueden ejecutarlo.', 'Mensaje cuando un comando es bloqueado'),
('fur_perms_logged', '&c✘ &cTu intento de ejecutar &f{command} &cha sido registrado en los logs del sistema.', 'Mensaje adicional indicando que el intento fue logueado'),
('fur_perms_notify_blocked', '&c⚠ &f{player} &7intentó ejecutar &f{command} &7en servidor &f{server}', 'Notificación a admins cuando un comando es bloqueado'),
('fur_perms_notify_allowed', '&a✔ &f{player} &7ejecutó &f{command} &7en servidor &f{server}', 'Notificación a admins cuando un comando permitido es ejecutado');

-- -------------------------------------------
-- Insertar configuración por defecto para FurrPerms
-- -------------------------------------------
INSERT INTO `settings` (`key`, `value`) VALUES
('fur_perms_enabled', '1'),
('fur_perms_commands', 'op,lp,lpv,perms,luckperms,lpv,lp user,lp group,lp permission,lp verbose,perm,permissions,minecraft:op,minecraft:deop'),
('fur_perms_notify_blocks', '1'),
('fur_perms_log_allowed', '1'),
('fur_perms_log_blocked', '1'),
('fur_perms_bypass_permission', 'furrguard.furrperms.bypass');

-- -------------------------------------------
-- Insertar permisos en activity_logs
-- -------------------------------------------
INSERT INTO `activity_logs` (`type`, `action`, `details`) VALUES
('furrperms', 'module_installed', 'Módulo FurrPerms instalado correctamente');
