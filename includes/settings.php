<?php

declare(strict_types=1);

/**
 * FurrGuard - ajustes (`settings`) según docs/API.md §7.
 *
 * Tipos: bool ('0'/'1'), int, float, text, url (https), url_or_empty, int_csv, permission.
 * `system`: no editable desde el panel. `secret`: nunca se devuelve.
 */

/**
 * @return array<string, array{type: string, default: ?string, min?: int|float, max?: int|float, system?: bool, secret?: bool}>
 */
function settingDefinitions(): array
{
    static $definitions = null;
    if ($definitions !== null) {
        return $definitions;
    }
    $bool = static fn (string $default): array => ['type' => 'bool', 'default' => $default];
    $definitions = [
        'block_proxy' => $bool('1'),
        'block_vpn' => $bool('1'),
        'block_hosting' => $bool('1'),
        'block_mobile' => $bool('0'),
        'ip_api_fail_open' => $bool('0'),
        'notify_connections' => $bool('0'),
        'notify_hispanic' => $bool('0'),
        'country_change_detection_enabled' => $bool('1'),
        'country_change_continent_only' => $bool('0'),
        'country_change_min_connections' => ['type' => 'int', 'min' => 1, 'max' => 1000, 'default' => '10'],
        'compromised_ban_hours' => ['type' => 'int', 'min' => 0, 'max' => 8760, 'default' => '24'],
        'auto_ban_evasion_ip' => $bool('1'),
        'country_change_min_percentage' => ['type' => 'float', 'min' => 0, 'max' => 100, 'default' => '70'],
        'server_name' => ['type' => 'text', 'max' => 64, 'default' => 'FurrGuard'],
        'discord_url' => ['type' => 'url_or_empty', 'default' => ''],
        'fur_perms_enabled' => $bool('1'),
        'fur_perms_log_allowed' => $bool('1'),
        'fur_perms_log_blocked' => $bool('1'),
        'furrsecurity_enabled' => $bool('1'),
        'furrsecurity_notify_admins' => $bool('1'),
        'furrsecurity_lock_movement' => $bool('1'),
        'furrsecurity_lock_commands' => $bool('1'),
        'furrsecurity_lock_inventory' => $bool('1'),
        'furrsecurity_lock_server_switch' => $bool('1'),
        'furrsecurity_session_duration' => ['type' => 'int', 'min' => 300, 'max' => 604800, 'default' => '28800'],
        'furrsecurity_token_expiration' => ['type' => 'int', 'min' => 60, 'max' => 3600, 'default' => '180'],
        'furrsecurity_max_failed_attempts' => ['type' => 'int', 'min' => 1, 'max' => 20, 'default' => '3'],
        'furrsecurity_failed_attempts_window' => ['type' => 'int', 'min' => 300, 'max' => 2592000, 'default' => '86400'],
        'furrsecurity_early_verify_time' => ['type' => 'int', 'min' => 0, 'max' => 86400, 'default' => '300'],
        'furrsecurity_alert_times' => ['type' => 'int_csv', 'default' => '3600,1800,300,240,180,120,60,30'],
        'furrsecurity_verify_url' => ['type' => 'url', 'default' => APP_URL === '' ? '' : APP_URL . '/verify.php'],
        'furrsecurity_admin_permission' => ['type' => 'permission', 'default' => 'furrsecurity.notify'],
        'retention_connections_days' => ['type' => 'int', 'min' => 0, 'max' => 3650, 'default' => '0'],
        'retention_logs_days' => ['type' => 'int', 'min' => 0, 'max' => 3650, 'default' => '0'],
        'cache_version' => ['type' => 'int', 'default' => '0', 'system' => true],
        'api_key_hash' => ['type' => 'text', 'default' => null, 'system' => true, 'secret' => true],
        'api_key_prefix' => ['type' => 'text', 'default' => null, 'system' => true, 'secret' => true],
        'api_key_created_at' => ['type' => 'text', 'default' => null, 'system' => true, 'secret' => true],
    ];
    return $definitions;
}

/**
 * Valor guardado o, si no existe, `$default` y después el defecto de §7.
 */
function getSetting(PDO $db, string $key, ?string $default = null): ?string
{
    $stmt = $db->prepare('SELECT value FROM settings WHERE `key` = ?');
    $stmt->execute([$key]);
    $value = $stmt->fetchColumn();
    if (is_string($value)) {
        return $value;
    }
    return $default ?? (settingDefinitions()[$key]['default'] ?? null);
}

/**
 * Varios ajustes de una vez, con defectos de §7 para los que falten.
 *
 * @param list<string> $keys
 * @return array<string, ?string>
 */
function getSettings(PDO $db, array $keys): array
{
    if ($keys === []) {
        return [];
    }
    $stmt = $db->prepare('SELECT `key`, value FROM settings WHERE `key` IN (' . implode(',', array_fill(0, count($keys), '?')) . ')');
    $stmt->execute($keys);
    $stored = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
    $definitions = settingDefinitions();
    $result = [];
    foreach ($keys as $key) {
        $value = $stored[$key] ?? null;
        $result[$key] = is_string($value) ? $value : ($definitions[$key]['default'] ?? null);
    }
    return $result;
}

function setSetting(PDO $db, string $key, string $value): void
{
    $db->prepare('INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)')
        ->execute([$key, $value]);
}

/**
 * Ajustes editables con su valor actual (sin claves de sistema ni secretos).
 *
 * @return array<string, string>
 */
function settingsForPanel(PDO $db): array
{
    $keys = array_keys(array_filter(settingDefinitions(), static fn (array $d): bool => empty($d['system'])));
    return array_map(static fn (?string $v): string => $v ?? '', getSettings($db, $keys));
}

/**
 * Valida y normaliza ajustes enviados por el panel.
 *
 * @param array<array-key, mixed> $input clave => valor
 * @return array<string, string> clave => valor normalizado
 * @throws ValidationError
 */
function validateSettingsInput(array $input): array
{
    $definitions = settingDefinitions();
    $normalized = [];
    foreach ($input as $key => $value) {
        $key = (string) $key;
        $definition = $definitions[$key] ?? null;
        if ($definition === null) {
            throw new ValidationError("Ajuste desconocido: {$key}.", $key);
        }
        if (!empty($definition['system'])) {
            throw new ValidationError("El ajuste {$key} no se puede modificar.", $key);
        }
        $normalized[$key] = normalizeSettingValue($key, $definition, $value);
    }
    return $normalized;
}

/**
 * @param array{type: string, default: ?string, min?: int|float, max?: int|float} $definition
 * @throws ValidationError
 */
function normalizeSettingValue(string $key, array $definition, mixed $value): string
{
    $fail = static fn (string $message): ValidationError => new ValidationError($message, $key);
    switch ($definition['type']) {
        case 'bool':
            $bool = parseBool($value);
            if ($bool === null) {
                throw $fail("El ajuste {$key} debe ser 0 o 1.");
            }
            return $bool ? '1' : '0';

        case 'int':
            if (is_string($value) && preg_match('/^\s*-?\d{1,10}\s*\z/', $value)) {
                $value = (int) trim($value);
            }
            if (!is_int($value)) {
                throw $fail("El ajuste {$key} debe ser un número entero.");
            }
            if ((isset($definition['min']) && $value < $definition['min']) || (isset($definition['max']) && $value > $definition['max'])) {
                throw $fail("El ajuste {$key} debe estar entre {$definition['min']} y {$definition['max']}.");
            }
            return (string) $value;

        case 'float':
            if (is_string($value) && preg_match('/^\s*-?\d{1,6}(\.\d{1,6})?\s*\z/', $value)) {
                $value = (float) trim($value);
            }
            if (is_int($value)) {
                $value = (float) $value;
            }
            if (!is_float($value) || !is_finite($value)) {
                throw $fail("El ajuste {$key} debe ser un número.");
            }
            if ((isset($definition['min']) && $value < $definition['min']) || (isset($definition['max']) && $value > $definition['max'])) {
                throw $fail("El ajuste {$key} debe estar entre {$definition['min']} y {$definition['max']}.");
            }
            return (string) round($value, 4);

        case 'text':
            if (!is_string($value) || !mb_check_encoding($value, 'UTF-8')) {
                throw $fail("El ajuste {$key} debe ser texto.");
            }
            $value = trim($value);
            $max = (int) ($definition['max'] ?? 255);
            if ($value === '' || mb_strlen($value) > $max || preg_match('/\p{Cc}/u', $value)) {
                throw $fail("El ajuste {$key} debe tener entre 1 y {$max} caracteres, sin saltos de línea.");
            }
            return $value;

        case 'url':
        case 'url_or_empty':
            $value = is_string($value) ? trim($value) : null;
            if ($value === '' && $definition['type'] === 'url_or_empty') {
                return '';
            }
            if ($value === null || !isHttpsUrl($value)) {
                throw $fail("El ajuste {$key} debe ser una URL https válida.");
            }
            return $value;

        case 'int_csv':
            $items = is_array($value) ? $value : (is_string($value) ? explode(',', $value) : null);
            if ($items === null || $items === [] || count($items) > 50) {
                throw $fail("El ajuste {$key} debe ser una lista de 1 a 50 enteros separados por comas.");
            }
            $numbers = [];
            foreach ($items as $item) {
                $item = is_int($item) ? (string) $item : (is_string($item) ? trim($item) : '');
                if (!preg_match('/^\d{1,7}\z/', $item)) {
                    throw $fail("El ajuste {$key} solo admite enteros mayores o iguales que 0.");
                }
                $numbers[] = (string) (int) $item;
            }
            return implode(',', $numbers);

        case 'permission':
            $value = is_string($value) ? trim($value) : '';
            if (strlen($value) > 100 || !preg_match('/^[a-z0-9._*-]+\z/', $value)) {
                throw $fail("El ajuste {$key} debe ser un nodo de permiso (a-z, 0-9, . _ * -).");
            }
            return $value;
    }
    throw new LogicException("Tipo de ajuste sin validar: {$definition['type']}");
}

function isHttpsUrl(string $value): bool
{
    if (strlen($value) > 255 || filter_var($value, FILTER_VALIDATE_URL) === false) {
        return false;
    }
    $parts = parse_url($value);
    return is_array($parts) && strtolower($parts['scheme'] ?? '') === 'https' && ($parts['host'] ?? '') !== ''
        && !isset($parts['user']) && !isset($parts['pass']);
}

/**
 * Guarda solo las claves que cambian (ya validadas con validateSettingsInput), deja traza en
 * `activity_logs` (tipo `settings`) e incrementa `cache_version` si hubo cambios.
 *
 * @param array<string, string> $normalized
 * @return list<string> claves cambiadas
 */
function saveChangedSettings(PDO $db, array $normalized, ?string $actor = null): array
{
    if ($normalized === []) {
        return [];
    }
    $current = getSettings($db, array_keys($normalized));
    $changed = array_filter($normalized, static fn (string $value, string $key): bool => $current[$key] !== $value, ARRAY_FILTER_USE_BOTH);
    if ($changed === []) {
        return [];
    }

    $definitions = settingDefinitions();
    $ownTransaction = !$db->inTransaction();
    if ($ownTransaction) {
        $db->beginTransaction();
    }
    try {
        $lines = [];
        foreach ($changed as $key => $value) {
            setSetting($db, $key, $value);
            $lines[] = !empty($definitions[$key]['secret'])
                ? "{$key}: (oculto)"
                : sprintf('%s: %s → %s', $key, mb_strimwidth((string) $current[$key], 0, 64, '…'), mb_strimwidth($value, 0, 64, '…'));
        }
        incrementCacheVersion($db);
        logActivity($db, 'settings', 'settings_updated', ($actor !== null ? "Por {$actor}. " : '') . implode('; ', $lines));
        if ($ownTransaction) {
            $db->commit();
        }
    } catch (Throwable $e) {
        if ($ownTransaction && $db->inTransaction()) {
            $db->rollBack();
        }
        throw $e;
    }
    return array_keys($changed);
}

/**
 * Incremento atómico de `cache_version`. Devuelve la versión nueva.
 */
function incrementCacheVersion(PDO $db): int
{
    $update = $db->prepare("UPDATE settings SET value = LAST_INSERT_ID(CAST(value AS UNSIGNED) + 1) WHERE `key` = 'cache_version'");
    $update->execute();
    if ($update->rowCount() === 0) {
        $db->exec("INSERT IGNORE INTO settings (`key`, value) VALUES ('cache_version', '0')");
        $update->execute();
    }
    return (int) $db->query('SELECT LAST_INSERT_ID()')->fetchColumn();
}
