<?php

declare(strict_types=1);

/**
 * FurrGuard - utilidades de los handlers del panel: usuario, listas paginadas, búsquedas, IPs
 * ocultas y traza de cambios.
 *
 * `AdminUser` (tipo definido en phpstan.neon) es el usuario que devuelve adminSessionValidate().
 */

if (!defined('FURRGUARD_ROOT')) {
    http_response_code(404);
    exit;
}

require_once FURRGUARD_ROOT . '/includes/plugin_api.php';

/**
 * @param AdminUser $user
 */
function adminActor(array $user): string
{
    return $user['username'] ?? $user['discord_id'];
}

/**
 * Sin la sección `ips` el servidor oculta todas las IPs de jugadores, conexiones y resumen (M3).
 *
 * @param AdminUser $user
 */
function adminCanSeeIps(array $user): bool
{
    return hasPermission($user['role'], 'ips');
}

/**
 * Deja traza de un cambio del panel y, si afecta a los plugins, incrementa cache_version. En
 * whitelist/blacklist `$details` debe salir de listActivityDetails() ("tipo: valor" delante).
 *
 * @param AdminUser $user
 */
function adminRecord(PDO $db, array $user, string $type, string $action, string $details, bool $notifyPlugins = true): void
{
    logActivity($db, $type, $action, $details . ACTIVITY_DETAILS_SEPARATOR . 'Por ' . adminActor($user));
    if ($notifyPlugins) {
        incrementCacheVersion($db);
    }
}

function adminNotFound(string $message): never
{
    throw new HttpError(404, 'not_found', $message);
}

/**
 * @return array<string, mixed>|null
 */
function adminFindRow(PDO $db, string $table, int $id, string $columns): ?array
{
    $stmt = $db->prepare("SELECT {$columns} FROM {$table} WHERE id = ?");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return is_array($row) ? $row : null;
}

/**
 * Valor opcional de una lista cerrada: ausente o vacío → null.
 *
 * @param array<array-key, mixed> $in
 * @param list<string> $allowed
 */
function inputOptionalEnum(array $in, string $key, array $allowed): ?string
{
    $value = inputOptionalString($in, $key, 64);
    if ($value !== null && !in_array($value, $allowed, true)) {
        throw new ValidationError("El campo {$key} debe ser uno de: " . implode(', ', $allowed) . '.', $key);
    }
    return $value;
}

// ─── Listas ─────────────────────────────────────────────────────────────────

/**
 * Condición "contiene" sobre varias columnas con el mismo término. Solo placeholders posicionales:
 * con prepares nativos un placeholder con nombre repetido da error (B3).
 *
 * @param array<array-key, mixed> $in
 * @param list<string> $columns
 * @return array{0: string, 1: list<string>}|null
 */
function adminSearchCondition(array $in, array $columns): ?array
{
    $term = inputOptionalString($in, 'search', 100);
    if ($term === null) {
        return null;
    }
    return [
        implode(' OR ', array_map(static fn (string $column): string => "{$column} LIKE ?", $columns)),
        array_fill(0, count($columns), likePattern($term)),
    ];
}

/**
 * " WHERE (a) AND (b)" y sus parámetros; las condiciones null se ignoran.
 *
 * @param list<array{0: string, 1: list<mixed>}|null> $conditions
 * @return array{0: string, 1: list<mixed>}
 */
function adminWhere(array $conditions): array
{
    $sql = [];
    $params = [];
    foreach ($conditions as $condition) {
        if ($condition !== null) {
            $sql[] = '(' . $condition[0] . ')';
            array_push($params, ...$condition[1]);
        }
    }
    return [$sql === [] ? '' : ' WHERE ' . implode(' AND ', $sql), $params];
}

/**
 * Lista paginada `{items, pagination}`. `$from` es "FROM … [WHERE …]"; LIMIT/OFFSET son enteros ya
 * validados por paginationParams().
 *
 * @param array<array-key, mixed> $in
 * @param list<mixed> $params
 * @return array{items: list<mixed>, pagination: array{page: int, per_page: int, total: int, total_pages: int}}
 */
function adminPaginate(PDO $db, array $in, string $select, string $from, array $params, string $orderBy, int $defaultPerPage = PAGINATION_DEFAULT_PER_PAGE): array
{
    $page = paginationParams($in, $defaultPerPage);
    $count = $db->prepare("SELECT COUNT(*) {$from}");
    $count->execute($params);
    $stmt = $db->prepare("SELECT {$select} {$from} ORDER BY {$orderBy} LIMIT {$page['per_page']} OFFSET {$page['offset']}");
    $stmt->execute($params);
    return paginatedResult($stmt->fetchAll(), (int) $count->fetchColumn(), $page);
}

/**
 * Pone a null las columnas de IP de cada fila.
 *
 * @param list<mixed> $rows
 * @param list<string> $columns
 * @return list<mixed>
 */
function adminHideIps(array $rows, array $columns): array
{
    return array_map(static fn (mixed $row): mixed => is_array($row) ? array_replace($row, array_fill_keys($columns, null)) : $row, $rows);
}

/**
 * Lista con las IPs ocultas si el usuario no tiene la sección `ips`, y `ip_hidden`.
 *
 * @param array{items: list<mixed>, pagination: array{page: int, per_page: int, total: int, total_pages: int}} $list
 * @param list<string> $columns
 * @return array<string, mixed>
 */
function adminIpList(array $list, bool $canSeeIps, array $columns): array
{
    return ['items' => $canSeeIps ? $list['items'] : adminHideIps($list['items'], $columns), 'pagination' => $list['pagination'], 'ip_hidden' => !$canSeeIps];
}

/**
 * Añade `minecraft_name` a filas con `type`/`value` (solo las de tipo uuid tienen nombre).
 *
 * @param list<mixed> $rows
 * @return list<mixed>
 */
function adminWithMinecraftNames(PDO $db, array $rows, int $maxRemote = 5): array
{
    $uuids = [];
    foreach ($rows as $row) {
        if (is_array($row) && $row['type'] === 'uuid') {
            $uuids[] = (string) $row['value'];
        }
    }
    $names = $uuids === [] ? [] : minecraftNamesForUuids($db, $uuids, $maxRemote);
    return array_map(static fn (mixed $row): mixed => is_array($row)
        ? $row + ['minecraft_name' => $row['type'] === 'uuid' ? ($names[(string) $row['value']] ?? null) : null]
        : $row, $rows);
}

/**
 * @return array<string, int>
 */
function adminIntRow(PDO $db, string $sql): array
{
    $row = $db->query($sql)->fetch();
    return is_array($row) ? array_map('intval', $row) : [];
}
