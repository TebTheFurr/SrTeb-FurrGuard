-- ============================================
-- FurrSecurity Module Database Tables
-- Módulo de verificación de cuentas staff
--
-- @author GrinchHorizon
-- @copyright SrTeb Limited
-- @website https://srteb.eu
-- @version 1.0.0
-- ============================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -------------------------------------------
-- Table: furrsecurity_staff
-- Staff members allowed to verify (whitelist)
-- -------------------------------------------
DROP TABLE IF EXISTS `furrsecurity_staff`;
CREATE TABLE `furrsecurity_staff` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `discord_id` VARCHAR(32) NOT NULL,
    `minecraft_nick` VARCHAR(16) NOT NULL,
    `added_by` VARCHAR(32) NOT NULL,
    `added_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_discord_id` (`discord_id`),
    UNIQUE KEY `uk_nick` (`minecraft_nick`),
    KEY `idx_discord_id` (`discord_id`),
    KEY `idx_nick` (`minecraft_nick`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Staff whitelist para verificación de cuentas (FurrSecurity)';

-- -------------------------------------------
-- Table: furrsecurity_verifications
-- Active verification sessions
-- -------------------------------------------
DROP TABLE IF EXISTS `furrsecurity_verifications`;
CREATE TABLE `furrsecurity_verifications` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(36) NOT NULL,
    `discord_id` VARCHAR(32),
    `minecraft_nick` VARCHAR(16) NOT NULL,
    `verification_token` VARCHAR(64) NOT NULL,
    `status` ENUM('pending', 'verified', 'expired') DEFAULT 'pending',
    `verified_at` DATETIME NULL,
    `expires_at` DATETIME NOT NULL,
    `ip_address` VARCHAR(45),
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_token` (`verification_token`),
    KEY `idx_uuid` (`uuid`),
    KEY `idx_token` (`verification_token`),
    KEY `idx_status` (`status`),
    KEY `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Sesiones de verificación activas (FurrSecurity)';

-- -------------------------------------------
-- Table: furrsecurity_logs
-- Verification audit log
-- -------------------------------------------
DROP TABLE IF EXISTS `furrsecurity_logs`;
CREATE TABLE `furrsecurity_logs` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(36),
    `minecraft_nick` VARCHAR(16),
    `discord_id` VARCHAR(32),
    `action` VARCHAR(50) NOT NULL,
    `details` TEXT,
    `ip_address` VARCHAR(45),
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_uuid` (`uuid`),
    KEY `idx_nick` (`minecraft_nick`),
    KEY `idx_action` (`action`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Logs de auditoría de verificación (FurrSecurity)';

-- -------------------------------------------
-- Insertar mensajes por defecto para FurrSecurity
-- -------------------------------------------
INSERT INTO `messages` (`key`, `value`, `description`) VALUES
('furrsecurity_prefix', '&8[&c&lFurrSecurity&8] &7', 'Prefijo del módulo FurrSecurity'),
('furrsecurity_verify_required', '&c&l⚠ VERIFICACIÓN REQUERIDA ⚠\n\n&7Para proteger el servidor, debes verificar tu cuenta.\n\n&e🔗 Visita: &f{verify_url}\n\n&7Tu sesión expirará en &e8 horas&7.\n&7Si es tu primera vez, contacta a &bSrTeb &7en Discord.', 'Mensaje de verificación requerida'),
('furrsecurity_verify_success', '&a&l✔ VERIFICACIÓN COMPLETADA\n\n&7Tu cuenta ha sido verificada correctamente.\n&7Sesión válida por &e8 horas&7.\n\n&a¡Disfruta el servidor!', 'Mensaje de verificación exitosa'),
('furrsecurity_session_expiring', '&c&l⚠ TU SESIÓN EXPIRARÁ PRONTO\n\n&7Tu sesión de verificación expira en: &e{time_remaining}\n\n&e🔗 Re-verifica en: &f{verify_url}', 'Mensaje de sesión por expirar'),
('furrsecurity_session_expired', '&c&l✘ SESIÓN EXPIRADA\n\n&7Tu sesión de verificación ha expirado.\n&7Por favor, verifica tu cuenta nuevamente.\n\n&e🔗 Visita: &f{verify_url}', 'Mensaje de sesión expirada'),
('furrsecurity_already_verified', '&a✔ &7Ya tienes una sesión activa. Expira en: &e{time_remaining}', 'Mensaje si ya está verificado'),
('furrsecurity_not_in_whitelist', '&c✘ &7No estás en la lista de staff autorizada.\n&7Contacta a &bSrTeb &7en Discord.', 'Mensaje si no está en whitelist'),
('furrsecurity_kick_unverified', '&c&l✘ VERIFICACIÓN REQUERIDA\n\n&7Debes verificar tu cuenta de staff.\n\n&e🔗 Visita: &f{verify_url}\n\n&7Contacta a &bSrTeb &7en Discord si tienes problemas.', 'Kick para jugadores no verificados'),
('furrsecurity_notify_verification', '&a✔ &f{player} &7ha verificado su cuenta de staff.', 'Notificación a admins cuando alguien se verifica'),
('furrsecurity_notify_expired', '&c⚠ &f{player} &7su sesión de verificación ha expirado.', 'Notificación a admins cuando expira una sesión'),
('furrsecurity_notify_blocked_join', '&c⚠ &f{player} &7intentó unirse sin verificación válida.', 'Notificación a admins cuando alguien intenta unirse sin verificar');

-- -------------------------------------------
-- Insertar configuración por defecto para FurrSecurity
-- -------------------------------------------
INSERT INTO `settings` (`key`, `value`) VALUES
('furrsecurity_enabled', '1'),
('furrsecurity_session_duration', '28800'),
('furrsecurity_verify_url', 'https://furrguard.srteb.eu/verify.php'),
('furrsecurity_alert_times', '3600,1800,300,240,180,120,60,30'),
('furrsecurity_early_verify_time', '300'),
('furrsecurity_lock_movement', '1'),
('furrsecurity_lock_commands', '1'),
('furrsecurity_lock_inventory', '1'),
('furrsecurity_lock_server_switch', '1'),
('furrsecurity_notify_admins', '1'),
('furrsecurity_admin_permission', 'furrguard.furrsecurity.notify');

-- -------------------------------------------
-- Registrar instalación en activity_logs
-- -------------------------------------------
INSERT INTO `activity_logs` (`type`, `action`, `details`) VALUES
('furrsecurity', 'module_installed', 'Módulo FurrSecurity instalado correctamente');

SET FOREIGN_KEY_CHECKS = 1;
