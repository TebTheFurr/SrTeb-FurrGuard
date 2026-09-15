<?php

declare(strict_types=1);

/**
 * FurrGuard - ejecución de las APIs de plugins y módulos (docs/API.md §1 y §2) y las acciones del
 * plugin que no pertenecen a un único módulo de dominio.
 */

require_once __DIR__ . '/detection.php';
require_once __DIR__ . '/furrperms.php';

const PLUGIN_SETTINGS = ['notify_connections', 'notify_hispanic', 'server_name', 'discord_url', 'cache_version'];
const RECHECK_MAX_PLAYERS = 500;
const POLL_MAX_WAIT = 25;
const PLUGIN_DEFAULT_AUTHOR = 'Plugin';

/**
 * POST ?action=… con X-API-Key y cuerpo form-urlencoded; sin sesión ni CORS. Responde y termina.
 *
 * @param array<string, callable(PDO, array<array-key, mixed>): (array<array-key, mixed>|object)> $routes
 */
function pluginApiRun(array $routes): never
{
    try {
        if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? '')) !== 'POST') {
            header('Allow: POST');
            throw new HttpError(405, 'method_not_allowed', 'Esta API solo acepta POST.');
        }
        $db = db() ?? throw new HttpError(503, 'database_unavailable', 'Base de datos no disponible.');
        authenticatePluginRequest($db);
        $action = $_GET['action'] ?? null;
        $handler = is_string($action) ? ($routes[$action] ?? null) : null;
        if ($handler === null) {
            throw new HttpError(404, 'unknown_action', 'Acción desconocida.');
        }
        respondPluginOk($handler($db, $_POST));
    } catch (HttpError $e) {
        respondHttpError($e, 'plugin');
    } catch (PDOException $e) {
        error_log('FurrGuard API de plugins: ' . $e->getMessage());
        if (isDatabaseUnavailableError($e)) {
            sendJson(503, pluginErrorBody('database_unavailable', 'Base de datos no disponible.', ['retry_after' => 5]), ['Retry-After' => '5']);
        }
        respondPluginError(500, 'internal_error', 'Error interno del servidor.');
    } catch (Throwable $e) {
        error_log('FurrGuard API de plugins: ' . $e);
        respondPluginError(500, 'internal_error', 'Error interno del servidor.');
    }
}

// ─── Entradas ───────────────────────────────────────────────────────────────

/**
 * `players` de recheck_players: lista JSON de hasta 500 `{uuid, nick, ip}` válidos.
 *
 * @param array<array-key, mixed> $in
 * @return list<array{uuid: string, nick: string, ip: string}>
 */
function inputPlayerList(array $in): array
{
    $list = inputArray($in, 'players', RECHECK_MAX_PLAYERS);
    if (!array_is_list($list)) {
        throw new ValidationError('El campo players debe ser una lista.', 'players');
    }
    $players = [];
    foreach ($list as $index => $entry) {
        try {
            if (!is_array($entry)) {
                throw new ValidationError('no es un objeto.', 'players');
            }
            $players[] = ['uuid' => inputUuid($entry), 'nick' => inputNick($entry), 'ip' => inputIp($entry)];
        } catch (ValidationError $e) {
            throw new ValidationError("players[{$index}]: " . $e->getMessage(), 'players');
        }
    }
    return $players;
}

/**
 * @param array<array-key, mixed> $in
 */
function pluginAuthor(array $in): string
{
    return inputOptionalString($in, 'added_by', 100) ?? PLUGIN_DEFAULT_AUTHOR;
}

// ─── Acciones ───────────────────────────────────────────────────────────────

/**
 * Mensajes como objeto plano `{clave: valor}`, opcionalmente solo los de un prefijo.
 */
function messagesMap(PDO $db, ?string $prefix = null): object
{
    $stmt = $db->prepare('SELECT `key`, value FROM messages' . ($prefix === null ? '' : ' WHERE `key` LIKE ?') . ' ORDER BY `key`');
    $stmt->execute($prefix === null ? [] : [likePrefix($prefix)]);
    return (object) $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
}

/**
 * Espera hasta `$wait` segundos a que cambie `cache_version`. `recent_actions`: las 10 últimas
 * acciones de whitelist y blacklist, por id creciente, con `details` = "tipo: valor" (sin la parte
 * de auditoría que va tras el separador).
 *
 * @return array{changed: bool, cache_version: int, recent_actions: list<array<string, mixed>>}
 */
function pollChanges(PDO $db, int $lastVersion, int $wait): array
{
    for ($elapsed = 0; ; $elapsed++) {
        $version = (int) getSetting($db, 'cache_version');
        $changed = $lastVersion >= 0 && $version !== $lastVersion;
        if ($changed || $elapsed >= $wait) {
            break;
        }
        sleep(1);
    }
    $rows = $db->query("SELECT id, type, action, details FROM activity_logs WHERE type IN ('whitelist', 'blacklist') ORDER BY id DESC LIMIT 10")->fetchAll();
    $recent = array_map(
        static fn (array $row): array => array_replace($row, ['details' => explode(ACTIVITY_DETAILS_SEPARATOR, (string) $row['details'])[0]]),
        array_reverse($rows)
    );
    return ['changed' => $changed, 'cache_version' => $version, 'recent_actions' => $recent];
}

/**
 * @param array<array-key, mixed> $in
 * @return array{success: true}
 */
function pluginAddWhitelist(PDO $db, array $in): array
{
    $entry = inputListEntry($in);
    $reason = inputOptionalString($in, 'reason', BAN_REASON_MAX);
    $author = pluginAuthor($in);
    withTransaction($db, static function (PDO $db) use ($entry, $reason, $author): void {
        whitelistAdd($db, $entry['type'], $entry['value'], $reason, $author);
        logActivity($db, 'whitelist', 'add', listActivityDetails($entry['type'], $entry['value'], "Por {$author}"));
        incrementCacheVersion($db);
    });
    return ['success' => true];
}

/**
 * @param array<array-key, mixed> $in
 * @return array{success: true, deleted: int}
 */
function pluginRemoveWhitelist(PDO $db, array $in): array
{
    $entry = inputListEntry($in);
    $author = pluginAuthor($in);
    $deleted = withTransaction($db, static function (PDO $db) use ($entry, $author): int {
        $stmt = $db->prepare('DELETE FROM whitelist WHERE type = ? AND value = ?');
        $stmt->execute([$entry['type'], $entry['value']]);
        if ($stmt->rowCount() > 0) {
            logActivity($db, 'whitelist', 'remove', listActivityDetails($entry['type'], $entry['value'], "Por {$author}"));
            incrementCacheVersion($db);
        }
        return $stmt->rowCount();
    });
    return ['success' => true, 'deleted' => $deleted];
}

/**
 * @param array<array-key, mixed> $in
 * @return array{success: true, ban_id: string}
 */
function pluginAddBlacklist(PDO $db, array $in): array
{
    $ban = banAddManual(
        $db,
        inputListEntry($in),
        inputOptionalString($in, 'reason', BAN_REASON_MAX),
        pluginAuthor($in),
        inputInt($in, 'duration', 0, BAN_MAX_DURATION_MINUTES, 0),
        inputBool($in, 'stain_ip', true)
    );
    return ['success' => true, 'ban_id' => $ban['ban_id']];
}

/**
 * Desactiva el baneo y sus hijas. `affected`: filas que estaban activas.
 *
 * @param array<array-key, mixed> $in
 * @return array{success: true, affected: int}
 */
function pluginRemoveBlacklist(PDO $db, array $in): array
{
    $entry = inputListEntry($in);
    $author = pluginAuthor($in);
    $affected = withTransaction($db, static function (PDO $db) use ($entry, $author): int {
        $stmt = $db->prepare('SELECT id, ban_id FROM blacklist WHERE type = ? AND value = ?');
        $stmt->execute([$entry['type'], $entry['value']]);
        $ban = $stmt->fetch();
        if (!is_array($ban)) {
            return 0;
        }
        $update = $db->prepare('UPDATE blacklist SET active = 0 WHERE (id = ? OR parent_id = ?) AND (active IS NULL OR active <> 0)');
        $update->execute([$ban['id'], $ban['id']]);
        if ($update->rowCount() > 0) {
            logActivity($db, 'blacklist', 'disable', listActivityDetails(
                $entry['type'],
                $entry['value'],
                (string) $ban['ban_id'],
                "{$update->rowCount()} filas desactivadas con sus hijas",
                "Por {$author}"
            ));
            incrementCacheVersion($db);
        }
        return $update->rowCount();
    });
    return ['success' => true, 'affected' => $affected];
}
