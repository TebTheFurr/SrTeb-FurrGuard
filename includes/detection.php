<?php

declare(strict_types=1);

/**
 * FurrGuard - decisión de acceso de check_player, recheck_players y lookup_player (docs/API.md §1.3).
 *
 * Orden: validación (en el endpoint) → geolocalización → blacklist → whitelist (exime de los pasos
 * siguientes, nunca de la blacklist) → cuenta comprometida → reglas: proxy → vpn → hosting → mobile
 * → proveedor → país → continente.
 *
 * Modo "live" (check_player): ip-api y Mojang remotos, evasión, cuenta comprometida, contadores y
 * registro. Sin live (recheck_players, lookup_player) no se escribe nada.
 */

require_once __DIR__ . '/bans.php';
require_once __DIR__ . '/players.php';

const DETECTION_SETTINGS = [
    'block_proxy', 'block_vpn', 'block_hosting', 'block_mobile', 'ip_api_fail_open',
    'country_change_detection_enabled', 'country_change_continent_only',
    'country_change_min_connections', 'country_change_min_percentage',
];
const PROVIDER_TYPES = ['hosting', 'vpn', 'proxy'];
const AUTO_BAN_AUTHOR = 'FurrGuard';
const DECISION_DEFAULTS = [
    'allowed' => true, 'reason' => 'allowed', 'block_reason' => null, 'block_type' => null,
    'expires_at' => null, 'ban_id' => null, 'blocked_name' => null,
];
const CONTINENT_COUNTRIES = [
    'EU' => 'AD AL AT AX BA BE BG BY CH CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SJ SK SM UA VA XK',
    'NA' => 'AG AI AS BB BM BS BZ CA CR CU DM DO GD GL GP GT HN HT JM KN KY LC MF MQ MS MX NI PA PM PR SV TC TT US VC VG VI',
    'SA' => 'AR BO BR CL CO EC FK GF GY PE PY SR UY VE',
    'AS' => 'AE AF BD BH BN BT CN CY GE HK ID IL IN IQ IR JO JP KG KH KP KR KW KZ LA LB LK MM MN MO MV MY NP OM PH PK PS QA SA SG SY TH TJ TL TM TW UZ VN YE',
    'AF' => 'AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG EH ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RE RW SC SD SH SL SN SO ST SZ TD TG TN TZ UG YT ZA ZM ZW',
    'OC' => 'AU CC CK CX FJ FM GU KI MH MP NC NF NR NU NZ PF PG PN PW SB TO TV UM VU WF WS',
];

// ─── Reglas ─────────────────────────────────────────────────────────────────

/**
 * Ajustes, índices de proveedores y países/continentes activos, cargados una vez por petición.
 *
 * @return DetectionRules
 */
function detectionRules(PDO $db): array
{
    $providers = array_fill_keys(PROVIDER_TYPES, []);
    foreach ($db->query('SELECT id, pattern, type FROM blocked_providers WHERE active = 1 ORDER BY id')->fetchAll() as $row) {
        $providers[(string) $row['type']][] = ['id' => (int) $row['id'], 'pattern' => (string) $row['pattern']];
    }
    $codes = static function (string $sql) use ($db): array {
        $map = [];
        foreach ($db->query($sql)->fetchAll() as $row) {
            $map[strtoupper((string) $row['code'])] = (int) $row['id'];
        }
        return $map;
    };
    return [
        'settings' => getSettings($db, DETECTION_SETTINGS),
        'providers' => array_map('providerIndex', $providers),
        'countries' => $codes('SELECT id, country_code AS code FROM blocked_countries WHERE active = 1'),
        'continents' => $codes('SELECT id, continent_code AS code FROM blocked_continents WHERE active = 1'),
    ];
}

/**
 * Índice de patrones por palabras completas: "aws" coincide con "Amazon AWS" pero no con "Lawson".
 *
 * @param list<array{id: int, pattern: string}> $providers
 * @return array{keys: array<string, int>, max_tokens: int}
 */
function providerIndex(array $providers): array
{
    $keys = [];
    $maxTokens = 0;
    foreach ($providers as $provider) {
        $key = providerKey($provider['pattern']);
        if ($key !== '' && !isset($keys[$key])) {
            $keys[$key] = $provider['id'];
            $maxTokens = max($maxTokens, substr_count($key, ' ') + 1);
        }
    }
    return ['keys' => $keys, 'max_tokens' => $maxTokens];
}

/**
 * Minúsculas, y cada tramo que no sea letra o número pasa a ser un espacio ("Servers.com, Inc."
 * → "servers com inc").
 */
function providerKey(string $text): string
{
    return trim((string) preg_replace('/[^\p{L}\p{N}]+/u', ' ', mb_strtolower(mb_scrub($text))));
}

/**
 * Id del primer proveedor cuyo patrón aparece como palabras completas en algún texto (las frases
 * más largas primero), o null.
 *
 * @param array{keys: array<string, int>, max_tokens: int} $index
 * @param list<string> $texts
 */
function providerMatch(array $index, array $texts): ?int
{
    foreach ($texts as $text) {
        $tokens = explode(' ', providerKey($text));
        $count = count($tokens);
        for ($size = min($index['max_tokens'], $count); $size >= 1; $size--) {
            for ($start = 0; $start + $size <= $count; $start++) {
                $id = $index['keys'][implode(' ', array_slice($tokens, $start, $size))] ?? null;
                if ($id !== null) {
                    return $id;
                }
            }
        }
    }
    return null;
}

function countryContinent(string $countryCode): ?string
{
    static $map = null;
    if ($map === null) {
        $map = [];
        foreach (CONTINENT_COUNTRIES as $continent => $countries) {
            foreach (explode(' ', $countries) as $code) {
                $map[$code] = $continent;
            }
        }
    }
    return $map[strtoupper($countryCode)] ?? null;
}

/**
 * Reglas automáticas en orden. `table`/`id`: contador a incrementar si bloquea.
 * Proveedores: `proxy` con block_proxy, `vpn` con block_vpn (aunque ip-api no marque hosting) y
 * `hosting` con block_hosting. Sin datos de ip-api (degradado) proxy/hosting/mobile no se evalúan.
 *
 * @param DetectionRules $rules
 * @param array<string, mixed> $data
 * @return array{reason: string, table: ?string, id: ?int}|null
 */
function matchDetectionRule(array $rules, array $data): ?array
{
    $on = static fn (string $key): bool => ($rules['settings'][$key] ?? '0') === '1';
    $texts = [];
    foreach (['isp', 'org', 'as', 'asname'] as $field) {
        if (is_string($data[$field] ?? null) && $data[$field] !== '') {
            $texts[] = $data[$field];
        }
    }
    $provider = static fn (string $type): ?int => providerMatch($rules['providers'][$type], $texts);
    $hit = static fn (string $reason, ?string $table = null, ?int $id = null): array => ['reason' => $reason, 'table' => $table, 'id' => $id];

    if ($on('block_proxy')) {
        if (($data['proxy'] ?? null) === true) {
            return $hit('proxy_detected');
        }
        if (($id = $provider('proxy')) !== null) {
            return $hit('proxy_detected', 'blocked_providers', $id);
        }
    }
    if ($on('block_vpn') && ($id = $provider('vpn')) !== null) {
        return $hit('vpn_detected', 'blocked_providers', $id);
    }
    if ($on('block_hosting') && ($data['hosting'] ?? null) === true) {
        return $hit('hosting_detected');
    }
    if ($on('block_mobile') && ($data['mobile'] ?? null) === true) {
        return $hit('mobile_detected');
    }
    if ($on('block_hosting') && ($id = $provider('hosting')) !== null) {
        return $hit('blocked_provider', 'blocked_providers', $id);
    }
    $country = is_string($data['countryCode'] ?? null) ? strtoupper($data['countryCode']) : '';
    if (isset($rules['countries'][$country])) {
        return $hit('blocked_country', 'blocked_countries', $rules['countries'][$country]);
    }
    $continent = is_string($data['continentCode'] ?? null) ? strtoupper($data['continentCode']) : (countryContinent($country) ?? '');
    if (isset($rules['continents'][$continent])) {
        return $hit('blocked_continent', 'blocked_continents', $rules['continents'][$continent]);
    }
    return null;
}

// ─── Cuenta comprometida y evasión ──────────────────────────────────────────

/**
 * Cambio drástico de país: el país actual no está en el historial y el habitual supera el mínimo.
 *
 * Solo cuentan conexiones permitidas (los intentos bloqueados de un atacante no "blanquean" su
 * país). Con UUID se mira solo el UUID; el nick solo se usa si no llega UUID.
 *
 * @param array<string, ?string> $settings
 * @return array{historical_country: string, current_country: string, percentage: float, connections: int}|null
 */
function detectCountryChange(PDO $db, array $settings, ?string $uuid, string $nick, string $countryCode): ?array
{
    if (($settings['country_change_detection_enabled'] ?? '1') !== '1') {
        return null;
    }
    $column = $uuid !== null ? 'uuid' : 'nick';
    $stmt = $db->prepare(
        "SELECT country_code, COUNT(*) AS total FROM player_connections
         WHERE {$column} = ? AND blocked = 0 AND country_code IS NOT NULL AND country_code <> ''
         GROUP BY country_code"
    );
    $stmt->execute([$uuid ?? $nick]);
    $history = [];
    foreach ($stmt->fetchAll() as $row) {
        $code = strtoupper((string) $row['country_code']);
        $history[$code] = ($history[$code] ?? 0) + (int) $row['total'];
    }
    $totalConnections = array_sum($history);
    $current = strtoupper($countryCode);
    if ($totalConnections < max(1, (int) ($settings['country_change_min_connections'] ?? '3')) || isset($history[$current])) {
        return null;
    }
    arsort($history);
    $habitual = (string) array_key_first($history);
    $percentage = $history[$habitual] * 100 / $totalConnections;
    if ($percentage < (float) ($settings['country_change_min_percentage'] ?? '70')) {
        return null;
    }
    if (($settings['country_change_continent_only'] ?? '0') === '1') {
        $from = countryContinent($habitual);
        $to = countryContinent($current);
        if ($from === null || $to === null || $from === $to) {
            return null;
        }
    }
    return ['historical_country' => $habitual, 'current_country' => $current, 'percentage' => round($percentage, 1), 'connections' => $totalConnections];
}

/**
 * Baneo automático por cuenta comprometida: UUID (o nick si no hay UUID) como raíz, y nick e IP
 * (IPv6 /64) como hijas. Devuelve la fila del baneo raíz.
 *
 * @param array{historical_country: string, current_country: string, percentage: float, connections: int} $change
 * @return array<string, mixed>
 */
function banCompromisedAccount(PDO $db, ?string $uuid, string $nick, string $ip, array $change): array
{
    $base = [
        'reason' => sprintf('Cuenta comprometida: cambio de país %s → %s', $change['historical_country'], $change['current_country']),
        'added_by' => AUTO_BAN_AUTHOR,
    ];
    return withTransaction($db, static function (PDO $db) use ($uuid, $nick, $ip, $change, $base): array {
        $root = upsertBan($db, ($uuid !== null ? ['type' => 'uuid', 'value' => $uuid] : ['type' => 'nick', 'value' => $nick]) + $base, 'auto');
        if ($uuid !== null) {
            upsertBan($db, ['type' => 'nick', 'value' => $nick, 'parent_id' => $root['id']] + $base, 'auto');
        }
        $target = autoBanIpTarget($ip);
        if ($target !== null) {
            upsertBan($db, $target + $base + ['parent_id' => $root['id']], 'auto');
        }
        logActivity($db, 'security', 'compromised_account', sprintf(
            '%s (%s): %s → %s; %.1f %% de %d conexiones desde el país habitual. Baneo %s.',
            $nick,
            $uuid ?? 'sin UUID',
            $change['historical_country'],
            $change['current_country'],
            $change['percentage'],
            $change['connections'],
            $root['ban_id']
        ));
        incrementCacheVersion($db);
        return banFind($db, $root['id']) ?? [];
    });
}

/**
 * Evasión: quien está baneado por uuid o nick entra desde una IP sin baneo → esa IP (IPv6 /64) pasa
 * a ser hija del baneo raíz, con su expiración.
 *
 * @param array<string, mixed> $ban baneo en vigor que ha coincidido
 */
function banEvasionIp(PDO $db, array $ban, string $ip): void
{
    $target = autoBanIpTarget($ip);
    if ($target === null || findActiveBan($db, [], null, $ip, null) !== null) {
        return;
    }
    $root = $ban['parent_id'] === null ? $ban : (banFind($db, (int) $ban['parent_id']) ?? $ban);
    $result = upsertBan($db, $target + [
        'reason' => sprintf('%s (evasión del baneo %s)', $root['reason'] ?? 'Sin motivo', $root['ban_id']),
        'added_by' => AUTO_BAN_AUTHOR,
        'parent_id' => (int) $root['id'],
    ], 'auto');
    if ($result['status'] !== 'in_force') {
        incrementCacheVersion($db);
    }
}

/**
 * Nombre al que se refiere un baneo (`blocked_name`): el del UUID raíz o el nick raíz.
 *
 * @param array<string, mixed> $ban
 */
function banDisplayName(PDO $db, array $ban, bool $remote): ?string
{
    $root = $ban['parent_id'] === null ? $ban : banFind($db, (int) $ban['parent_id']);
    if ($root === null || !in_array($root['type'], ['uuid', 'nick'], true)) {
        return null;
    }
    if ($root['type'] === 'nick') {
        return (string) $root['value'];
    }
    $name = minecraftNameByUuid($db, (string) $root['value'], $remote);
    if ($name !== null) {
        return $name;
    }
    $stmt = $db->prepare('SELECT last_nick FROM players WHERE uuid = ?');
    $stmt->execute([$root['value']]);
    $nick = $stmt->fetchColumn();
    return is_string($nick) ? $nick : null;
}

// ─── Decisión ───────────────────────────────────────────────────────────────

/**
 * @param DetectionRules $rules
 * @param array{uuid: ?string, nick: string, ip: string, game_version?: ?string} $player normalizado
 * @return array{decision: array<string, mixed>, geo: array{data: array<string, mixed>, source: string, degraded: bool}}
 */
function evaluatePlayer(PDO $db, array $rules, array $player, bool $remote, bool $live): array
{
    $geo = geoLookup($db, $player['ip'], $remote);
    $data = $geo['data'];
    $asn = is_string($data['as'] ?? null) ? normalizeAsn($data['as']) : null;
    $decide = static fn (array $decision): array => ['decision' => $decision + DECISION_DEFAULTS, 'geo' => $geo];

    // 3. Blacklist. El UUID premium del nick también cuenta: un baneo nunca se esquiva entrando en offline.
    $profile = minecraftProfileByName($db, $player['nick'], $remote);
    $uuids = array_values(array_unique(array_filter([$player['uuid'], $profile['status'] === 'premium' ? $profile['uuid'] : null])));
    $ban = findActiveBan($db, $uuids, $player['nick'], $player['ip'], $asn);
    if ($ban !== null) {
        if ($live && in_array($ban['type'], ['uuid', 'nick'], true)) {
            banEvasionIp($db, $ban, $player['ip']);
        }
        return $decide(banDecision('blacklisted', $ban) + ['blocked_name' => banDisplayName($db, $ban, $remote)]);
    }

    // 4. Whitelist: solo el UUID que llega (el premium resuelto por nick nunca exime).
    if (findWhitelistEntry($db, $player['uuid'], $player['nick'], $player['ip'], $asn) !== null) {
        return $decide(['reason' => 'whitelisted']);
    }

    // Sin ningún dato de geolocalización no se puede evaluar nada más. Una IP privada nunca tiene datos.
    if ($data === []) {
        $failClosed = isPublicIp($player['ip']) && ($rules['settings']['ip_api_fail_open'] ?? '0') !== '1';
        return $decide($failClosed ? ['allowed' => false, 'reason' => 'ip_api_unavailable'] : []);
    }

    // 5. Cuenta comprometida. Extensión de §1.3: la respuesta trae los códigos ISO de ambos países.
    if ($live && is_string($data['countryCode'] ?? null) && $data['countryCode'] !== '') {
        $change = detectCountryChange($db, $rules['settings'], $player['uuid'], $player['nick'], $data['countryCode']);
        if ($change !== null) {
            $root = banCompromisedAccount($db, $player['uuid'], $player['nick'], $player['ip'], $change);
            return $decide(banDecision('compromised_account', $root) + [
                'historical_country' => $change['historical_country'],
                'current_country' => $change['current_country'],
            ]);
        }
    }

    // 6. Reglas automáticas.
    $rule = matchDetectionRule($rules, $data);
    if ($rule === null) {
        return $decide([]);
    }
    if ($live && $rule['table'] !== null) {
        $db->prepare("UPDATE {$rule['table']} SET block_count = COALESCE(block_count, 0) + 1 WHERE id = ?")->execute([$rule['id']]);
    }
    return $decide(['allowed' => false, 'reason' => $rule['reason']]);
}

/**
 * @param array<string, mixed> $ban
 * @return array<string, mixed>
 */
function banDecision(string $reason, array $ban): array
{
    return [
        'allowed' => false,
        'reason' => $reason,
        'block_reason' => $ban['reason'] ?? null,
        'block_type' => $ban['type'] ?? null,
        'expires_at' => $ban['expires_at'] ?? null,
        'ban_id' => $ban['ban_id'] ?? null,
    ];
}

/**
 * check_player: decisión completa, registro de la conexión y ficha del jugador.
 *
 * @param array{uuid: ?string, nick: string, ip: string, game_version: ?string} $player normalizado
 * @return array<string, mixed>
 */
function checkPlayer(PDO $db, array $player): array
{
    $result = evaluatePlayer($db, detectionRules($db), $player, true, true);
    $decision = $result['decision'];
    $data = $result['geo']['data'];
    logPlayerConnection($db, $player, $data, $decision['allowed'] !== true, $decision['allowed'] === true ? null : (string) $decision['reason']);
    if ($player['uuid'] !== null) {
        updatePlayerInfo($db, $player['uuid'], $player['nick'], $player['ip'], $data);
    }
    return $decision + ['degraded' => $result['geo']['degraded'], 'ip_data' => (object) $data];
}

/**
 * recheck_players: sin registrar conexiones, sin contadores, sin ip-api ni Mojang remotos y sin
 * detección de cuenta comprometida.
 *
 * @param list<array{uuid: string, nick: string, ip: string}> $players
 * @return array{results: list<array<string, mixed>>}
 */
function recheckPlayers(PDO $db, array $players): array
{
    $rules = detectionRules($db);
    $results = [];
    foreach ($players as $player) {
        $decision = evaluatePlayer($db, $rules, $player, false, false)['decision'];
        $results[] = ['uuid' => $player['uuid']] + array_intersect_key($decision, array_flip(['allowed', 'reason', 'block_reason', 'block_type', 'expires_at', 'ban_id']));
    }
    return ['results' => $results];
}

/**
 * lookup_player: qué pasaría si el jugador entrase ahora con su última IP. Consulta ip-api y Mojang
 * (con caché) pero no registra nada ni ejecuta la detección de cuenta comprometida.
 *
 * @return array<string, mixed>
 */
function lookupPlayer(PDO $db, string $nick): array
{
    $row = findPlayerByNick($db, $nick);
    $uuid = is_array($row) ? normalizeUuid((string) $row['uuid']) : null;
    $ip = is_array($row) ? normalizeIp(is_string($row['last_ip']) ? $row['last_ip'] : null) : null;
    if ($row === null || $ip === null) {
        return ['found' => false];
    }
    $result = evaluatePlayer($db, detectionRules($db), ['uuid' => $uuid, 'nick' => (string) $row['last_nick'], 'ip' => $ip], true, false);
    $decision = $result['decision'];
    return [
        'found' => true,
        'uuid' => $uuid,
        'nick' => $row['last_nick'],
        'ip' => $ip,
        'is_online' => (int) $row['is_online'] === 1,
        'first_seen' => $row['first_seen'],
        'last_seen' => $row['last_seen'],
        'allowed' => $decision['allowed'],
        'reason' => $decision['reason'],
        'block_type' => $decision['block_type'],
        'expires_at' => $decision['expires_at'],
        'ban_id' => $decision['ban_id'],
        'ip_data' => (object) $result['geo']['data'],
    ];
}
