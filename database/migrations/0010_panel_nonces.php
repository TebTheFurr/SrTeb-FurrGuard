<?php

declare(strict_types=1);

/**
 * `panel_nonces`: nonces ya usados por el puente de Pterodactyl (docs/API.md §9). Una petición
 * firmada solo vale una vez; las filas caducan con la ventana de la firma y el propio puente las
 * va borrando.
 */
return static function (PDO $db): void {
    if (!dbTableExists($db, 'panel_nonces')) {
        $db->exec('CREATE TABLE panel_nonces (
            nonce VARCHAR(64) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (nonce),
            KEY idx_created_at (created_at)
        ) ' . TABLE_OPTIONS);
        migrationLog('  panel_nonces creada');
    }
};
