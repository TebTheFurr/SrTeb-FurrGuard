<?php

declare(strict_types=1);

/**
 * API key en claro → SHA-256 (docs/API.md §1.1, hallazgos C5 y A4). La clave de ejemplo de
 * install.sql no se convierte: sin clave válida la API responde 503 hasta generar una nueva.
 * Elimina también los ajustes retirados `webhook_url` y `notify_blocks`.
 */
return static function (PDO $db): void {
    $stmt = $db->query("SELECT value, updated_at FROM settings WHERE `key` = 'api_key'");
    $row = $stmt->fetch();
    if (is_array($row)) {
        $key = trim((string) $row['value']);
        if ($key !== '' && $key !== API_KEY_PLACEHOLDER) {
            $createdAt = is_string($row['updated_at']) && $row['updated_at'] !== '' ? $row['updated_at'] : gmdate('Y-m-d H:i:s');
            setSetting($db, 'api_key_hash', apiKeyHash($key));
            setSetting($db, 'api_key_prefix', substr($key, 0, API_KEY_PREFIX_LENGTH));
            setSetting($db, 'api_key_created_at', $createdAt);
            migrationLog('  api_key convertida a hash');
        } else {
            migrationLog('  api_key vacía o de ejemplo: descartada (hay que generar una desde el panel)');
        }
        $db->exec("DELETE FROM settings WHERE `key` = 'api_key'");
    }

    // Un hash que no es SHA-256 hex (p. ej. una fila vacía) no configura nada.
    $hash = $db->query("SELECT value FROM settings WHERE `key` = 'api_key_hash'")->fetchColumn();
    if ($hash !== false && preg_match('/^[0-9a-f]{64}\z/', (string) $hash) !== 1) {
        $db->exec("DELETE FROM settings WHERE `key` IN ('api_key_hash', 'api_key_prefix', 'api_key_created_at')");
        migrationLog('  api_key_hash inválido eliminado');
    }

    $removed = $db->exec("DELETE FROM settings WHERE `key` IN ('webhook_url', 'notify_blocks')");
    migrationLog("  ajustes retirados eliminados: {$removed}");
};
