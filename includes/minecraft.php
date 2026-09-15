<?php

declare(strict_types=1);

/**
 * FurrGuard - perfiles de Minecraft (Mojang) con caché, e historial de nombres (Laby + NameMC).
 *
 * La red admite jugadores no premium: un nick no es una identidad. "not_found" solo significa que
 * Mojang no conoce ese nombre; "unknown" (429, 5xx, timeout) no se cachea nunca (B7).
 */

const MOJANG_PROFILE_BY_NAME_URL = 'https://api.mojang.com/minecraft/profile/lookup/name/';
const MOJANG_PROFILE_BY_UUID_URL = 'https://api.minecraftservices.com/minecraft/profile/lookup/';
const MINECRAFT_PREMIUM_TTL = 86400;
const MINECRAFT_NOT_FOUND_TTL = 21600;
const MINECRAFT_UUID_NAME_TTL = 604800;
const MINECRAFT_CONNECT_TIMEOUT = 2;
const MINECRAFT_TIMEOUT = 4;
const MOJANG_NAME_PATTERN = '/^[A-Za-z0-9_]{1,16}\z/';

/**
 * Sustituto del cliente HTTP para tests: fn(string $url): array{status:int, headers:array<string,string>, body:?string}.
 */
function minecraftUseHttpClient(?callable $client): void
{
    $holder = &minecraftHttpClientHolder();
    $holder = $client;
}

function &minecraftHttpClientHolder(): ?callable
{
    static $client = null;
    return $client;
}

/**
 * @param list<string> $headers
 * @return array{status: int, headers: array<string, string>, body: ?string}
 */
function minecraftHttpGet(string $url, int $connectTimeout = MINECRAFT_CONNECT_TIMEOUT, int $timeout = MINECRAFT_TIMEOUT, array $headers = ['Accept: application/json'], bool $followRedirects = false): array
{
    $client = minecraftHttpClientHolder();
    return $client !== null ? $client($url) : httpGet($url, $connectTimeout, $timeout, $headers, $followRedirects);
}

/**
 * ¿Es un UUID que Mojang puede conocer? Los offline (v3, `OfflinePlayer:<nick>`) y los de Floodgate
 * (v0) nunca existen en Mojang y no se consultan.
 */
function isMojangUuid(string $uuid): bool
{
    $uuid = normalizeUuid($uuid);
    return $uuid !== null && $uuid[14] === '4';
}

/**
 * Perfil premium por nombre, con caché en `minecraft_profiles` (premium 24 h, not_found 6 h).
 *
 * @return array{status: string, uuid: ?string, name: ?string} status: premium|not_found|unknown
 */
function minecraftProfileByName(PDO $db, string $name, bool $allowRemote = true): array
{
    $name = trim($name);
    if (preg_match(MOJANG_NAME_PATTERN, $name) !== 1) {
        return ['status' => 'not_found', 'uuid' => null, 'name' => null];
    }

    $stmt = $db->prepare('SELECT status, uuid, name FROM minecraft_profiles WHERE lookup_name = ? AND expires_at > NOW()');
    $stmt->execute([$name]);
    $row = $stmt->fetch();
    if (is_array($row)) {
        return ['status' => (string) $row['status'], 'uuid' => $row['uuid'], 'name' => $row['name']];
    }
    if (!$allowRemote) {
        return ['status' => 'unknown', 'uuid' => null, 'name' => null];
    }

    $response = minecraftHttpGet(MOJANG_PROFILE_BY_NAME_URL . rawurlencode($name));
    $profile = parseMojangProfile($response);
    if ($profile !== null) {
        minecraftProfileCacheWrite($db, $name, 'premium', $profile['uuid'], $profile['name'], MINECRAFT_PREMIUM_TTL);
        return ['status' => 'premium', 'uuid' => $profile['uuid'], 'name' => $profile['name']];
    }
    if ($response['status'] === 404 || $response['status'] === 204) {
        minecraftProfileCacheWrite($db, $name, 'not_found', null, null, MINECRAFT_NOT_FOUND_TTL);
        return ['status' => 'not_found', 'uuid' => null, 'name' => null];
    }
    error_log("FurrGuard Mojang: respuesta {$response['status']} consultando un nombre; estado desconocido");
    return ['status' => 'unknown', 'uuid' => null, 'name' => null];
}

/**
 * @param array{status: int, headers: array<string, string>, body: ?string} $response
 * @return array{uuid: string, name: string}|null
 */
function parseMojangProfile(array $response): ?array
{
    if ($response['status'] !== 200 || $response['body'] === null) {
        return null;
    }
    $data = json_decode($response['body'], true);
    $uuid = is_array($data) && is_string($data['id'] ?? null) ? normalizeUuid($data['id']) : null;
    $name = is_array($data) && is_string($data['name'] ?? null) ? $data['name'] : null;
    if ($uuid === null || $name === null || preg_match(MOJANG_NAME_PATTERN, $name) !== 1) {
        return null;
    }
    return ['uuid' => $uuid, 'name' => $name];
}

function minecraftProfileCacheWrite(PDO $db, string $lookupName, string $status, ?string $uuid, ?string $name, int $ttl): void
{
    $db->prepare(
        'INSERT INTO minecraft_profiles (lookup_name, status, uuid, name, checked_at, expires_at)
         VALUES (?, ?, ?, ?, NOW(), NOW() + INTERVAL ? SECOND)
         ON DUPLICATE KEY UPDATE status = VALUES(status), uuid = VALUES(uuid), name = VALUES(name),
                                 checked_at = VALUES(checked_at), expires_at = VALUES(expires_at)'
    )->execute([$lookupName, $status, $uuid, $name, $ttl]);
}

/**
 * Nombre actual de un UUID (para mostrar), con caché positiva y negativa de 7 días. Si Mojang no
 * responde devuelve el último nombre conocido aunque haya caducado.
 */
function minecraftNameByUuid(PDO $db, string $uuid, bool $allowRemote = true): ?string
{
    $uuid = normalizeUuid($uuid);
    if ($uuid === null) {
        return null;
    }
    $rows = minecraftNameCacheRows($db, [$uuid]);
    $row = $rows[$uuid] ?? null;
    if ($row !== null && $row['fresh']) {
        return $row['status'] === 'premium' ? $row['username'] : null;
    }
    if ($allowRemote && isMojangUuid($uuid)) {
        $fetched = minecraftFetchNameByUuid($db, $uuid);
        if ($fetched['status'] !== 'unknown') {
            return $fetched['name'];
        }
    }
    return $row['username'] ?? null;
}

/**
 * Nombres para un listado: usa la caché y consulta a Mojang como mucho `$maxRemote` UUID.
 *
 * @param list<string> $uuids
 * @return array<string, string> uuid normalizado => nombre
 */
function minecraftNamesForUuids(PDO $db, array $uuids, int $maxRemote = 5): array
{
    $normalized = array_values(array_unique(array_filter(array_map('normalizeUuid', $uuids))));
    $rows = minecraftNameCacheRows($db, $normalized);
    $names = [];
    foreach ($normalized as $uuid) {
        $row = $rows[$uuid] ?? null;
        if ($row !== null && $row['fresh']) {
            if ($row['status'] === 'premium' && $row['username'] !== null) {
                $names[$uuid] = $row['username'];
            }
            continue;
        }
        if ($maxRemote > 0 && isMojangUuid($uuid)) {
            $maxRemote--;
            $fetched = minecraftFetchNameByUuid($db, $uuid);
            if ($fetched['status'] !== 'unknown') {
                if ($fetched['name'] !== null) {
                    $names[$uuid] = $fetched['name'];
                }
                continue;
            }
        }
        if ($row !== null && $row['username'] !== null) {
            $names[$uuid] = $row['username'];
        }
    }
    return $names;
}

/**
 * @param list<string> $uuids normalizados
 * @return array<string, array{username: ?string, status: string, fresh: bool}>
 */
function minecraftNameCacheRows(PDO $db, array $uuids): array
{
    $rows = [];
    foreach (array_chunk($uuids, 500) as $chunk) {
        $stmt = $db->prepare(
            'SELECT uuid, username, status, (expires_at IS NOT NULL AND expires_at > NOW()) AS fresh
             FROM minecraft_names_cache WHERE uuid IN (' . implode(',', array_fill(0, count($chunk), '?')) . ')'
        );
        $stmt->execute($chunk);
        foreach ($stmt->fetchAll() as $row) {
            $rows[(string) $row['uuid']] = [
                'username' => $row['username'],
                'status' => (string) $row['status'],
                'fresh' => (int) $row['fresh'] === 1,
            ];
        }
    }
    return $rows;
}

/**
 * @return array{status: string, name: ?string} status: premium|not_found|unknown
 */
function minecraftFetchNameByUuid(PDO $db, string $uuid): array
{
    $response = minecraftHttpGet(MOJANG_PROFILE_BY_UUID_URL . $uuid);
    $profile = parseMojangProfile($response);
    if ($profile !== null) {
        minecraftNameCacheWrite($db, $uuid, $profile['name'], 'premium');
        return ['status' => 'premium', 'name' => $profile['name']];
    }
    if ($response['status'] === 404 || $response['status'] === 204) {
        minecraftNameCacheWrite($db, $uuid, null, 'not_found');
        return ['status' => 'not_found', 'name' => null];
    }
    return ['status' => 'unknown', 'name' => null];
}

function minecraftNameCacheWrite(PDO $db, string $uuid, ?string $username, string $status): void
{
    $db->prepare(
        'INSERT INTO minecraft_names_cache (uuid, username, status, expires_at) VALUES (?, ?, ?, NOW() + INTERVAL ? SECOND)
         ON DUPLICATE KEY UPDATE username = VALUES(username), status = VALUES(status), expires_at = VALUES(expires_at)'
    )->execute([$uuid, $username, $status, MINECRAFT_UUID_NAME_TTL]);
}

// ─── Historial de nombres ───────────────────────────────────────────────────

/**
 * Historial de nombres combinando Laby.net y NameMC. Fechas en UTC `Y-m-d H:i:s`.
 *
 * `failed_sources` lista las fuentes que no se pudieron consultar (mojang, laby, namemc; si Mojang no
 * responde tampoco hay UUID para Laby) y `complete` es false si hay alguna: puede faltar historial.
 * Un nick que Mojang no conoce no tiene historial en Laby: eso no es un fallo.
 *
 * @return array{uuid: ?string, history: list<array{name: string, changed_at: ?string}>, complete: bool, failed_sources: list<string>}
 */
function minecraftNameHistory(PDO $db, string $playerName): array
{
    $playerName = trim($playerName);
    if (preg_match(MOJANG_NAME_PATTERN, $playerName) !== 1) {
        return ['uuid' => null, 'history' => [], 'complete' => true, 'failed_sources' => []];
    }
    $profile = minecraftProfileByName($db, $playerName);
    $currentName = $profile['name'] ?? $playerName;
    $mojangFailed = $profile['status'] === 'unknown';
    $laby = $profile['uuid'] !== null ? fetchLabyNameHistory($profile['uuid']) : ($mojangFailed ? null : []);
    $nameMc = fetchNameMcNameHistory($currentName);
    $failed = $mojangFailed ? ['mojang'] : [];
    if ($laby === null) {
        $failed[] = 'laby';
    }
    if ($nameMc === null) {
        $failed[] = 'namemc';
    }
    return [
        'uuid' => $profile['uuid'],
        'history' => mergeNameHistorySources(array_merge($laby ?? [], $nameMc ?? []), $currentName),
        'complete' => $failed === [],
        'failed_sources' => $failed,
    ];
}

/**
 * @return list<array{name: string, changed_at: ?string}>|null null si Laby no respondió
 */
function fetchLabyNameHistory(string $uuid): ?array
{
    $response = minecraftHttpGet('https://laby.net/api/user/' . str_replace('-', '', $uuid) . '/get-names', 3, 6);
    $data = $response['status'] === 200 && $response['body'] !== null ? json_decode($response['body'], true) : null;
    if (!is_array($data)) {
        return null;
    }
    $rows = [];
    foreach ($data as $entry) {
        if (is_array($entry) && is_string($entry['name'] ?? null)) {
            $rows[] = ['name' => $entry['name'], 'changed_at' => is_string($entry['changed_at'] ?? null) ? $entry['changed_at'] : null];
        }
    }
    return $rows;
}

/**
 * @return list<array{name: string, changed_at: ?string}>|null null si NameMC no respondió (una página
 *         sin tabla de nombres es una respuesta válida: ese perfil no tiene historial)
 */
function fetchNameMcNameHistory(string $username): ?array
{
    if (preg_match(MOJANG_NAME_PATTERN, $username) !== 1) {
        return [];
    }
    $response = minecraftHttpGet(
        'https://namemc.com/profile/' . $username,
        3,
        6,
        ['Accept: text/html,application/xhtml+xml', 'Accept-Language: en-US,en;q=0.5'],
        true
    );
    if ($response['status'] !== 200 || $response['body'] === null) {
        return null;
    }
    if (!preg_match('/<table[^>]*class="[^"]*table-(?:borderless|striped)[^"]*"[^>]*>(.*?)<\/table>/is', $response['body'], $table)) {
        return [];
    }
    preg_match_all('/<tr[^>]*>(.*?)<\/tr>/is', $table[1], $matches);
    $rows = [];
    foreach ($matches[1] as $row) {
        if (!preg_match('/<a[^>]*href="\/search\?q=[^"]+"[^>]*>(.*?)<\/a>/is', $row, $nameMatch)) {
            continue;
        }
        $name = trim(strip_tags($nameMatch[1]));
        if ($name === '') {
            continue;
        }
        $changedAt = preg_match('/<time[^>]*datetime="([^"]+)"/i', $row, $timeMatch) ? trim($timeMatch[1]) : null;
        $rows[] = ['name' => $name, 'changed_at' => $changedAt];
    }
    return $rows;
}

/**
 * Une las fuentes: descarta el "sin fecha" de un nombre que también tiene fecha, ordena
 * cronológicamente (sin fecha primero), quita repeticiones consecutivas y asegura el nombre actual.
 *
 * @param list<array{name: string, changed_at: ?string}> $rows
 * @return list<array{name: string, changed_at: ?string}>
 */
function mergeNameHistorySources(array $rows, string $currentName): array
{
    $byName = [];
    foreach ($rows as $row) {
        $timestamp = null;
        if ($row['changed_at'] !== null) {
            $parsed = strtotime($row['changed_at']);
            $timestamp = $parsed === false ? null : $parsed;
        }
        $byName[strtolower($row['name'])][] = ['name' => $row['name'], 'ts' => $timestamp];
    }

    $entries = [];
    foreach ($byName as $group) {
        $dated = array_filter($group, static fn (array $e): bool => $e['ts'] !== null);
        array_push($entries, ...($dated !== [] ? array_values($dated) : $group));
    }
    usort($entries, static fn (array $a, array $b): int => ($a['ts'] ?? PHP_INT_MIN) <=> ($b['ts'] ?? PHP_INT_MIN));

    $merged = [];
    foreach ($entries as $entry) {
        $last = $merged === [] ? null : $merged[count($merged) - 1];
        if ($last === null || strtolower($last['name']) !== strtolower($entry['name'])) {
            $merged[] = ['name' => $entry['name'], 'changed_at' => $entry['ts'] === null ? null : gmdate('Y-m-d H:i:s', $entry['ts'])];
        }
    }
    $last = $merged === [] ? null : $merged[count($merged) - 1];
    if ($last === null || strtolower($last['name']) !== strtolower($currentName)) {
        $merged[] = ['name' => $currentName, 'changed_at' => null];
    }
    return $merged;
}
