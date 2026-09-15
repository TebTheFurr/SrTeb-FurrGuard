<?php

declare(strict_types=1);

/**
 * Inserta los ajustes de docs/API.md §7 que falten (sin tocar los existentes) y elimina las 11
 * claves antiguas de mensajes `furrsecurity_*`: el módulo usa `furr_security_*` (sembradas en 0001)
 * y aquellas nunca le llegaban.
 */
return static function (PDO $db): void {
    $defaults = [];
    foreach (settingDefinitions() as $key => $definition) {
        if ($definition['default'] !== null) {
            $defaults[$key] = $definition['default'];
        }
    }
    // Sin APP_URL no hay URL de verificación que proponer: se deja sin fila y el panel la pedirá.
    if (APP_URL === '') {
        unset($defaults['furrsecurity_verify_url']);
    }
    $inserted = seedSettingsIfMissing($db, $defaults);
    migrationLog("  ajustes por defecto insertados: {$inserted}");

    $legacyMessages = [
        'furrsecurity_prefix', 'furrsecurity_verify_required', 'furrsecurity_verify_success',
        'furrsecurity_session_expiring', 'furrsecurity_session_expired', 'furrsecurity_already_verified',
        'furrsecurity_not_in_whitelist', 'furrsecurity_kick_unverified', 'furrsecurity_notify_verification',
        'furrsecurity_notify_expired', 'furrsecurity_notify_blocked_join',
    ];
    $stmt = $db->prepare('DELETE FROM messages WHERE `key` IN (' . implode(',', array_fill(0, count($legacyMessages), '?')) . ')');
    $stmt->execute($legacyMessages);
    migrationLog('  mensajes antiguos furrsecurity_* eliminados: ' . $stmt->rowCount());
};
