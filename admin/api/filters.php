<?php

declare(strict_types=1);

/**
 * FurrGuard - panel: proveedores, países y continentes bloqueados. Todo cambio deja traza y avisa a
 * los plugins.
 */

if (!defined('FURRGUARD_ROOT')) {
    http_response_code(404);
    exit;
}

const ADMIN_CONTINENT_CODES = ['AF', 'AN', 'AS', 'EU', 'NA', 'OC', 'SA'];
const ADMIN_GEO_FILTERS = [
    'country' => ['table' => 'blocked_countries', 'log' => 'countries', 'duplicate' => 'Ese país ya está bloqueado.'],
    'continent' => ['table' => 'blocked_continents', 'log' => 'continents', 'duplicate' => 'Ese continente ya está bloqueado.'],
];

// ─── Comunes ────────────────────────────────────────────────────────────────

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 */
function adminToggleFilter(PDO $db, array $in, array $user, string $table, string $logType, string $labelColumns): null
{
    $id = inputInt($in, 'id', 1);
    $active = inputBool($in, 'active');
    withTransaction($db, static function (PDO $db) use ($user, $id, $active, $table, $logType, $labelColumns): void {
        $row = adminFindRow($db, $table, $id, $labelColumns) ?? adminNotFound('Registro no encontrado.');
        $db->prepare("UPDATE {$table} SET active = ? WHERE id = ?")->execute([$active ? 1 : 0, $id]);
        adminRecord($db, $user, $logType, $active ? 'enable' : 'disable', implode(' ', array_map('strval', $row)));
    });
    return null;
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 */
function adminDeleteFilter(PDO $db, array $in, array $user, string $table, string $logType, string $labelColumns): null
{
    $id = inputInt($in, 'id', 1);
    withTransaction($db, static function (PDO $db) use ($user, $id, $table, $logType, $labelColumns): void {
        $row = adminFindRow($db, $table, $id, $labelColumns) ?? adminNotFound('Registro no encontrado.');
        $db->prepare("DELETE FROM {$table} WHERE id = ?")->execute([$id]);
        adminRecord($db, $user, $logType, 'remove', implode(' ', array_map('strval', $row)));
    });
    return null;
}

/**
 * @param callable(PDO): int $insert
 * @param AdminUser $user
 * @return array{id: int}
 */
function adminInsertFilter(PDO $db, array $user, callable $insert, string $logType, string $label, string $duplicateMessage): array
{
    return withTransaction($db, static function (PDO $db) use ($user, $insert, $logType, $label, $duplicateMessage): array {
        try {
            $id = $insert($db);
        } catch (PDOException $e) {
            throw isDuplicateKeyError($e) ? new HttpError(409, 'duplicate', $duplicateMessage) : $e;
        }
        adminRecord($db, $user, $logType, 'add', $label);
        return ['id' => $id];
    });
}

// ─── Proveedores ────────────────────────────────────────────────────────────

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array<string, mixed>
 */
function adminGetProviders(PDO $db, array $in, array $user): array
{
    $type = inputOptionalEnum($in, 'type', PROVIDER_TYPES);
    [$where, $params] = adminWhere([$type === null ? null : ['type = ?', [$type]], adminSearchCondition($in, ['name', 'pattern'])]);
    $list = adminPaginate($db, $in, 'id, name, pattern, type, block_count, active, added_by, created_at', "FROM blocked_providers{$where}", $params, 'block_count DESC, name ASC, id ASC');
    $stats = array_fill_keys(PROVIDER_TYPES, 0);
    foreach ($db->query('SELECT type, COUNT(*) AS total FROM blocked_providers GROUP BY type')->fetchAll() as $row) {
        $stats[(string) $row['type']] = (int) $row['total'];
    }
    return $list + ['stats' => $stats];
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array{id: int}
 */
function adminAddProvider(PDO $db, array $in, array $user): array
{
    $name = inputString($in, 'name', 255);
    $pattern = mb_strtolower(inputString($in, 'pattern', 255, 3));
    $type = inputEnum($in, 'type', PROVIDER_TYPES);
    if (mb_strlen(str_replace(' ', '', providerKey($pattern))) < 3) {
        throw new ValidationError('El patrón debe tener al menos 3 letras o números.', 'pattern');
    }
    return adminInsertFilter($db, $user, static function (PDO $db) use ($name, $pattern, $type, $user): int {
        $db->prepare('INSERT INTO blocked_providers (name, pattern, type, added_by, created_at) VALUES (?, ?, ?, ?, NOW())')
            ->execute([$name, $pattern, $type, mb_substr(adminActor($user), 0, 100)]);
        return (int) $db->lastInsertId();
    }, 'providers', "{$name} ({$type}): {$pattern}", 'Ese patrón ya existe para ese tipo.');
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 */
function adminToggleProvider(PDO $db, array $in, array $user): null
{
    return adminToggleFilter($db, $in, $user, 'blocked_providers', 'providers', 'name, type, pattern');
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 */
function adminDeleteProvider(PDO $db, array $in, array $user): null
{
    return adminDeleteFilter($db, $in, $user, 'blocked_providers', 'providers', 'name, type, pattern');
}

// ─── Países y continentes ───────────────────────────────────────────────────

/**
 * @param array<string, mixed> $in
 * @return array<string, mixed>
 */
function adminGetGeoFilters(PDO $db, array $in, string $kind): array
{
    [$table, $code, $name] = [ADMIN_GEO_FILTERS[$kind]['table'], "{$kind}_code", "{$kind}_name"];
    [$where, $params] = adminWhere([adminSearchCondition($in, [$code, $name])]);
    $list = adminPaginate($db, $in, "id, {$code}, {$name}, kick_message, block_count, active, added_by, created_at", "FROM {$table}{$where}", $params, "block_count DESC, {$name} ASC, id ASC");
    $stats = adminIntRow($db, "SELECT COUNT(*) AS total, COALESCE(SUM(active = 1), 0) AS active, COALESCE(SUM(block_count), 0) AS total_blocks FROM {$table}");
    return $list + ['stats' => $stats];
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array{id: int}
 */
function adminAddGeoFilter(PDO $db, array $in, array $user, string $kind): array
{
    $code = strtoupper(inputString($in, "{$kind}_code", 2, 2));
    if (preg_match('/^[A-Z]{2}\z/', $code) !== 1 || ($kind === 'continent' && !in_array($code, ADMIN_CONTINENT_CODES, true))) {
        throw new ValidationError($kind === 'country' ? 'El código de país debe ser ISO de 2 letras.' : 'Código de continente no válido.', "{$kind}_code");
    }
    $name = inputString($in, "{$kind}_name", 100);
    $kickMessage = inputOptionalString($in, 'kick_message', 2000);
    $filter = ADMIN_GEO_FILTERS[$kind];
    return adminInsertFilter($db, $user, static function (PDO $db) use ($user, $kind, $filter, $code, $name, $kickMessage): int {
        $db->prepare("INSERT INTO {$filter['table']} ({$kind}_code, {$kind}_name, kick_message, added_by, created_at) VALUES (?, ?, ?, ?, NOW())")
            ->execute([$code, $name, $kickMessage, mb_substr(adminActor($user), 0, 100)]);
        return (int) $db->lastInsertId();
    }, $filter['log'], "{$name} ({$code})", $filter['duplicate']);
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 */
function adminEditGeoFilter(PDO $db, array $in, array $user, string $kind): null
{
    $id = inputInt($in, 'id', 1);
    $name = inputString($in, "{$kind}_name", 100);
    $kickMessage = inputOptionalString($in, 'kick_message', 2000);
    $filter = ADMIN_GEO_FILTERS[$kind];
    withTransaction($db, static function (PDO $db) use ($user, $kind, $filter, $id, $name, $kickMessage): void {
        $row = adminFindRow($db, $filter['table'], $id, "{$kind}_code AS code") ?? adminNotFound('Registro no encontrado.');
        $db->prepare("UPDATE {$filter['table']} SET {$kind}_name = ?, kick_message = ? WHERE id = ?")->execute([$name, $kickMessage, $id]);
        adminRecord($db, $user, $filter['log'], 'edit', "{$name} ({$row['code']})");
    });
    return null;
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array<string, mixed>
 */
function adminGetCountries(PDO $db, array $in, array $user): array
{
    return adminGetGeoFilters($db, $in, 'country');
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array{id: int}
 */
function adminAddCountry(PDO $db, array $in, array $user): array
{
    return adminAddGeoFilter($db, $in, $user, 'country');
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 */
function adminEditCountry(PDO $db, array $in, array $user): null
{
    return adminEditGeoFilter($db, $in, $user, 'country');
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 */
function adminToggleCountry(PDO $db, array $in, array $user): null
{
    return adminToggleFilter($db, $in, $user, 'blocked_countries', 'countries', 'country_name, country_code');
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 */
function adminDeleteCountry(PDO $db, array $in, array $user): null
{
    return adminDeleteFilter($db, $in, $user, 'blocked_countries', 'countries', 'country_name, country_code');
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array<string, mixed>
 */
function adminGetContinents(PDO $db, array $in, array $user): array
{
    return adminGetGeoFilters($db, $in, 'continent');
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array{id: int}
 */
function adminAddContinent(PDO $db, array $in, array $user): array
{
    return adminAddGeoFilter($db, $in, $user, 'continent');
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 */
function adminEditContinent(PDO $db, array $in, array $user): null
{
    return adminEditGeoFilter($db, $in, $user, 'continent');
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 */
function adminToggleContinent(PDO $db, array $in, array $user): null
{
    return adminToggleFilter($db, $in, $user, 'blocked_continents', 'continents', 'continent_name, continent_code');
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 */
function adminDeleteContinent(PDO $db, array $in, array $user): null
{
    return adminDeleteFilter($db, $in, $user, 'blocked_continents', 'continents', 'continent_name, continent_code');
}
