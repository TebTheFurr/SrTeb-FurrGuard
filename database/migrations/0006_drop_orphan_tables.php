<?php

declare(strict_types=1);

/**
 * Tablas huérfanas de producción que ningún código usa. Solo se borran si están vacías; si tienen
 * filas se dejan y se avisa (revisar a mano antes de borrarlas).
 */
return static function (PDO $db): void {
    foreach (['furrsecurity_sessions', 'furrsecurity_verification_tokens', 'furrsecurity_verified_staff'] as $table) {
        if (!dbTableExists($db, $table)) {
            continue;
        }
        $rows = (int) $db->query("SELECT COUNT(*) FROM `{$table}`")->fetchColumn();
        if ($rows === 0) {
            $db->exec("DROP TABLE `{$table}`");
            migrationLog("  eliminada {$table}");
        } else {
            migrationLog("  AVISO: {$table} tiene {$rows} filas; no se elimina");
        }
    }
};
