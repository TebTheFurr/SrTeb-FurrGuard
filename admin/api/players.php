<?php

declare(strict_types=1);

/**
 * FurrGuard - panel: jugadores, conexiones e IPs. Sin la sección `ips` las IPs se ocultan y no se
 * puede buscar por IP.
 */

if (!defined('FURRGUARD_ROOT')) {
    http_response_code(404);
    exit;
}

const ADMIN_CONNECTION_COLUMNS = 'id, uuid, nick, ip, country, country_code, region, city, isp, org, asn, asname,
    is_proxy, is_vpn, is_hosting, is_mobile, game_version, timezone, blocked, block_reason, created_at';
const ADMIN_CONNECTION_FILTERS = [
    'allowed' => 'blocked = 0', 'blocked' => 'blocked = 1', 'proxy' => 'is_proxy = 1',
    'vpn' => 'is_vpn = 1', 'hosting' => 'is_hosting = 1', 'mobile' => 'is_mobile = 1',
];

function adminPlayerColumns(): string
{
    return 'p.id, p.uuid, p.last_nick, p.first_nick, p.last_ip, p.last_country, p.last_country_code, p.is_online, '
        . playerListedSql('whitelist') . ' AS is_whitelisted, ' . playerListedSql('blacklist') . ' AS is_blacklisted, '
        . 'p.total_connections, p.first_seen, p.last_seen';
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array<string, mixed>
 */
function adminGetPlayers(PDO $db, array $in, array $user): array
{
    $filter = inputEnum($in, 'filter', ['all', 'online', 'whitelisted', 'blacklisted'], 'all');
    $canSeeIps = adminCanSeeIps($user);
    [$where, $params] = adminWhere([
        match ($filter) {
            'online' => ['p.is_online = 1', []],
            'whitelisted' => [playerListedSql('whitelist'), []],
            'blacklisted' => [playerListedSql('blacklist'), []],
            default => null,
        },
        adminSearchCondition($in, $canSeeIps ? ['p.last_nick', 'p.first_nick', 'p.uuid', 'p.last_ip'] : ['p.last_nick', 'p.first_nick', 'p.uuid']),
    ]);
    $list = adminPaginate($db, $in, adminPlayerColumns(), "FROM players p{$where}", $params, 'p.last_seen DESC, p.id DESC');
    return adminIpList($list, $canSeeIps, ['last_ip']);
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array<string, mixed>
 */
function adminGetPlayerDetail(PDO $db, array $in, array $user): array
{
    $uuid = inputUuid($in);
    $stmt = $db->prepare('SELECT ' . adminPlayerColumns() . ' FROM players p WHERE p.uuid = ?');
    $stmt->execute([$uuid]);
    $player = $stmt->fetch();
    if (!is_array($player)) {
        adminNotFound('Jugador no encontrado.');
    }
    $canSeeIps = adminCanSeeIps($user);
    $rows = static function (string $sql, array $params) use ($db): array {
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    };

    $nicks = $rows('SELECT nick, first_used, last_used FROM player_nicks WHERE player_id = ? ORDER BY last_used DESC', [$player['id']]);
    $ips = $canSeeIps ? $rows('SELECT ip, country, country_code, isp, first_used, last_used FROM player_ips WHERE player_id = ? ORDER BY last_used DESC', [$player['id']]) : [];
    $connections = $rows('SELECT ' . ADMIN_CONNECTION_COLUMNS . ' FROM player_connections WHERE uuid = ? ORDER BY created_at DESC, id DESC LIMIT 20', [$uuid]);
    $premium = minecraftProfileByName($db, (string) $player['last_nick']);

    $identity = [
        'uuid' => array_values(array_unique(array_filter([$uuid, $premium['status'] === 'premium' ? $premium['uuid'] : null]))),
        'nick' => array_values(array_unique(array_merge([(string) $player['last_nick']], array_map('strval', array_column($nicks, 'nick'))))),
        'ip' => array_map('strval', array_column($ips, 'ip')),
    ];
    if (!$canSeeIps) {
        $player['last_ip'] = null;
    }
    return [
        'player' => $player,
        'nicks' => $nicks,
        'ips' => $ips,
        'recent_connections' => $canSeeIps ? $connections : adminHideIps($connections, ['ip']),
        'whitelist_entries' => adminPlayerListEntries($db, 'whitelist', 'id, type, value', $identity),
        'blacklist_entries' => adminPlayerListEntries($db, 'blacklist', 'id, ban_id, type, value, reason, active, expires_at', $identity),
        'premium' => ['status' => $premium['status'], 'uuid' => $premium['uuid']],
        'ip_hidden' => !$canSeeIps,
    ];
}

/**
 * Entradas de whitelist/blacklist (en cualquier estado) que apuntan a la identidad del jugador.
 *
 * @param array{uuid: list<string>, nick: list<string>, ip: list<string>} $identity
 * @return list<mixed>
 */
function adminPlayerListEntries(PDO $db, string $table, string $columns, array $identity): array
{
    $conditions = [];
    $params = [];
    foreach ($identity as $type => $values) {
        if ($values !== []) {
            $conditions[] = "(type = '{$type}' AND value IN (" . sqlPlaceholders(count($values)) . '))';
            array_push($params, ...$values);
        }
    }
    $stmt = $db->prepare("SELECT {$columns} FROM {$table} WHERE " . implode(' OR ', $conditions) . ' ORDER BY created_at DESC, id DESC');
    $stmt->execute($params);
    return $stmt->fetchAll();
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array{status: string, uuid: ?string, name: ?string}
 */
function adminLookupPlayer(PDO $db, array $in, array $user): array
{
    return minecraftProfileByName($db, inputNick($in, 'player_name'));
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array{uuid: ?string, history: list<array{name: string, changed_at: ?string}>}
 */
function adminGetNameHistory(PDO $db, array $in, array $user): array
{
    return minecraftNameHistory($db, inputNick($in, 'player_name'));
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array<string, mixed>
 */
function adminGetConnections(PDO $db, array $in, array $user): array
{
    $filter = inputEnum($in, 'filter', ['all', ...array_keys(ADMIN_CONNECTION_FILTERS)], 'all');
    $canSeeIps = adminCanSeeIps($user);
    [$where, $params] = adminWhere([
        isset(ADMIN_CONNECTION_FILTERS[$filter]) ? [ADMIN_CONNECTION_FILTERS[$filter], []] : null,
        adminSearchCondition($in, $canSeeIps ? ['nick', 'uuid', 'ip'] : ['nick', 'uuid']),
    ]);
    $list = adminPaginate($db, $in, ADMIN_CONNECTION_COLUMNS, "FROM player_connections{$where}", $params, 'id DESC');
    return adminIpList($list, $canSeeIps, ['ip']);
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array{connection: array<string, mixed>}
 */
function adminGetConnectionDetail(PDO $db, array $in, array $user): array
{
    $connection = adminFindRow($db, 'player_connections', inputInt($in, 'id', 1), ADMIN_CONNECTION_COLUMNS) ?? adminNotFound('Conexión no encontrada.');
    if (!adminCanSeeIps($user)) {
        $connection['ip'] = null;
    }
    return ['connection' => $connection];
}

/**
 * IPs de la página con sus contadores. Las conexiones se cuentan solo para las IPs de la página.
 *
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array{items: list<mixed>, pagination: array{page: int, per_page: int, total: int, total_pages: int}}
 */
function adminGetIps(PDO $db, array $in, array $user): array
{
    [$where, $params] = adminWhere([adminSearchCondition($in, ['ip'])]);
    $page = paginationParams($in);
    $count = $db->prepare("SELECT COUNT(DISTINCT ip) FROM player_ips{$where}");
    $count->execute($params);
    $stmt = $db->prepare(
        "SELECT ip, MAX(country) AS country, MAX(country_code) AS country_code, MAX(isp) AS isp, MAX(asn) AS asn,
                MIN(first_used) AS first_seen, COUNT(DISTINCT player_id) AS player_count
         FROM player_ips{$where} GROUP BY ip ORDER BY first_seen DESC, ip LIMIT {$page['per_page']} OFFSET {$page['offset']}"
    );
    $stmt->execute($params);
    $rows = $stmt->fetchAll();
    $ips = array_map('strval', array_column($rows, 'ip'));

    $connections = [];
    if ($ips !== []) {
        $countStmt = $db->prepare('SELECT ip, COUNT(*) FROM player_connections WHERE ip IN (' . sqlPlaceholders(count($ips)) . ') GROUP BY ip');
        $countStmt->execute($ips);
        $connections = $countStmt->fetchAll(PDO::FETCH_KEY_PAIR);
    }
    $flags = adminIpListFlags($db, $ips);
    $items = array_map(
        static fn (array $row): array => $row + ['connection_count' => (int) ($connections[$row['ip']] ?? 0)] + $flags[(string) $row['ip']],
        $rows
    );
    return paginatedResult($items, (int) $count->fetchColumn(), $page);
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array{ip: array<string, mixed>, players: list<mixed>}
 */
function adminGetIpDetail(PDO $db, array $in, array $user): array
{
    $ip = inputIp($in);
    $stmt = $db->prepare('SELECT COUNT(*) AS rows_found, MAX(country) AS country, MAX(country_code) AS country_code, MAX(isp) AS isp, MAX(asn) AS asn FROM player_ips WHERE ip = ?');
    $stmt->execute([$ip]);
    $info = $stmt->fetch();
    if (!is_array($info) || (int) $info['rows_found'] === 0) {
        adminNotFound('IP no encontrada.');
    }
    unset($info['rows_found']);
    $connections = $db->prepare('SELECT COUNT(*) FROM player_connections WHERE ip = ?');
    $connections->execute([$ip]);
    $players = $db->prepare(
        'SELECT p.uuid, p.last_nick AS nick, MAX(pi.last_used) AS last_used FROM player_ips pi JOIN players p ON p.id = pi.player_id
         WHERE pi.ip = ? GROUP BY p.id, p.uuid, p.last_nick ORDER BY last_used DESC LIMIT 200'
    );
    $players->execute([$ip]);
    return [
        'ip' => ['ip' => $ip] + $info + ['connection_count' => (int) $connections->fetchColumn()] + adminIpListFlags($db, [$ip])[$ip],
        'players' => $players->fetchAll(),
    ];
}

/**
 * ¿Está cada IP en whitelist o en una blacklist en vigor (exacta o por rango)?
 *
 * @param list<string> $ips
 * @return array<string, array{is_whitelisted: bool, is_blacklisted: bool}>
 */
function adminIpListFlags(PDO $db, array $ips): array
{
    $flags = array_fill_keys($ips, ['is_whitelisted' => false, 'is_blacklisted' => false]);
    if ($ips === []) {
        return $flags;
    }
    $candidates = array_values(array_unique(array_merge($ips, array_filter(array_map('normalizeIp', $ips)))));
    foreach (['whitelist' => 'is_whitelisted', 'blacklist' => 'is_blacklisted'] as $table => $flag) {
        $stmt = $db->prepare(
            "SELECT value FROM {$table} WHERE (type = 'ip_range' OR (type = 'ip' AND value IN (" . sqlPlaceholders(count($candidates)) . ')))'
            . ($table === 'blacklist' ? ' AND ' . banInForceSql() : '')
        );
        $stmt->execute($candidates);
        $values = $stmt->fetchAll(PDO::FETCH_COLUMN);
        foreach ($ips as $ip) {
            foreach ($values as $value) {
                if (ipInCidr($ip, (string) $value)) {
                    $flags[$ip][$flag] = true;
                    break;
                }
            }
        }
    }
    return $flags;
}
