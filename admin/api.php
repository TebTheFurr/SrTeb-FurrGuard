<?php
/**
 * FurrGuard Admin API
 *
 * @author GrinchHorizon
 * @copyright SrTeb Limited
 * @website https://srteb.eu
 * @version 1.5.0
 */

header('Content-Type: application/json');

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../includes/functions.php';

// Check database connection early
$db = db();
if ($db === null) {
    http_response_code(503);
    echo json_encode(['success' => false, 'error' => 'Error de conexión a la base de datos']);
    exit;
}

// Rate limit: 60 requests per minute per IP for admin API
$clientIp = getClientIp();
enforceRateLimit($clientIp, 60, 60, 'admin_api');

if (!isset($_SESSION['furrguard_admin'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'No autenticado']);
    exit;
}

// Validate session integrity (IP binding)
if (!validateSessionIntegrity()) {
    session_destroy();
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Sesión inválida']);
    exit;
}

// Check session expiration
if (isset($_SESSION['furrguard_admin']['expires_at'])) {
    $expiresAt = strtotime($_SESSION['furrguard_admin']['expires_at']);
    if ($expiresAt && time() > $expiresAt) {
        session_destroy();
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Sesión expirada']);
        exit;
    }
}

$currentRole = $_SESSION['furrguard_admin']['role'] ?? null;
if (!$currentRole) {
    $discordId = $_SESSION['furrguard_admin']['discord_id'] ?? '';
    $currentRole = getUserRole($discordId);
    if ($currentRole) {
        $_SESSION['furrguard_admin']['role'] = $currentRole;
    } else {
        echo json_encode(['success' => false, 'error' => 'Rol no definido']);
        exit;
    }
}

function checkPermission(string $section): void {
    global $currentRole;
    if (!hasPermission($currentRole, $section)) {
        header('HTTP/1.1 403 Forbidden');
        echo json_encode(['success' => false, 'error' => 'Sin permisos para esta sección']);
        exit;
    }
}

$rawInput = file_get_contents('php://input');
if ($rawInput === false || strlen($rawInput) > 1048576) { // 1MB max
    echo json_encode(['success' => false, 'error' => 'Solicitud inválida']);
    exit;
}
$input = json_decode($rawInput, true);
if (!is_array($input)) {
    $input = [];
}
$action = $input['action'] ?? '';

// Sanitize common search inputs
if (isset($input['search'])) {
    $input['search'] = sanitizeSearchInput($input['search']);
}

$response = ['success' => false];

try {
    $db = db();

    // Permission map: action -> required section
    $actionPermissions = [
        'get_overview' => 'overview',
        'get_players' => 'players', 'get_player_detail' => 'players',
        'get_connections' => 'connections', 'get_connection_detail' => 'connections',
        'get_ips' => 'ips', 'get_ip_detail' => 'ips',
        'get_whitelist' => 'whitelist', 'add_whitelist' => 'whitelist', 'edit_whitelist' => 'whitelist', 'remove_whitelist' => 'whitelist', 'remove_whitelist_by_value' => 'whitelist',
        'get_blacklist' => 'blacklist', 'add_blacklist' => 'blacklist', 'edit_blacklist' => 'blacklist', 'remove_blacklist' => 'blacklist', 'remove_blacklist_by_value' => 'blacklist', 'toggle_blacklist' => 'blacklist', 'add_blacklist_ip' => 'blacklist', 'add_blacklist_unified' => 'blacklist',
        'get_providers' => 'providers', 'add_provider' => 'providers', 'toggle_provider' => 'providers',
        'get_countries' => 'countries', 'add_country' => 'countries', 'edit_country' => 'countries', 'toggle_country' => 'countries', 'delete_country' => 'countries',
        'get_continents' => 'continents', 'add_continent' => 'continents', 'edit_continent' => 'continents', 'toggle_continent' => 'continents', 'delete_continent' => 'continents',
        'get_messages' => 'messages', 'save_messages' => 'messages',
        'get_logs' => 'logs',
        'get_sanctions' => 'blacklist', 'get_counts' => 'overview',
        'get_settings' => 'settings', 'save_settings' => 'settings', 'regenerate_api_key' => 'settings',
        'export_data' => 'settings',
        'get_admin_users' => 'users', 'add_admin_user' => 'users', 'remove_admin_user' => 'users',
        'get_furr_perms_whitelist' => 'furrperms', 'add_furr_perms_whitelist' => 'furrperms', 'remove_furr_perms_whitelist' => 'furrperms',
        'get_furr_perms_logs' => 'furrperms', 'clear_furr_perms_logs' => 'furrperms',
        'furrsecurity_get_staff' => 'furrsecurity', 'furrsecurity_add_staff' => 'furrsecurity', 'furrsecurity_remove_staff' => 'furrsecurity',
        'furrsecurity_get_sessions' => 'furrsecurity', 'furrsecurity_get_logs' => 'furrsecurity', 'furrsecurity_revoke_session' => 'furrsecurity',
        'furrsecurity_get_stats' => 'furrsecurity',
        'lookup_player' => 'players', 'get_name_history' => 'players',
        'migrate_blacklist' => 'settings', 'migrate_players' => 'settings',
    ];

    if (isset($actionPermissions[$action])) {
        checkPermission($actionPermissions[$action]);
    }

    switch ($action) {
        case 'get_overview':
            $response = getOverview($db);
            break;

        case 'get_players':
            $response = getPlayers($db, $input);
            break;

        case 'get_player_detail':
            $response = getPlayerDetail($db, $input['uuid'] ?? '');
            break;

        case 'get_connections':
            $response = getConnections($db, $input);
            break;

        case 'get_ips':
            $response = getIPs($db, $input);
            break;

        case 'get_ip_detail':
            $response = getIPDetail($db, $input['ip'] ?? '');
            break;

        case 'get_whitelist':
            $response = getWhitelist($db, $input);
            break;

        case 'add_whitelist':
            $response = addWhitelist($db, $input);
            break;

        case 'edit_whitelist':
            $response = editWhitelist($db, $input);
            break;

        case 'remove_whitelist':
            $response = removeWhitelist($db, $input['id'] ?? 0);
            break;

        case 'remove_whitelist_by_value':
            $response = removeWhitelistByValue($db, $input['type'] ?? '', $input['value'] ?? '');
            break;

        case 'get_blacklist':
            $response = getBlacklist($db, $input);
            break;

        case 'add_blacklist':
            $response = addBlacklist($db, $input);
            break;

        case 'edit_blacklist':
            $response = editBlacklist($db, $input);
            break;

        case 'remove_blacklist':
            $response = removeBlacklist($db, $input['id'] ?? 0);
            break;

        case 'remove_blacklist_by_value':
            $response = removeBlacklistByValue($db, $input['type'] ?? '', $input['value'] ?? '');
            break;

        case 'toggle_blacklist':
            $response = toggleBlacklist($db, $input['id'] ?? 0, $input['active'] ?? false);
            break;

        case 'add_blacklist_ip':
            $response = addBlacklistIP($db, $input);
            break;

        case 'get_providers':
            $response = getProviders($db, $input);
            break;

        case 'add_provider':
            $response = addProvider($db, $input);
            break;

        case 'toggle_provider':
            $response = toggleProvider($db, $input['id'] ?? 0, $input['active'] ?? false);
            break;

        case 'get_countries':
            $response = getCountries($db, $input);
            break;

        case 'add_country':
            $response = addCountry($db, $input);
            break;

        case 'edit_country':
            $response = editCountry($db, $input);
            break;

        case 'toggle_country':
            $response = toggleCountry($db, $input['id'] ?? 0, $input['active'] ?? false);
            break;

        case 'delete_country':
            $response = deleteCountry($db, $input['id'] ?? 0);
            break;

        case 'get_continents':
            $response = getContinents($db, $input);
            break;

        case 'add_continent':
            $response = addContinent($db, $input);
            break;

        case 'edit_continent':
            $response = editContinent($db, $input);
            break;

        case 'toggle_continent':
            $response = toggleContinent($db, $input['id'] ?? 0, $input['active'] ?? false);
            break;

        case 'delete_continent':
            $response = deleteContinent($db, $input['id'] ?? 0);
            break;

        case 'get_messages':
            $response = getMessages($db);
            break;

        case 'save_messages':
            $response = saveMessages($db, $input['messages'] ?? []);
            break;

        case 'get_logs':
            $response = getLogs($db, $input['filter'] ?? 'all');
            break;

        case 'get_settings':
            $response = getSettings($db);
            break;

        case 'save_settings':
            $response = saveSettings($db, $input['settings'] ?? []);
            break;

        case 'regenerate_api_key':
            $response = regenerateApiKey($db);
            break;

        case 'get_connection_detail':
            $response = getConnectionDetail($db, $input['id'] ?? 0);
            break;

        case 'get_sanctions':
            $response = getSanctions($db, $input);
            break;

        case 'get_counts':
            $response = getCounts($db);
            break;

        case 'export_data':
            $response = exportData($db);
            break;

        case 'get_admin_users':
            $response = getAdminUsers($db);
            break;

        case 'add_admin_user':
            $response = addAdminUser($db, $input);
            break;

        case 'remove_admin_user':
            $response = removeAdminUser($db, $input['id'] ?? 0);
            break;

        case 'get_furr_perms_whitelist':
            $response = getFurrPermsWhitelist($db, $input);
            break;

        case 'add_furr_perms_whitelist':
            $response = addFurrPermsWhitelist($db, $input);
            break;

        case 'remove_furr_perms_whitelist':
            $response = removeFurrPermsWhitelist($db, $input['id'] ?? 0);
            break;

        case 'get_furr_perms_logs':
            $response = getFurrPermsLogs($db, $input);
            break;

        case 'clear_furr_perms_logs':
            $response = clearFurrPermsLogs($db);
            break;

        // FurrSecurity Actions
        case 'furrsecurity_get_staff':
            $response = getFurrSecurityStaff($db, $input);
            break;

        case 'furrsecurity_add_staff':
            $response = addFurrSecurityStaff($db, $input);
            break;

        case 'furrsecurity_remove_staff':
            $response = removeFurrSecurityStaff($db, $input);
            break;

        case 'furrsecurity_get_sessions':
            $response = getFurrSecuritySessions($db, $input);
            break;

        case 'furrsecurity_get_logs':
            $response = getFurrSecurityLogs($db, $input);
            break;

        case 'furrsecurity_revoke_session':
            $response = revokeFurrSecuritySession($db, $input);
            break;

        case 'furrsecurity_get_stats':
            $response = getFurrSecurityStats($db);
            break;

        case 'lookup_player':
            $response = lookupPlayer($input['player_name'] ?? '');
            break;

        case 'get_name_history':
            $response = getNameHistory($input['player_name'] ?? '');
            break;

        case 'add_blacklist_unified':
            $response = addBlacklistUnified($db, $input);
            break;

        case 'migrate_blacklist':
            $response = migrateBlacklist($db);
            break;

        case 'migrate_players':
            $response = migratePlayers($db);
            break;

        default:
            $response = ['success' => false, 'error' => 'Acción no válida'];
    }

} catch (PDOException $e) {
    error_log('FurrGuard Admin API Error: ' . $e->getMessage());
    http_response_code(500);
    $response = ['success' => false, 'error' => 'Error interno del servidor'];
}

echo json_encode($response);

function getOverview($db) {
    $online = $db->query("SELECT COUNT(*) FROM players WHERE is_online = 1")->fetchColumn();
    $total = $db->query("SELECT COUNT(*) FROM players")->fetchColumn();
    $conn24h = $db->query("SELECT COUNT(*) FROM player_connections WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)")->fetchColumn();
    $blocked24h = $db->query("SELECT COUNT(*) FROM player_connections WHERE blocked = 1 AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)")->fetchColumn();

    $recentConnections = $db->query("
        SELECT uuid, nick, ip, country, country_code, blocked, created_at
        FROM player_connections
        ORDER BY created_at DESC
        LIMIT 10
    ")->fetchAll(PDO::FETCH_ASSOC);

    $recentBlocks = $db->query("
        SELECT type, value, reason, created_at
        FROM blacklist
        ORDER BY created_at DESC
        LIMIT 10
    ")->fetchAll(PDO::FETCH_ASSOC);

    // Agregar nombres de Minecraft para bloques recientes de tipo UUID
    $blocksWithNames = [];
    foreach ($recentBlocks as $block) {
        if ($block['type'] === 'uuid') {
            $username = getMinecraftUsername($db, $block['value']);
            $block['minecraft_name'] = $username;
        }
        $blocksWithNames[] = $block;
    }

    return [
        'success' => true,
        'data' => [
            'online_players' => (int)$online,
            'total_players' => (int)$total,
            'connections_24h' => (int)$conn24h,
            'blocked_24h' => (int)$blocked24h,
            'recent_connections' => $recentConnections,
            'recent_blocks' => $blocksWithNames
        ]
    ];
}

function getPlayers($db, $input) {
    $page = max(1, (int)($input['page'] ?? 1));
    $perPage = 20;
    $offset = ($page - 1) * $perPage;
    $filter = $input['filter'] ?? 'all';
    $search = $input['search'] ?? '';

    $where = '1=1';
    $params = [];

    if ($filter === 'online') {
        $where .= ' AND is_online = 1';
    } elseif ($filter === 'whitelisted') {
        $where .= ' AND is_whitelisted = 1';
    } elseif ($filter === 'blacklisted') {
        $where .= ' AND is_blacklisted = 1';
    }

    if ($search) {
        $where .= ' AND (last_nick LIKE ? OR uuid LIKE ? OR last_ip LIKE ?)';
        $params[] = "%$search%";
        $params[] = "%$search%";
        $params[] = "%$search%";
    }

    $total = $db->prepare("SELECT COUNT(*) FROM players WHERE $where");
    $total->execute($params);
    $totalCount = $total->fetchColumn();

    $stmt = $db->prepare("
        SELECT * FROM players
        WHERE $where
        ORDER BY last_seen DESC
        LIMIT ? OFFSET ?
    ");
    $params[] = $perPage;
    $params[] = $offset;
    $stmt->execute($params);
    $players = $stmt->fetchAll(PDO::FETCH_ASSOC);

    return [
        'success' => true,
        'data' => [
            'players' => $players,
            'pagination' => [
                'current_page' => $page,
                'total_pages' => ceil($totalCount / $perPage),
                'total' => $totalCount
            ]
        ]
    ];
}

function getPlayerDetail($db, $uuid) {
    if (!$uuid) {
        return ['success' => false, 'error' => 'UUID requerido'];
    }

    $stmt = $db->prepare("SELECT * FROM players WHERE uuid = ?");
    $stmt->execute([$uuid]);
    $player = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$player) {
        return ['success' => false, 'error' => 'Jugador no encontrado'];
    }

   // Verificar blacklist directamente desde la tabla blacklist (fuente de verdad)
    // También verificar con el UUID de Mojang si el jugador es premium
    $uuidsToCheck = [$uuid];
    $nick = $player['last_nick'];

    // Intentar obtener el UUID de Mojang para jugadores premium
    $profile = lookupMinecraftProfile($nick);
    if ($profile['is_premium'] && $profile['uuid'] && $profile['uuid'] !== $uuid) {
        $uuidsToCheck[] = $profile['uuid'];
    }

    // Normalizar todos los UUIDs para comparación consistente
    $uuidsToCheck = array_map('normalizeUuid', $uuidsToCheck);
    // Remover duplicados y valores null
    $uuidsToCheck = array_filter(array_unique($uuidsToCheck), fn($v) => $v !== null);

    // Crear placeholders para los UUIDs
    $uuidPlaceholders = implode(',', array_fill(0, count($uuidsToCheck), '?'));

    $blacklistCheck = $db->prepare("
        SELECT id FROM blacklist
        WHERE active = 1
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (
            (type = 'uuid' AND value IN ($uuidPlaceholders))
            OR (type = 'nick' AND LOWER(value) = LOWER(?))
        )
        LIMIT 1
    ");
    $params = array_merge($uuidsToCheck, [$nick]);
    $blacklistCheck->execute($params);
    $isActuallyBlacklisted = (bool)$blacklistCheck->fetch();

    // Verificar whitelist directamente desde la tabla whitelist
    $whitelistCheck = $db->prepare("
        SELECT id FROM whitelist
        WHERE (
            (type = 'uuid' AND value = ?)
            OR (type = 'nick' AND LOWER(value) = LOWER(?))
        )
        LIMIT 1
    ");
    $whitelistCheck->execute([$uuid, $player['last_nick']]);
    $isActuallyWhitelisted = (bool)$whitelistCheck->fetch();

    // Sincronizar flags si hay discrepancia
    if ($isActuallyBlacklisted != (bool)$player['is_blacklisted']) {
        $db->prepare("UPDATE players SET is_blacklisted = ? WHERE id = ?")->execute([$isActuallyBlacklisted ? 1 : 0, $player['id']]);
        $player['is_blacklisted'] = $isActuallyBlacklisted ? 1 : 0;
    }
    if ($isActuallyWhitelisted != (bool)$player['is_whitelisted']) {
        $db->prepare("UPDATE players SET is_whitelisted = ? WHERE id = ?")->execute([$isActuallyWhitelisted ? 1 : 0, $player['id']]);
        $player['is_whitelisted'] = $isActuallyWhitelisted ? 1 : 0;
    }

    $nicks = $db->prepare("SELECT nick, first_used, last_used FROM player_nicks WHERE player_id = ? ORDER BY last_used DESC");
    $nicks->execute([$player['id']]);

    $ips = $db->prepare("SELECT ip, country, country_code, first_used, last_used FROM player_ips WHERE player_id = ? ORDER BY last_used DESC");
    $ips->execute([$player['id']]);

    return [
        'success' => true,
        'data' => [
            'player' => $player,
            'nicks' => $nicks->fetchAll(PDO::FETCH_ASSOC),
            'ips' => $ips->fetchAll(PDO::FETCH_ASSOC)
        ]
    ];
}

function getConnections($db, $input) {
    $page = max(1, (int)($input['page'] ?? 1));
    $perPage = 20;
    $offset = ($page - 1) * $perPage;
    $filter = $input['filter'] ?? 'all';
    $search = $input['search'] ?? '';

    $where = '1=1';
    $params = [];

    if ($filter === 'allowed') {
        $where .= ' AND blocked = 0';
    } elseif ($filter === 'blocked') {
        $where .= ' AND blocked = 1';
    } elseif ($filter === 'proxy') {
        $where .= ' AND is_proxy = 1';
    } elseif ($filter === 'vpn') {
        $where .= ' AND is_vpn = 1';
    } elseif ($filter === 'hosting') {
        $where .= ' AND is_hosting = 1';
    }

    if ($search) {
        $where .= ' AND (nick LIKE ? OR uuid LIKE ? OR ip LIKE ?)';
        $params[] = "%$search%";
        $params[] = "%$search%";
        $params[] = "%$search%";
    }

    $total = $db->prepare("SELECT COUNT(*) FROM player_connections WHERE $where");
    $total->execute($params);
    $totalCount = $total->fetchColumn();

    $stmt = $db->prepare("
        SELECT * FROM player_connections 
        WHERE $where
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    ");
    $params[] = $perPage;
    $params[] = $offset;
    $stmt->execute($params);
    $connections = $stmt->fetchAll(PDO::FETCH_ASSOC);

    return [
        'success' => true,
        'data' => [
            'connections' => $connections,
            'pagination' => [
                'current_page' => $page,
                'total_pages' => ceil($totalCount / $perPage),
                'total' => $totalCount
            ]
        ]
    ];
}

function getIPs($db, $input) {
    $page = max(1, (int)($input['page'] ?? 1));
    $perPage = 20;
    $offset = ($page - 1) * $perPage;
    $search = $input['search'] ?? '';

    $where = '1=1';
    $params = [];

    if ($search) {
        $where .= ' AND pi.ip LIKE ?';
        $params[] = "%$search%";
    }

    $total = $db->prepare("SELECT COUNT(DISTINCT pi.ip) FROM player_ips pi WHERE $where");
    $total->execute($params);
    $totalCount = $total->fetchColumn();

    // Optimized query using LEFT JOINs instead of subqueries
    $stmt = $db->prepare("
        SELECT
            pi.ip,
            pi.country,
            pi.country_code,
            pi.isp,
            pi.asn,
            MIN(pi.first_used) as first_seen,
            COUNT(DISTINCT pi.player_id) as player_count,
            COALESCE(pc.conn_count, 0) as connection_count,
            COALESCE(w.is_whitelisted, 0) as is_whitelisted,
            COALESCE(b.is_blacklisted, 0) as is_blacklisted
        FROM player_ips pi
        LEFT JOIN (
            SELECT ip, COUNT(*) as conn_count
            FROM player_connections
            GROUP BY ip
        ) pc ON pc.ip = pi.ip
        LEFT JOIN (
            SELECT value, 1 as is_whitelisted
            FROM whitelist
            WHERE type = 'ip'
        ) w ON w.value = pi.ip
        LEFT JOIN (
            SELECT value, 1 as is_blacklisted
            FROM blacklist
            WHERE type = 'ip' AND active = 1
        ) b ON b.value = pi.ip
        WHERE $where
        GROUP BY pi.ip, pi.country, pi.country_code, pi.isp, pi.asn, pc.conn_count, w.is_whitelisted, b.is_blacklisted
        ORDER BY first_seen DESC
        LIMIT ? OFFSET ?
    ");
    $params[] = $perPage;
    $params[] = $offset;
    $stmt->execute($params);
    $ips = $stmt->fetchAll(PDO::FETCH_ASSOC);

    return [
        'success' => true,
        'data' => [
            'ips' => $ips,
            'pagination' => [
                'current_page' => $page,
                'total_pages' => ceil($totalCount / $perPage),
                'total' => $totalCount
            ]
        ]
    ];
}

function getIPDetail($db, $ip) {
    if (!$ip) {
        return ['success' => false, 'error' => 'IP requerida'];
    }

    $stmt = $db->prepare("
        SELECT
            pi.ip,
            pi.country,
            pi.country_code,
            pi.isp,
            pi.asn,
            COALESCE(pc.conn_count, 0) as connection_count,
            COALESCE(w.is_whitelisted, 0) as is_whitelisted,
            COALESCE(b.is_blacklisted, 0) as is_blacklisted
        FROM player_ips pi
        LEFT JOIN (
            SELECT ip, COUNT(*) as conn_count
            FROM player_connections
            GROUP BY ip
        ) pc ON pc.ip = pi.ip
        LEFT JOIN (
            SELECT value, 1 as is_whitelisted
            FROM whitelist
            WHERE type = 'ip'
        ) w ON w.value = pi.ip
        LEFT JOIN (
            SELECT value, 1 as is_blacklisted
            FROM blacklist
            WHERE type = 'ip' AND active = 1
        ) b ON b.value = pi.ip
        WHERE pi.ip = ?
        LIMIT 1
    ");
    $stmt->execute([$ip]);
    $ipData = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$ipData) {
        return ['success' => false, 'error' => 'IP no encontrada'];
    }

    $players = $db->prepare("
        SELECT p.uuid, p.last_nick as nick, pi2.last_used
        FROM player_ips pi2
        JOIN players p ON p.id = pi2.player_id
        WHERE pi2.ip = ?
        ORDER BY pi2.last_used DESC
    ");
    $players->execute([$ip]);

    return [
        'success' => true,
        'data' => [
            'ip' => $ipData,
            'players' => $players->fetchAll(PDO::FETCH_ASSOC)
        ]
    ];
}

function getWhitelist($db, $input) {
    $filter = $input['filter'] ?? 'all';
    $search = $input['search'] ?? '';

    $where = '1=1';
    $params = [];

    if ($filter !== 'all') {
        $where .= ' AND type = ?';
        $params[] = $filter;
    }

    if ($search) {
        $where .= ' AND value LIKE ?';
        $params[] = "%$search%";
    }

    $stmt = $db->prepare("SELECT * FROM whitelist WHERE $where ORDER BY created_at DESC");
    $stmt->execute($params);
    $entries = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Agregar nombres de Minecraft para entradas de tipo UUID
    $entriesWithNames = [];
    $uuidsToFetch = [];

    foreach ($entries as $entry) {
        if ($entry['type'] === 'uuid') {
            $uuid = $entry['value'];
            $username = getMinecraftUsername($db, $uuid);
            $entry['minecraft_name'] = $username;
        }
        $entriesWithNames[] = $entry;
    }

    return [
        'success' => true,
        'data' => [
            'entries' => $entriesWithNames
        ]
    ];
}

function addWhitelist($db, $input) {
    $type = $input['type'] ?? '';
    $value = trim($input['value'] ?? '');
    $reason = $input['reason'] ?? '';

    if (!$type || !$value) {
        return ['success' => false, 'error' => 'Tipo y valor requeridos'];
    }

    $validTypes = ['uuid', 'nick', 'ip', 'ip_range', 'as'];
    if (!in_array($type, $validTypes)) {
        return ['success' => false, 'error' => 'Tipo no válido'];
    }

    $check = $db->prepare("SELECT id FROM whitelist WHERE type = ? AND value = ?");
    $check->execute([$type, $value]);
    if ($check->fetch()) {
        return ['success' => false, 'error' => 'Ya existe en whitelist'];
    }

    $username = $_SESSION['furrguard_admin']['username'] ?? 'Admin';

    $stmt = $db->prepare("INSERT INTO whitelist (type, value, reason, added_by) VALUES (?, ?, ?, ?)");
    $stmt->execute([$type, $value, $reason, $username]);

    if ($type === 'uuid') {
        $db->prepare("UPDATE players SET is_whitelisted = 1 WHERE uuid = ?")->execute([$value]);
    }

    logActivity($db, 'whitelist', 'add', "$type: $value");
    incrementCacheVersion($db);

    return ['success' => true];
}

function editWhitelist($db, $input) {
    $id = (int)($input['id'] ?? 0);
    $type = $input['type'] ?? '';
    $value = trim($input['value'] ?? '');
    $reason = $input['reason'] ?? '';

    if (!$id || !$type || !$value) {
        return ['success' => false, 'error' => 'Datos incompletos'];
    }

    $validTypes = ['uuid', 'nick', 'ip', 'ip_range', 'as'];
    if (!in_array($type, $validTypes)) {
        return ['success' => false, 'error' => 'Tipo no válido'];
    }

    $stmt = $db->prepare("UPDATE whitelist SET type = ?, value = ?, reason = ? WHERE id = ?");
    $stmt->execute([$type, $value, $reason, $id]);

    logActivity($db, 'whitelist', 'edit', "$type: $value");
    incrementCacheVersion($db);

    return ['success' => true];
}

function removeWhitelist($db, $id) {
    $stmt = $db->prepare("SELECT type, value FROM whitelist WHERE id = ?");
    $stmt->execute([$id]);
    $entry = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$entry) {
        return ['success' => false, 'error' => 'Entrada no encontrada'];
    }

    $db->prepare("DELETE FROM whitelist WHERE id = ?")->execute([$id]);

    if ($entry['type'] === 'uuid') {
        $db->prepare("UPDATE players SET is_whitelisted = 0 WHERE uuid = ?")->execute([$entry['value']]);
    }

    logActivity($db, 'whitelist', 'remove', "{$entry['type']}: {$entry['value']}");
    incrementCacheVersion($db);

    return ['success' => true];
}

function removeWhitelistByValue($db, $type, $value) {
    $stmt = $db->prepare("DELETE FROM whitelist WHERE type = ? AND value = ?");
    $stmt->execute([$type, $value]);

    if ($type === 'uuid') {
        $db->prepare("UPDATE players SET is_whitelisted = 0 WHERE uuid = ?")->execute([$value]);
    }

    logActivity($db, 'whitelist', 'remove', "$type: $value");
    incrementCacheVersion($db);

    return ['success' => true];
}

function getBlacklist($db, $input) {
    $filter = $input['filter'] ?? 'all';
    $search = $input['search'] ?? '';

    $where = 'parent_id IS NULL'; // Solo obtener entradas principales (no hijas)
    $params = [];

    if ($filter !== 'all') {
        $where .= ' AND type = ?';
        $params[] = $filter;
    }

    if ($search) {
        $where .= ' AND (value LIKE ? OR ban_id LIKE ? OR reason LIKE ?)';
        $params[] = "%$search%";
        $params[] = "%$search%";
        $params[] = "%$search%";
    }

    $stmt = $db->prepare("SELECT * FROM blacklist WHERE $where ORDER BY created_at DESC");
    $stmt->execute($params);
    $entries = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Agregar nombres de Minecraft y cargar entradas hijas (IPs manchadas)
    $entriesWithNames = [];
    foreach ($entries as $entry) {
        if ($entry['type'] === 'uuid') {
            $username = getMinecraftUsername($db, $entry['value']);
            $entry['minecraft_name'] = $username;
        }

        // Cargar IPs hijas (manchadas) para esta entrada
        $childStmt = $db->prepare("SELECT * FROM blacklist WHERE parent_id = ? ORDER BY created_at ASC");
        $childStmt->execute([$entry['id']]);
        $children = $childStmt->fetchAll(PDO::FETCH_ASSOC);

        // Formatear las hijas como un array de objetos con prefijo "IP:"
        $formattedChildren = [];
        foreach ($children as $child) {
            $formattedChildren[] = [
                'id' => $child['id'],
                'ban_id' => $child['ban_id'],
                'type' => $child['type'],
                'display_value' => 'IP: ' . $child['value'],
                'value' => $child['value'],
                'active' => (bool)$child['active'],
                'expires_at' => $child['expires_at']
            ];
        }

        $entry['children'] = $formattedChildren;
        $entry['child_count'] = count($formattedChildren);
        $entriesWithNames[] = $entry;
    }

    return [
        'success' => true,
        'data' => [
            'entries' => $entriesWithNames
        ]
    ];
}

function addBlacklist($db, $input) {
    $type = $input['type'] ?? '';
    $value = trim($input['value'] ?? '');
    $reason = $input['reason'] ?? '';
    $duration = isset($input['duration']) ? (int)$input['duration'] : 0;
    $stainIp = isset($input['stain_ip']) ? (int)$input['stain_ip'] : 1;

    if (!$type || !$value) {
        return ['success' => false, 'error' => 'Tipo y valor requeridos'];
    }

    $validTypes = ['uuid', 'nick', 'ip', 'ip_range', 'as'];
    if (!in_array($type, $validTypes)) {
        return ['success' => false, 'error' => 'Tipo no válido'];
    }

    $check = $db->prepare("SELECT id FROM blacklist WHERE type = ? AND value = ?");
    $check->execute([$type, $value]);
    if ($check->fetch()) {
        return ['success' => false, 'error' => 'Ya existe en blacklist'];
    }

    $expiresAt = null;
    if ($duration > 0) {
        $expiresAt = date('Y-m-d H:i:s', time() + ($duration * 60));
    }

    $username = $_SESSION['furrguard_admin']['username'] ?? 'Admin';
    $banId = generateBanId();

    // Retry with new ban_id in case of collision
    $maxRetries = 3;
    $parentId = null;
    for ($i = 0; $i < $maxRetries; $i++) {
        try {
            $stmt = $db->prepare("INSERT INTO blacklist (ban_id, type, value, reason, added_by, expires_at) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->execute([$banId, $type, $value, $reason, $username, $expiresAt]);
            $parentId = (int)$db->lastInsertId();
            break;
        } catch (PDOException $e) {
            if ($i < $maxRetries - 1 && strpos($e->getMessage(), 'uk_ban_id') !== false) {
                $banId = generateBanId();
            } else {
                throw $e;
            }
        }
    }

    // Actualizar flag en players (case-insensitive para nick)
    if ($type === 'uuid') {
        $db->prepare("UPDATE players SET is_blacklisted = 1 WHERE uuid = ?")->execute([$value]);
    } elseif ($type === 'nick') {
        // Buscar case-insensitive por si hay diferencias de capitalización
        $db->prepare("UPDATE players SET is_blacklisted = 1 WHERE LOWER(last_nick) = LOWER(?)")->execute([$value]);
        // También actualizar por first_nick por si acaso
        $db->prepare("UPDATE players SET is_blacklisted = 1 WHERE LOWER(first_nick) = LOWER(?) AND is_blacklisted = 0")->execute([$value]);
    }

    // IP Manchada: Si el tipo es uuid o nick, también añadir las IPs a la blacklist automáticamente con parent_id
    if ($stainIp && in_array($type, ['uuid', 'nick']) && $parentId) {
        $ipsToAdd = [];

        if ($type === 'uuid') {
            // Buscar jugador por UUID y obtener sus IPs
            $stmt = $db->prepare("SELECT id FROM players WHERE uuid = ? LIMIT 1");
            $stmt->execute([$value]);
            $player = $stmt->fetch();

            if ($player) {
                $stmt = $db->prepare("SELECT DISTINCT ip FROM player_ips WHERE player_id = ?");
                $stmt->execute([$player['id']]);
                $ipsToAdd = $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
            }
        } elseif ($type === 'nick') {
            // Buscar IPs asociadas a este nick en player_connections
            $stmt = $db->prepare("SELECT DISTINCT ip FROM player_connections WHERE nick = ?");
            $stmt->execute([$value]);
            $ipsToAdd = $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];

            // También buscar en player_nicks si no encontramos
            if (empty($ipsToAdd)) {
                $stmt = $db->prepare("
                    SELECT DISTINCT pi.ip
                    FROM player_ips pi
                    JOIN player_nicks pn ON pn.player_id = pi.player_id
                    WHERE LOWER(pn.nick) = LOWER(?)
                ");
                $stmt->execute([$value]);
                $ipsToAdd = $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
            }
        }

        // Añadir cada IP a la blacklist con parent_id si no existe ya
        foreach ($ipsToAdd as $ip) {
            $checkIp = $db->prepare("SELECT id FROM blacklist WHERE type = 'ip' AND value = ?");
            $checkIp->execute([$ip]);
            if (!$checkIp->fetch()) {
                $ipBanId = generateBanId();
                $stmt = $db->prepare("INSERT INTO blacklist (ban_id, type, value, reason, added_by, expires_at, parent_id) VALUES (?, 'ip', ?, ?, ?, ?, ?)");
                $stmt->execute([
                    $ipBanId,
                    $ip,
                    $reason,
                    $username,
                    $expiresAt,
                    $parentId
                ]);
            }
        }
    }

    logActivity($db, 'blacklist', 'add', "$type: $value");
    incrementCacheVersion($db);

    return ['success' => true, 'data' => ['ban_id' => $banId]];
}

function editBlacklist($db, $input) {
    $id = (int)($input['id'] ?? 0);
    $type = $input['type'] ?? '';
    $value = trim($input['value'] ?? '');
    $reason = $input['reason'] ?? '';
    $duration = isset($input['duration']) ? (int)$input['duration'] : -1;

    if (!$id || !$type || !$value) {
        return ['success' => false, 'error' => 'Datos incompletos'];
    }

    $validTypes = ['uuid', 'nick', 'ip', 'ip_range', 'as'];
    if (!in_array($type, $validTypes)) {
        return ['success' => false, 'error' => 'Tipo no válido'];
    }

    $expiresAt = null;
    if ($duration > 0) {
        $expiresAt = date('Y-m-d H:i:s', time() + ($duration * 60));
    }
    // duration == 0 means permanent (null), duration == -1 means don't change

    if ($duration >= 0) {
        $stmt = $db->prepare("UPDATE blacklist SET type = ?, value = ?, reason = ?, expires_at = ? WHERE id = ?");
        $stmt->execute([$type, $value, $reason, $expiresAt, $id]);
    } else {
        $stmt = $db->prepare("UPDATE blacklist SET type = ?, value = ?, reason = ? WHERE id = ?");
        $stmt->execute([$type, $value, $reason, $id]);
    }

    logActivity($db, 'blacklist', 'edit', "$type: $value");
    incrementCacheVersion($db);

    return ['success' => true];
}

function removeBlacklist($db, $id) {
    $stmt = $db->prepare("SELECT type, value, parent_id FROM blacklist WHERE id = ?");
    $stmt->execute([$id]);
    $entry = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$entry) {
        return ['success' => false, 'error' => 'Entrada no encontrada'];
    }

    // Si es una entrada principal (sin parent_id), eliminar todas las hijas (IPs vinculadas) primero
    if (!$entry['parent_id']) {
        // Contar IPs hijas para el log
        $countStmt = $db->prepare("SELECT COUNT(*) FROM blacklist WHERE parent_id = ?");
        $countStmt->execute([$id]);
        $childCount = (int)$countStmt->fetchColumn();

        // Eliminar todas las IPs hijas vinculadas
        $db->prepare("DELETE FROM blacklist WHERE parent_id = ?")->execute([$id]);

        if ($childCount > 0) {
            logActivity($db, 'blacklist', 'remove_children', "Eliminadas $childCount IPs vinculadas de {$entry['type']}: {$entry['value']}");
        }
    }

    // Eliminar la entrada principal
    $db->prepare("DELETE FROM blacklist WHERE id = ?")->execute([$id]);

    // Si es una entrada hija (IP manchada), verificar si el padre debe actualizar su flag
    if ($entry['parent_id']) {
        // Verificar si quedan más hijas
        $checkSiblings = $db->prepare("SELECT COUNT(*) FROM blacklist WHERE parent_id = ?");
        $checkSiblings->execute([$entry['parent_id']]);
        if (!$checkSiblings->fetchColumn()) {
            // No quedan más hijas, obtener info del padre y actualizar flag
            $checkParent = $db->prepare("SELECT type, value FROM blacklist WHERE id = ?");
            $checkParent->execute([$entry['parent_id']]);
            $parent = $checkParent->fetch();
            if ($parent) {
                if ($parent['type'] === 'uuid') {
                    $db->prepare("UPDATE players SET is_blacklisted = 0 WHERE uuid = ?")->execute([$parent['value']]);
                } elseif ($parent['type'] === 'nick') {
                    $db->prepare("UPDATE players SET is_blacklisted = 0 WHERE LOWER(last_nick) = LOWER(?)")->execute([$parent['value']]);
                }
            }
        }
    } else {
        // Es una entrada principal, actualizar flag del jugador
        if ($entry['type'] === 'uuid') {
            $db->prepare("UPDATE players SET is_blacklisted = 0 WHERE uuid = ?")->execute([$entry['value']]);
        } elseif ($entry['type'] === 'nick') {
            $db->prepare("UPDATE players SET is_blacklisted = 0 WHERE LOWER(last_nick) = LOWER(?)")->execute([$entry['value']]);
        }
    }

    logActivity($db, 'blacklist', 'remove', "{$entry['type']}: {$entry['value']}");
    incrementCacheVersion($db);

    return ['success' => true];
}

function removeBlacklistByValue($db, $type, $value) {
    // Primero obtener la entrada para encontrar su ID y poder eliminar hijas
    $stmt = $db->prepare("SELECT id FROM blacklist WHERE type = ? AND value = ?");
    $stmt->execute([$type, $value]);
    $entry = $stmt->fetch(PDO::FETCH_ASSOC);

    $deletedChildren = 0;

    if ($entry) {
        // Eliminar todas las entradas hijas (IPs vinculadas) primero
        $deleteChildren = $db->prepare("DELETE FROM blacklist WHERE parent_id = ?");
        $deleteChildren->execute([$entry['id']]);
        $deletedChildren = $deleteChildren->rowCount();

        // Eliminar la entrada principal
        $db->prepare("DELETE FROM blacklist WHERE id = ?")->execute([$entry['id']]);
    }

    // Actualizar flag case-insensitive
    if ($type === 'uuid') {
        $db->prepare("UPDATE players SET is_blacklisted = 0 WHERE uuid = ?")->execute([$value]);
    } elseif ($type === 'nick') {
        $db->prepare("UPDATE players SET is_blacklisted = 0 WHERE LOWER(last_nick) = LOWER(?)")->execute([$value]);
        $db->prepare("UPDATE players SET is_blacklisted = 0 WHERE LOWER(first_nick) = LOWER(?) AND is_blacklisted = 1")->execute([$value]);
    }

    $logMsg = "$type: $value";
    if ($deletedChildren > 0) {
        $logMsg .= " (+$deletedChildren IPs vinculadas)";
    }
    logActivity($db, 'blacklist', 'remove', $logMsg);
    incrementCacheVersion($db);

    return ['success' => true, 'deleted_ips' => $deletedChildren];
}

function toggleBlacklist($db, $id, $active) {
    // Obtener info de la entrada antes de actualizar
    $stmt = $db->prepare("SELECT type, value FROM blacklist WHERE id = ?");
    $stmt->execute([$id]);
    $entry = $stmt->fetch(PDO::FETCH_ASSOC);

    $stmt = $db->prepare("UPDATE blacklist SET active = ? WHERE id = ?");
    $stmt->execute([$active ? 1 : 0, $id]);

    // Actualizar flag en players si es uuid o nick
    if ($entry) {
        if ($entry['type'] === 'uuid') {
            $db->prepare("UPDATE players SET is_blacklisted = ? WHERE uuid = ?")->execute([$active ? 1 : 0, $entry['value']]);
        } elseif ($entry['type'] === 'nick') {
            $db->prepare("UPDATE players SET is_blacklisted = ? WHERE LOWER(last_nick) = LOWER(?)")->execute([$active ? 1 : 0, $entry['value']]);
            $db->prepare("UPDATE players SET is_blacklisted = ? WHERE LOWER(first_nick) = LOWER(?) AND is_blacklisted = ?")->execute([$active ? 1 : 0, $entry['value'], $active ? 0 : 1]);
        }
    }

    logActivity($db, 'blacklist', $active ? 'enable' : 'disable', "ID: $id");
    incrementCacheVersion($db);

    return ['success' => true];
}

function getProviders($db, $input) {
    $page = max(1, (int)($input['page'] ?? 1));
    $perPage = 50;
    $offset = ($page - 1) * $perPage;
    $filter = $input['filter'] ?? 'all';
    $search = $input['search'] ?? '';

    $where = '1=1';
    $params = [];

    if ($filter !== 'all') {
        $where .= ' AND type = ?';
        $params[] = $filter;
    }

    if ($search) {
        $where .= ' AND (name LIKE ? OR pattern LIKE ?)';
        $params[] = "%$search%";
        $params[] = "%$search%";
    }

    $stats = [
        'hosting' => $db->query("SELECT COUNT(*) FROM blocked_providers WHERE type = 'hosting'")->fetchColumn(),
        'vpn' => $db->query("SELECT COUNT(*) FROM blocked_providers WHERE type = 'vpn'")->fetchColumn(),
        'proxy' => $db->query("SELECT COUNT(*) FROM blocked_providers WHERE type = 'proxy'")->fetchColumn()
    ];

    $total = $db->prepare("SELECT COUNT(*) FROM blocked_providers WHERE $where");
    $total->execute($params);
    $totalCount = $total->fetchColumn();

    $stmt = $db->prepare("
        SELECT * FROM blocked_providers
        WHERE $where
        ORDER BY block_count DESC, name ASC
        LIMIT ? OFFSET ?
    ");
    $stmt->execute($params);

    return [
        'success' => true,
        'data' => [
            'providers' => $stmt->fetchAll(PDO::FETCH_ASSOC),
            'stats' => $stats,
            'pagination' => [
                'current_page' => $page,
                'total_pages' => ceil($totalCount / $perPage),
                'total' => $totalCount
            ]
        ]
    ];
}

function addProvider($db, $input) {
    $name = trim($input['name'] ?? '');
    $pattern = trim(strtolower($input['pattern'] ?? ''));
    $type = $input['type'] ?? 'hosting';

    if (!$name || !$pattern) {
        return ['success' => false, 'error' => 'Nombre y patrón requeridos'];
    }

    $validTypes = ['hosting', 'vpn', 'proxy'];
    if (!in_array($type, $validTypes)) {
        return ['success' => false, 'error' => 'Tipo no válido'];
    }

    $check = $db->prepare("SELECT id FROM blocked_providers WHERE pattern = ? AND type = ?");
    $check->execute([$pattern, $type]);
    if ($check->fetch()) {
        return ['success' => false, 'error' => 'El patrón ya existe'];
    }

    $username = $_SESSION['furrguard_admin']['username'] ?? 'Admin';

    $stmt = $db->prepare("INSERT INTO blocked_providers (name, pattern, type, added_by) VALUES (?, ?, ?, ?)");
    $stmt->execute([$name, $pattern, $type, $username]);

    logActivity($db, 'providers', 'Proveedor añadido', "$name ($type)");

    return ['success' => true];
}

function toggleProvider($db, $id, $active) {
    $stmt = $db->prepare("UPDATE blocked_providers SET active = ? WHERE id = ?");
    $stmt->execute([$active ? 1 : 0, $id]);

    return ['success' => true];
}

function getCountries($db, $input) {
    $page = max(1, (int)($input['page'] ?? 1));
    $perPage = 50;
    $offset = ($page - 1) * $perPage;
    $search = $input['search'] ?? '';

    $where = '1=1';
    $params = [];

    if ($search) {
        $where .= ' AND (country_name LIKE ? OR country_code LIKE ?)';
        $params[] = "%$search%";
        $params[] = "%$search%";
    }

    $total = $db->prepare("SELECT COUNT(*) FROM blocked_countries WHERE $where");
    $total->execute($params);
    $totalCount = $total->fetchColumn();

    $stmt = $db->prepare("
        SELECT * FROM blocked_countries
        WHERE $where
        ORDER BY block_count DESC, country_name ASC
        LIMIT ? OFFSET ?
    ");
    $params[] = $perPage;
    $params[] = $offset;
    $stmt->execute($params);

    $stats = [
        'total' => $db->query("SELECT COUNT(*) FROM blocked_countries")->fetchColumn(),
        'active' => $db->query("SELECT COUNT(*) FROM blocked_countries WHERE active = 1")->fetchColumn(),
        'total_blocks' => $db->query("SELECT COALESCE(SUM(block_count), 0) FROM blocked_countries")->fetchColumn()
    ];

    return [
        'success' => true,
        'data' => [
            'countries' => $stmt->fetchAll(PDO::FETCH_ASSOC),
            'stats' => $stats,
            'pagination' => [
                'current_page' => $page,
                'total_pages' => ceil($totalCount / $perPage),
                'total' => $totalCount
            ]
        ]
    ];
}

function addCountry($db, $input) {
    $code = strtoupper(trim($input['country_code'] ?? ''));
    $name = trim($input['country_name'] ?? '');
    $kickMessage = trim($input['kick_message'] ?? '');

    if (!$code || !$name) {
        return ['success' => false, 'error' => 'Código y nombre de país requeridos'];
    }

    if (!preg_match('/^[A-Z]{2}$/', $code)) {
        return ['success' => false, 'error' => 'Código de país inválido'];
    }

    $check = $db->prepare("SELECT id FROM blocked_countries WHERE country_code = ?");
    $check->execute([$code]);
    if ($check->fetch()) {
        return ['success' => false, 'error' => 'Este país ya está bloqueado'];
    }

    $username = $_SESSION['furrguard_admin']['username'] ?? 'Admin';

    $stmt = $db->prepare("INSERT INTO blocked_countries (country_code, country_name, kick_message, added_by) VALUES (?, ?, ?, ?)");
    $stmt->execute([$code, $name, $kickMessage ?: null, $username]);

    logActivity($db, 'countries', 'País bloqueado', "$name ($code)");
    incrementCacheVersion($db);

    return ['success' => true];
}

function editCountry($db, $input) {
    $id = (int)($input['id'] ?? 0);
    $name = trim($input['country_name'] ?? '');
    $kickMessage = trim($input['kick_message'] ?? '');

    if (!$id) {
        return ['success' => false, 'error' => 'ID requerido'];
    }

    $stmt = $db->prepare("UPDATE blocked_countries SET country_name = ?, kick_message = ? WHERE id = ?");
    $stmt->execute([$name, $kickMessage ?: null, $id]);

    logActivity($db, 'countries', 'País editado', "$name (ID: $id)");
    incrementCacheVersion($db);

    return ['success' => true];
}

function toggleCountry($db, $id, $active) {
    $stmt = $db->prepare("UPDATE blocked_countries SET active = ? WHERE id = ?");
    $stmt->execute([$active ? 1 : 0, $id]);

    incrementCacheVersion($db);

    return ['success' => true];
}

function deleteCountry($db, $id) {
    if (!$id) {
        return ['success' => false, 'error' => 'ID requerido'];
    }

    $stmt = $db->prepare("SELECT country_name, country_code FROM blocked_countries WHERE id = ?");
    $stmt->execute([$id]);
    $country = $stmt->fetch(PDO::FETCH_ASSOC);

    $db->prepare("DELETE FROM blocked_countries WHERE id = ?")->execute([$id]);

    if ($country) {
        logActivity($db, 'countries', 'País desbloqueado', "{$country['country_name']} ({$country['country_code']})");
    }

    incrementCacheVersion($db);

    return ['success' => true];
}

function getContinents($db, $input) {
    $search = $input['search'] ?? '';

    $where = '1=1';
    $params = [];

    if ($search) {
        $where .= ' AND (continent_name LIKE ? OR continent_code LIKE ?)';
        $params[] = "%$search%";
        $params[] = "%$search%";
    }

    $stmt = $db->prepare("SELECT * FROM blocked_continents WHERE $where ORDER BY continent_name ASC");
    $stmt->execute($params);

    $stats = [
        'total' => $db->query("SELECT COUNT(*) FROM blocked_continents")->fetchColumn(),
        'active' => $db->query("SELECT COUNT(*) FROM blocked_continents WHERE active = 1")->fetchColumn(),
        'total_blocks' => $db->query("SELECT COALESCE(SUM(block_count), 0) FROM blocked_continents")->fetchColumn()
    ];

    return [
        'success' => true,
        'data' => [
            'continents' => $stmt->fetchAll(PDO::FETCH_ASSOC),
            'stats' => $stats
        ]
    ];
}

function addContinent($db, $input) {
    $code = strtoupper(trim($input['continent_code'] ?? ''));
    $name = trim($input['continent_name'] ?? '');
    $kickMessage = trim($input['kick_message'] ?? '');

    if (!$code || !$name) {
        return ['success' => false, 'error' => 'Código y nombre de continente requeridos'];
    }

    if (!preg_match('/^[A-Z]{2}$/', $code)) {
        return ['success' => false, 'error' => 'Código de continente inválido'];
    }

    $check = $db->prepare("SELECT id FROM blocked_continents WHERE continent_code = ?");
    $check->execute([$code]);
    if ($check->fetch()) {
        return ['success' => false, 'error' => 'Este continente ya está bloqueado'];
    }

    $username = $_SESSION['furrguard_admin']['username'] ?? 'Admin';

    $stmt = $db->prepare("INSERT INTO blocked_continents (continent_code, continent_name, kick_message, added_by) VALUES (?, ?, ?, ?)");
    $stmt->execute([$code, $name, $kickMessage ?: null, $username]);

    logActivity($db, 'continents', 'Continente bloqueado', "$name ($code)");
    incrementCacheVersion($db);

    return ['success' => true];
}

function editContinent($db, $input) {
    $id = (int)($input['id'] ?? 0);
    $name = trim($input['continent_name'] ?? '');
    $kickMessage = trim($input['kick_message'] ?? '');

    if (!$id) {
        return ['success' => false, 'error' => 'ID requerido'];
    }

    $stmt = $db->prepare("UPDATE blocked_continents SET continent_name = ?, kick_message = ? WHERE id = ?");
    $stmt->execute([$name, $kickMessage ?: null, $id]);

    logActivity($db, 'continents', 'Continente editado', "$name (ID: $id)");
    incrementCacheVersion($db);

    return ['success' => true];
}

function toggleContinent($db, $id, $active) {
    $stmt = $db->prepare("UPDATE blocked_continents SET active = ? WHERE id = ?");
    $stmt->execute([$active ? 1 : 0, $id]);

    incrementCacheVersion($db);

    return ['success' => true];
}

function deleteContinent($db, $id) {
    if (!$id) {
        return ['success' => false, 'error' => 'ID requerido'];
    }

    $stmt = $db->prepare("SELECT continent_name, continent_code FROM blocked_continents WHERE id = ?");
    $stmt->execute([$id]);
    $continent = $stmt->fetch(PDO::FETCH_ASSOC);

    $db->prepare("DELETE FROM blocked_continents WHERE id = ?")->execute([$id]);

    if ($continent) {
        logActivity($db, 'continents', 'Continente desbloqueado', "{$continent['continent_name']} ({$continent['continent_code']})");
    }

    incrementCacheVersion($db);

    return ['success' => true];
}

function getMessages($db) {
    $stmt = $db->query("SELECT `key`, value FROM messages ORDER BY `key`");
    $messages = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $messages[$row['key']] = $row['value'];
    }

    return [
        'success' => true,
        'data' => ['messages' => $messages]
    ];
}

function saveMessages($db, $messages) {
    if (empty($messages)) {
        return ['success' => true];
    }

    // Build CASE WHEN for batch update (much faster than loop of individual updates)
    $keys = array_keys($messages);
    $placeholders = str_repeat('?,', count($messages) - 1) . '?';

    $sql = "UPDATE messages SET value = CASE `key` ";
    foreach ($keys as $key) {
        $sql .= "WHEN ? THEN ? ";
    }
    $sql .= "ELSE value END WHERE `key` IN ($placeholders)";

    $params = [];
    foreach ($keys as $key) {
        $params[] = $key;
        $params[] = $messages[$key];
    }
    $params = array_merge($params, $keys);

    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    // logActivity($db, 'settings', 'Mensajes actualizados'); // Eliminado - no se loguean cambios de configuración
    incrementCacheVersion($db);

    return ['success' => true];
}

function getLogs($db, $filter) {
    $where = '1=1';
    $params = [];

    if ($filter !== 'all') {
        $where .= ' AND type = ?';
        $params[] = $filter;
    }

    $stmt = $db->prepare("
        SELECT * FROM activity_logs 
        WHERE $where 
        ORDER BY created_at DESC 
        LIMIT 100
    ");
    $stmt->execute($params);

    return [
        'success' => true,
        'data' => ['logs' => $stmt->fetchAll(PDO::FETCH_ASSOC)]
    ];
}

function getSettings($db) {
    $stmt = $db->query("SELECT `key`, value FROM settings");
    $settings = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $settings[$row['key']] = $row['value'];
    }

    return [
        'success' => true,
        'data' => ['settings' => $settings]
    ];
}

function saveSettings($db, $settings) {
    $allowedKeys = ['block_proxy', 'block_vpn', 'block_hosting', 'webhook_url', 'notify_connections', 'notify_hispanic', 'notify_blocks', 'server_name', 'discord_url', 'country_change_detection_enabled', 'country_change_min_connections', 'country_change_min_percentage', 'country_change_continent_only'];

    // Filter allowed keys
    $filtered = array_intersect_key($settings, array_flip($allowedKeys));

    if (empty($filtered)) {
        return ['success' => true];
    }

    // Batch insert with ON DUPLICATE KEY UPDATE (faster than individual queries)
    $sql = "INSERT INTO settings (`key`, value) VALUES ";
    $params = [];
    $placeholders = [];

    foreach ($filtered as $key => $value) {
        $placeholders[] = "(?, ?)";
        $params[] = $key;
        $params[] = $value;
    }

    $sql .= implode(', ', $placeholders);
    $sql .= " ON DUPLICATE KEY UPDATE value = VALUES(value)";

    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    // logActivity($db, 'settings', 'Configuración actualizada'); // Eliminado - no se loguean cambios de configuración
    incrementCacheVersion($db);

    return ['success' => true];
}

function regenerateApiKey($db) {
    $newKey = 'fg_' . bin2hex(random_bytes(24));

    $stmt = $db->prepare("UPDATE settings SET value = ? WHERE `key` = 'api_key'");
    $stmt->execute([$newKey]);

    logActivity($db, 'settings', 'API Key regenerada');

    return [
        'success' => true,
        'data' => ['api_key' => $newKey]
    ];
}

function getSanctions($db, $input) {
    $page = max(1, (int)($input['page'] ?? 1));
    $perPage = 20;
    $offset = ($page - 1) * $perPage;
    $filter = $input['filter'] ?? 'all';
    $search = $input['search'] ?? '';

    $where = '1=1';
    $params = [];

    if ($filter === 'active') {
        $where .= ' AND active = 1 AND (expires_at IS NULL OR expires_at > NOW())';
    } elseif ($filter === 'expired') {
        $where .= ' AND expires_at IS NOT NULL AND expires_at <= NOW()';
    } elseif ($filter === 'inactive') {
        $where .= ' AND active = 0';
    } elseif ($filter === 'permanent') {
        $where .= ' AND expires_at IS NULL AND active = 1';
    } elseif ($filter === 'temporary') {
        $where .= ' AND expires_at IS NOT NULL AND active = 1';
    }

    if ($search) {
        $where .= ' AND (ban_id LIKE ? OR value LIKE ? OR reason LIKE ? OR added_by LIKE ?)';
        $params[] = "%$search%";
        $params[] = "%$search%";
        $params[] = "%$search%";
        $params[] = "%$search%";
    }

    $total = $db->prepare("SELECT COUNT(*) FROM blacklist WHERE $where");
    $total->execute($params);
    $totalCount = $total->fetchColumn();

    // Optimized: Single query for all stats using conditional COUNT
    $statsRow = $db->query("
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN active = 1 AND (expires_at IS NULL OR expires_at > NOW()) THEN 1 ELSE 0 END) as active,
            SUM(CASE WHEN expires_at IS NOT NULL AND expires_at <= NOW() THEN 1 ELSE 0 END) as expired,
            SUM(CASE WHEN active = 0 THEN 1 ELSE 0 END) as inactive,
            SUM(CASE WHEN expires_at IS NULL AND active = 1 THEN 1 ELSE 0 END) as permanent,
            SUM(CASE WHEN expires_at IS NOT NULL AND active = 1 AND expires_at > NOW() THEN 1 ELSE 0 END) as temporary
        FROM blacklist
    ")->fetch(PDO::FETCH_ASSOC);

    $stats = [
        'total' => (int)$statsRow['total'],
        'active' => (int)$statsRow['active'],
        'expired' => (int)$statsRow['expired'],
        'inactive' => (int)$statsRow['inactive'],
        'permanent' => (int)$statsRow['permanent'],
        'temporary' => (int)$statsRow['temporary'],
    ];

    $stmt = $db->prepare("
        SELECT * FROM blacklist
        WHERE $where
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    ");
    $params[] = $perPage;
    $params[] = $offset;
    $stmt->execute($params);
    $sanctions = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Agregar nombres de Minecraft para entradas de tipo UUID
    $sanctionsWithNames = [];
    foreach ($sanctions as $sanction) {
        if ($sanction['type'] === 'uuid') {
            $username = getMinecraftUsername($db, $sanction['value']);
            $sanction['minecraft_name'] = $username;
        }
        $sanctionsWithNames[] = $sanction;
    }

    return [
        'success' => true,
        'data' => [
            'sanctions' => $sanctionsWithNames,
            'stats' => $stats,
            'pagination' => [
                'current_page' => $page,
                'total_pages' => ceil($totalCount / $perPage),
                'total' => $totalCount
            ]
        ]
    ];
}

function getCounts($db) {
    return [
        'success' => true,
        'data' => [
            'players' => $db->query("SELECT COUNT(*) FROM players WHERE is_online = 1")->fetchColumn(),
            'whitelist' => $db->query("SELECT COUNT(*) FROM whitelist")->fetchColumn(),
            'blacklist' => $db->query("SELECT COUNT(*) FROM blacklist WHERE active = 1")->fetchColumn(),
            'providers' => $db->query("SELECT COUNT(*) FROM blocked_providers WHERE active = 1")->fetchColumn(),
            'countries' => $db->query("SELECT COUNT(*) FROM blocked_countries WHERE active = 1")->fetchColumn(),
            'continents' => $db->query("SELECT COUNT(*) FROM blocked_continents WHERE active = 1")->fetchColumn()
        ]
    ];
}

function getConnectionDetail($db, $id) {
    if (!$id) {
        return ['success' => false, 'error' => 'ID requerido'];
    }

    $stmt = $db->prepare("SELECT * FROM player_connections WHERE id = ?");
    $stmt->execute([$id]);
    $connection = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$connection) {
        return ['success' => false, 'error' => 'Conexión no encontrada'];
    }

    return [
        'success' => true,
        'data' => ['connection' => $connection]
    ];
}

function exportData($db) {
    $data = [
        'exported_at' => date('Y-m-d H:i:s'),
        'whitelist' => $db->query("SELECT type, value, reason, created_at FROM whitelist")->fetchAll(PDO::FETCH_ASSOC),
        'blacklist' => $db->query("SELECT type, value, reason, active, created_at FROM blacklist")->fetchAll(PDO::FETCH_ASSOC),
        'settings' => [],
        'messages' => []
    ];

    $stmt = $db->query("SELECT `key`, value FROM settings");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $data['settings'][$row['key']] = $row['value'];
    }

    $stmt = $db->query("SELECT `key`, value FROM messages");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $data['messages'][$row['key']] = $row['value'];
    }

    return ['success' => true, 'data' => $data];
}

function getAdminUsers($db) {
    $stmt = $db->query("SELECT id, discord_id, role, created_by, created_at FROM admin_users ORDER BY FIELD(role, 'founder','owner','manager','sradmin','admin'), created_at ASC");
    return [
        'success' => true,
        'data' => ['users' => $stmt->fetchAll(PDO::FETCH_ASSOC)]
    ];
}

function addAdminUser($db, $input) {
    $discordId = trim($input['discord_id'] ?? '');
    $role = $input['role'] ?? '';

    if (!$discordId || !$role) {
        return ['success' => false, 'error' => 'Discord ID y rol requeridos'];
    }

    $validRoles = ['owner', 'manager', 'sradmin', 'admin'];
    if (!in_array($role, $validRoles)) {
        return ['success' => false, 'error' => 'Rol no válido'];
    }

    if (!preg_match('/^\d{17,20}$/', $discordId)) {
        return ['success' => false, 'error' => 'Discord ID no válido'];
    }

    if ($discordId === FOUNDER_DISCORD_ID) {
        return ['success' => false, 'error' => 'No se puede modificar al Founder'];
    }

    $check = $db->prepare("SELECT id FROM admin_users WHERE discord_id = ?");
    $check->execute([$discordId]);
    if ($check->fetch()) {
        return ['success' => false, 'error' => 'Este usuario ya existe'];
    }

    $createdBy = $_SESSION['furrguard_admin']['discord_id'] ?? '';
    $stmt = $db->prepare("INSERT INTO admin_users (discord_id, role, created_by) VALUES (?, ?, ?)");
    $stmt->execute([$discordId, $role, $createdBy]);

    logActivity($db, 'settings', 'Usuario admin añadido', "Discord ID: $discordId, Rol: $role");

    return ['success' => true];
}

function removeAdminUser($db, $id) {
    $stmt = $db->prepare("SELECT discord_id, role FROM admin_users WHERE id = ?");
    $stmt->execute([$id]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        return ['success' => false, 'error' => 'Usuario no encontrado'];
    }

    if ($user['discord_id'] === FOUNDER_DISCORD_ID || $user['role'] === 'founder') {
        return ['success' => false, 'error' => 'No se puede eliminar al Founder'];
    }

    $db->prepare("DELETE FROM admin_users WHERE id = ?")->execute([$id]);

    logActivity($db, 'settings', 'Usuario admin eliminado', "Discord ID: {$user['discord_id']}");

    return ['success' => true];
}

function addBlacklistIP($db, $input) {
    $parentId = (int)($input['parent_id'] ?? 0);
    $ip = trim($input['ip'] ?? '');

    if (!$parentId || !$ip) {
        return ['success' => false, 'error' => 'ID padre e IP requeridos'];
    }

    // Validar formato de IP
    if (!filter_var($ip, FILTER_VALIDATE_IP)) {
        return ['success' => false, 'error' => 'Formato de IP inválido'];
    }

    // Verificar que la entrada padre existe
    $stmt = $db->prepare("SELECT id, type, value, expires_at FROM blacklist WHERE id = ?");
    $stmt->execute([$parentId]);
    $parent = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$parent) {
        return ['success' => false, 'error' => 'Entrada padre no encontrada'];
    }

    // Verificar que la IP no existe ya en blacklist
    $check = $db->prepare("SELECT id FROM blacklist WHERE type = 'ip' AND value = ?");
    $check->execute([$ip]);
    if ($check->fetch()) {
        return ['success' => false, 'error' => 'La IP ya está en blacklist'];
    }

    $username = $_SESSION['furrguard_admin']['username'] ?? 'Admin';
    $ipBanId = generateBanId();

    // Insertar la IP como hija
    $stmt = $db->prepare("INSERT INTO blacklist (ban_id, type, value, reason, added_by, expires_at, parent_id) VALUES (?, 'ip', ?, ?, ?, ?, ?)");
    $stmt->execute([
        $ipBanId,
        $ip,
        $parent['value'], // Usar el valor del padre como razón (IP heredada)
        $username,
        $parent['expires_at'],
        $parentId
    ]);

    logActivity($db, 'blacklist', 'add_ip', "IP: $ip (hija de {$parent['type']}: {$parent['value']})");
    incrementCacheVersion($db);

    return ['success' => true];
}

// ============================================
// FURR PERMS MODULE
// ============================================

function getFurrPermsWhitelist($db, $input) {
    $search = $input['search'] ?? '';

    $where = '1=1';
    $params = [];

    if ($search) {
        $where .= ' AND nick LIKE ?';
        $params[] = "%$search%";
    }

    $stmt = $db->prepare("SELECT * FROM fur_perms_whitelist WHERE $where ORDER BY created_at DESC");
    $stmt->execute($params);
    $entries = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Obtener total de whitelist (sin filtro de búsqueda)
    $totalWhitelist = $db->query("SELECT COUNT(*) FROM fur_perms_whitelist")->fetchColumn();

    return [
        'success' => true,
        'data' => [
            'entries' => $entries,
            'total' => (int)$totalWhitelist
        ]
    ];
}

function addFurrPermsWhitelist($db, $input) {
    $nick = trim($input['nick'] ?? '');
    $uuid = trim($input['uuid'] ?? '');
    $reason = trim($input['reason'] ?? '');

    if (!$nick) {
        return ['success' => false, 'error' => 'Nick requerido'];
    }

    // Validar nick format
    if (!preg_match('/^[a-zA-Z0-9_]{1,16}$/', $nick)) {
        return ['success' => false, 'error' => 'Nick inválido'];
    }

    // Validar UUID si se proporciona
    if ($uuid && !preg_match('/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i', $uuid)) {
        return ['success' => false, 'error' => 'UUID inválido'];
    }

    $check = $db->prepare("SELECT id FROM fur_perms_whitelist WHERE nick = ?");
    $check->execute([$nick]);
    if ($check->fetch()) {
        return ['success' => false, 'error' => 'El jugador ya está en la whitelist'];
    }

    $username = $_SESSION['furrguard_admin']['username'] ?? 'Admin';

    $stmt = $db->prepare("INSERT INTO fur_perms_whitelist (nick, uuid, reason, added_by) VALUES (?, ?, ?, ?)");
    $stmt->execute([$nick, $uuid ?: null, $reason, $username]);

    logActivity($db, 'furrperms', 'add', "Jugador añadido: $nick");
    incrementCacheVersion($db);

    return ['success' => true];
}

function removeFurrPermsWhitelist($db, $id) {
    $stmt = $db->prepare("SELECT nick FROM fur_perms_whitelist WHERE id = ?");
    $stmt->execute([$id]);
    $entry = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$entry) {
        return ['success' => false, 'error' => 'Entrada no encontrada'];
    }

    $db->prepare("DELETE FROM fur_perms_whitelist WHERE id = ?")->execute([$id]);

    logActivity($db, 'furrperms', 'remove', "Jugador eliminado: {$entry['nick']}");
    incrementCacheVersion($db);

    return ['success' => true];
}

function getFurrPermsLogs($db, $input) {
    $page = max(1, (int)($input['page'] ?? 1));
    $perPage = 50;
    $offset = ($page - 1) * $perPage;
    $filter = $input['filter'] ?? 'all';
    $search = $input['search'] ?? '';

    $where = '1=1';
    $params = [];

    if ($filter === 'allowed') {
        $where .= ' AND allowed = 1';
    } elseif ($filter === 'blocked') {
        $where .= ' AND allowed = 0';
    }

    if ($search) {
        $where .= ' AND (player_nick LIKE ? OR command LIKE ?)';
        $params[] = "%$search%";
        $params[] = "%$search%";
    }

    $total = $db->prepare("SELECT COUNT(*) FROM fur_perms_command_logs WHERE $where");
    $total->execute($params);
    $totalCount = $total->fetchColumn();

    $stmt = $db->prepare("
        SELECT * FROM fur_perms_command_logs
        WHERE $where
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    ");
    $params[] = $perPage;
    $params[] = $offset;
    $stmt->execute($params);
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Obtener estadísticas
    $totalLogs = $db->query("SELECT COUNT(*) FROM fur_perms_command_logs")->fetchColumn();
    $allowedLogs = $db->query("SELECT COUNT(*) FROM fur_perms_command_logs WHERE allowed = 1")->fetchColumn();
    $blockedLogs = $db->query("SELECT COUNT(*) FROM fur_perms_command_logs WHERE allowed = 0")->fetchColumn();

    return [
        'success' => true,
        'data' => [
            'logs' => $logs,
            'stats' => [
                'total' => (int)$totalLogs,
                'allowed' => (int)$allowedLogs,
                'blocked' => (int)$blockedLogs
            ],
            'pagination' => [
                'current_page' => $page,
                'total_pages' => ceil($totalCount / $perPage),
                'total' => $totalCount
            ]
        ]
    ];
}

function clearFurrPermsLogs($db) {
    // Confirmar que hay logs viejos para limpiar (más de 30 días)
    $deleted = $db->prepare("DELETE FROM fur_perms_command_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)");
    $deleted->execute();
    $count = $deleted->rowCount();

    logActivity($db, 'furrperms', 'clear_logs', "$count logs eliminados (más de 30 días)");

    return [
        'success' => true,
        'data' => ['deleted_count' => $count]
    ];
}

/**
 * Busca un jugador en la API de Mojang para determinar si es premium o no
 */
function lookupPlayer($playerName) {
    if (empty($playerName)) {
        return ['success' => false, 'error' => 'Nombre de jugador requerido'];
    }

    $result = lookupMinecraftProfile($playerName);

    if ($result['error'] && strpos($result['error'], 'Error de conexión') !== false) {
        return ['success' => false, 'error' => $result['error']];
    }

    return [
        'success' => true,
        'data' => [
            'is_premium' => $result['is_premium'],
            'uuid' => $result['uuid'],
            'name' => $result['name'],
            'error' => $result['error']
        ]
    ];
}

/**
 * Obtiene el historial de nombres de un jugador desde la API de liforra.de
 */
function getNameHistory($playerName) {
    if (empty($playerName)) {
        return ['success' => false, 'error' => 'Nombre de jugador requerido'];
    }

    $result = getPlayerNameHistory($playerName);

    if (!$result['success']) {
        return ['success' => false, 'error' => $result['error']];
    }

    return [
        'success' => true,
        'data' => $result['data']
    ];
}

/**
 * Añade un jugador a la blacklist usando el sistema unificado
 * Detecta automáticamente si es premium o no-premium y aplica el tipo correcto
 */
function addBlacklistUnified($db, $input) {
    $playerName = trim($input['player_name'] ?? '');
    $reason = $input['reason'] ?? '';
    $duration = isset($input['duration']) ? (int)$input['duration'] : 0;
    $stainIp = isset($input['stain_ip']) ? (int)$input['stain_ip'] : 1;

    // Datos opcionales del frontend (para evitar re-consultar Mojang si ya se verificó)
    $frontendIsPremium = isset($input['is_premium']) ? $input['is_premium'] : null;
    $frontendUuid = isset($input['uuid']) ? trim($input['uuid']) : null;

    if (empty($playerName)) {
        return ['success' => false, 'error' => 'Nombre de jugador requerido'];
    }

    // Validar formato de nombre
    if (!preg_match('/^[a-zA-Z0-9_]{1,16}$/', $playerName)) {
        return ['success' => false, 'error' => 'Formato de nombre inválido'];
    }

    // Si el frontend ya proporcionó datos verificados, usarlos directamente
    if ($frontendIsPremium !== null) {
        $isPremium = (bool)$frontendIsPremium;
        $uuid = $frontendUuid;
        $name = $playerName;
    } else {
        // Si no hay datos del frontend, consultar API de Mojang
        $profile = lookupMinecraftProfile($playerName);

        // Si hay error de conexión, usar fallback: asumir no-premium
        if ($profile['error'] && strpos($profile['error'], 'Error de conexión') !== false) {
            // Fallback: añadir como no-premium usando el nombre
            $isPremium = false;
            $uuid = null;
            $name = $playerName;
        } else {
            $isPremium = $profile['is_premium'];
            $uuid = $profile['uuid'];
            $name = $profile['name'] ?? $playerName;
        }
    }

    // Determinar tipo y valor según si es premium o no
    if ($isPremium) {
        $type = 'uuid';
        $value = $uuid;
        if (!$value) {
            return ['success' => false, 'error' => 'Error al obtener UUID del jugador premium'];
        }
    } else {
        $type = 'nick';
        $value = $name;
    }

    // Verificar si ya existe en blacklist
    $check = $db->prepare("SELECT id FROM blacklist WHERE type = ? AND value = ?");
    $check->execute([$type, $value]);
    if ($check->fetch()) {
        return ['success' => false, 'error' => 'Ya existe en blacklist'];
    }

    $expiresAt = null;
    if ($duration > 0) {
        $expiresAt = date('Y-m-d H:i:s', time() + ($duration * 60));
    }

    $username = $_SESSION['furrguard_admin']['username'] ?? 'Admin';
    $banId = generateBanId();

    // Insertar en blacklist
    $maxRetries = 3;
    $parentId = null;
    for ($i = 0; $i < $maxRetries; $i++) {
        try {
            $stmt = $db->prepare("INSERT INTO blacklist (ban_id, type, value, reason, added_by, expires_at) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->execute([$banId, $type, $value, $reason, $username, $expiresAt]);
            $parentId = (int)$db->lastInsertId();
            break;
        } catch (PDOException $e) {
            if ($i < $maxRetries - 1 && strpos($e->getMessage(), 'uk_ban_id') !== false) {
                $banId = generateBanId();
            } else {
                throw $e;
            }
        }
    }

    // Actualizar flag en players (case-insensitive para nick)
    if ($type === 'uuid') {
        $db->prepare("UPDATE players SET is_blacklisted = 1 WHERE uuid = ?")->execute([$value]);
    } elseif ($type === 'nick') {
        // Buscar case-insensitive por si hay diferencias de capitalización
        $db->prepare("UPDATE players SET is_blacklisted = 1 WHERE LOWER(last_nick) = LOWER(?)")->execute([$value]);
        // También actualizar por first_nick por si acaso
        $db->prepare("UPDATE players SET is_blacklisted = 1 WHERE LOWER(first_nick) = LOWER(?) AND is_blacklisted = 0")->execute([$value]);
    }

    // IP Manchada
    if ($stainIp && $parentId) {
        $ipsToAdd = [];

        if ($type === 'uuid') {
            $stmt = $db->prepare("SELECT id FROM players WHERE uuid = ? LIMIT 1");
            $stmt->execute([$value]);
            $player = $stmt->fetch();

            if ($player) {
                $stmt = $db->prepare("SELECT DISTINCT ip FROM player_ips WHERE player_id = ?");
                $stmt->execute([$player['id']]);
                $ipsToAdd = $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
            }
        } elseif ($type === 'nick') {
            $stmt = $db->prepare("SELECT DISTINCT ip FROM player_connections WHERE nick = ?");
            $stmt->execute([$value]);
            $ipsToAdd = $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];

            if (empty($ipsToAdd)) {
                $stmt = $db->prepare("
                    SELECT DISTINCT pi.ip
                    FROM player_ips pi
                    JOIN player_nicks pn ON pn.player_id = pi.player_id
                    WHERE LOWER(pn.nick) = LOWER(?)
                ");
                $stmt->execute([$value]);
                $ipsToAdd = $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
            }
        }

        foreach ($ipsToAdd as $ip) {
            $checkIp = $db->prepare("SELECT id FROM blacklist WHERE type = 'ip' AND value = ?");
            $checkIp->execute([$ip]);
            if (!$checkIp->fetch()) {
                $ipBanId = generateBanId();
                $stmt = $db->prepare("INSERT INTO blacklist (ban_id, type, value, reason, added_by, expires_at, parent_id) VALUES (?, 'ip', ?, ?, ?, ?, ?)");
                $stmt->execute([$ipBanId, $ip, $reason, $username, $expiresAt, $parentId]);
            }
        }
    }

    $typeLabel = $isPremium ? 'UUID (Premium)' : 'Nick (No-Premium)';
    logActivity($db, 'blacklist', 'add', "$typeLabel: $name ($value)");
    incrementCacheVersion($db);

    return [
        'success' => true,
        'data' => [
            'ban_id' => $banId,
            'type' => $type,
            'value' => $value,
            'is_premium' => $isPremium,
            'player_name' => $name
        ]
    ];
}

/**
 * Migra todas las blacklists de UUID y Nick al nuevo sistema unificado
 * Solo disponible para Founders
 */
function migrateBlacklist($db) {
    global $currentRole;

    // Solo Founder puede ejecutar la migración
    if ($currentRole !== 'founder') {
        return ['success' => false, 'error' => 'Solo el Founder puede ejecutar la migración'];
    }

    $results = [
        'total_processed' => 0,
        'migrated' => 0,
        'removed' => 0,
        'errors' => [],
        'details' => []
    ];

    // Obtener todas las entradas de tipo uuid y nick que son padres (no hijas)
    $stmt = $db->query("
        SELECT id, ban_id, type, value, reason, added_by, expires_at, active, created_at
        FROM blacklist
        WHERE type IN ('uuid', 'nick') AND parent_id IS NULL
        ORDER BY created_at ASC
    ");
    $entries = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $results['total_processed'] = count($entries);

    foreach ($entries as $entry) {
        $oldType = $entry['type'];
        $oldValue = $entry['value'];
        $playerName = null;
        $isPremium = null;
        $newType = null;
        $newValue = null;

        try {
            if ($oldType === 'uuid') {
                // Para UUIDs, obtener el nombre primero
                $cachedName = getMinecraftUsername($db, $oldValue);
                if ($cachedName) {
                    $playerName = $cachedName;
                    // Verificar si sigue siendo premium
                    $profile = lookupMinecraftProfile($cachedName);
                    $isPremium = $profile['is_premium'];
                    if ($isPremium) {
                        $newType = 'uuid';
                        $newValue = $oldValue;
                    } else {
                        // Ya no es premium, cambiar a nick
                        $newType = 'nick';
                        $newValue = $cachedName;
                    }
                } else {
                    // No se pudo obtener el nombre, intentar verificar directamente
                    $results['errors'][] = "No se pudo obtener nombre para UUID: $oldValue";
                    continue;
                }
            } else {
                // Para nicks, verificar si ahora es premium
                $playerName = $oldValue;
                $profile = lookupMinecraftProfile($oldValue);
                $isPremium = $profile['is_premium'];
                if ($isPremium) {
                    // Ahora es premium, cambiar a UUID
                    $newType = 'uuid';
                    $newValue = $profile['uuid'];
                } else {
                    $newType = 'nick';
                    $newValue = $oldValue;
                }
            }

            // Si el tipo o valor cambió, o necesitamos asegurar consistencia
            if ($newType && $newValue) {
                // Verificar si ya existe una entrada con el nuevo tipo/valor (duplicado)
                $checkDup = $db->prepare("SELECT id FROM blacklist WHERE type = ? AND value = ? AND id != ?");
                $checkDup->execute([$newType, $newValue, $entry['id']]);
                if ($checkDup->fetch()) {
                    // Duplicado detectado, eliminar esta entrada
                    $db->prepare("DELETE FROM blacklist WHERE id = ?")->execute([$entry['id']]);
                    $results['removed']++;
                    $results['details'][] = "Eliminado duplicado: $oldType:$oldValue -> $newType:$newValue";
                    continue;
                }

                // Actualizar la entrada
                if ($newType !== $oldType || $newValue !== $oldValue) {
                    $updateStmt = $db->prepare("UPDATE blacklist SET type = ?, value = ? WHERE id = ?");
                    $updateStmt->execute([$newType, $newValue, $entry['id']]);
                    $results['details'][] = "Migrado: $oldType:$oldValue -> $newType:$newValue (Premium: " . ($isPremium ? 'Sí' : 'No') . ")";
                } else {
                    $results['details'][] = "Verificado: $oldType:$oldValue (Premium: " . ($isPremium ? 'Sí' : 'No') . ")";
                }
                $results['migrated']++;
            }
        } catch (Exception $e) {
            $results['errors'][] = "Error procesando $oldType:$oldValue - " . $e->getMessage();
        }

        // Pequeña pausa para no sobrecargar la API de Mojang
        usleep(100000); // 100ms
    }

    logActivity($db, 'blacklist', 'migrate', "Migración completada: {$results['migrated']} procesados, {$results['removed']} eliminados");
    incrementCacheVersion($db);

    return [
        'success' => true,
        'data' => $results
    ];
}

/**
 * Migra todos los jugadores registrados para verificar si son premium o no
 * Actualiza sus UUIDs si son premium
 * Solo disponible para Founders
 */
function migratePlayers($db) {
    global $currentRole;

    // Solo Founder puede ejecutar la migración
    if ($currentRole !== 'founder') {
        return ['success' => false, 'error' => 'Solo el Founder puede ejecutar la migración'];
    }

    $results = [
        'total_processed' => 0,
        'premium' => 0,
        'not_premium' => 0,
        'updated' => 0,
        'errors' => [],
        'details' => []
    ];

    // Obtener todos los jugadores
    $stmt = $db->query("
        SELECT id, uuid, last_nick, first_nick
        FROM players
        ORDER BY last_seen DESC
    ");
    $players = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $results['total_processed'] = count($players);

    foreach ($players as $player) {
        $playerId = $player['id'];
        $currentUuid = $player['uuid'];
        $lastNick = $player['last_nick'];

        try {
            // Verificar si el jugador es premium usando su último nick
            $profile = lookupMinecraftProfile($lastNick);

            if ($profile['error'] && strpos($profile['error'], 'Error de conexión') !== false) {
                $results['errors'][] = "Error de conexión verificando: $lastNick";
                continue;
            }

            if ($profile['is_premium']) {
                $results['premium']++;
                $newUuid = $profile['uuid'];

                // Si el UUID cambió o era un UUID offline, actualizarlo
                if ($newUuid && $newUuid !== $currentUuid) {
                    // Verificar si el nuevo UUID ya existe en otro jugador
                    $checkStmt = $db->prepare("SELECT id FROM players WHERE uuid = ? AND id != ?");
                    $checkStmt->execute([$newUuid, $playerId]);
                    if (!$checkStmt->fetch()) {
                        $updateStmt = $db->prepare("UPDATE players SET uuid = ? WHERE id = ?");
                        $updateStmt->execute([$newUuid, $playerId]);
                        $results['updated']++;
                        $results['details'][] = "Actualizado: $lastNick (UUID: $currentUuid -> $newUuid)";
                    } else {
                        $results['errors'][] = "UUID duplicado para $lastNick: $newUuid ya existe en otro jugador";
                    }
                }
            } else {
                $results['not_premium']++;
                // Para jugadores no premium, mantener el UUID actual (que es offline)
                // No necesitamos cambiar nada
            }
        } catch (Exception $e) {
            $results['errors'][] = "Error procesando $lastNick: " . $e->getMessage();
        }

        // Pequeña pausa para no sobrecargar la API de Mojang
        usleep(150000); // 150ms
    }

    logActivity($db, 'players', 'migrate', "Migración de jugadores: {$results['premium']} premium, {$results['not_premium']} no premium, {$results['updated']} actualizados");

    return [
        'success' => true,
        'data' => $results
    ];
}

// ============================================
// FURRSECURITY FUNCTIONS
// ============================================

/**
 * Obtiene la lista de staff whitelist
 */
function getFurrSecurityStaff($db, $input) {
    $search = trim($input['search'] ?? '');

    $where = '1=1';
    $params = [];

    if ($search) {
        $where .= ' AND (minecraft_nick LIKE :search OR discord_id LIKE :search)';
        $params['search'] = "%$search%";
    }

    $stmt = $db->prepare("
        SELECT id, discord_id, minecraft_nick, added_by, added_at
        FROM furrsecurity_staff
        WHERE $where
        ORDER BY added_at DESC
    ");
    $stmt->execute($params);
    $staff = $stmt->fetchAll(PDO::FETCH_ASSOC);

    return [
        'success' => true,
        'data' => $staff
    ];
}

/**
 * Añade un miembro al staff whitelist
 */
function addFurrSecurityStaff($db, $input) {
    $discordId = trim($input['discord_id'] ?? '');
    $minecraftNick = trim($input['minecraft_nick'] ?? '');

    if (empty($discordId) || empty($minecraftNick)) {
        return ['success' => false, 'error' => 'Discord ID y nick son requeridos'];
    }

    // Validar formato de Discord ID (17-20 dígitos)
    if (!preg_match('/^\d{17,20}$/', $discordId)) {
        return ['success' => false, 'error' => 'Discord ID inválido (debe tener 17-20 dígitos)'];
    }

    // Validar formato de nick de Minecraft (1-16 caracteres alfanuméricos + underscore)
    if (!preg_match('/^[a-zA-Z0-9_]{1,16}$/', $minecraftNick)) {
        return ['success' => false, 'error' => 'Nick de Minecraft inválido (1-16 caracteres alfanuméricos)'];
    }

    $username = $_SESSION['furrguard_admin']['username'] ?? 'Admin';

    // Verificar si ya existe
    $check = $db->prepare("SELECT id FROM furrsecurity_staff WHERE discord_id = ? OR minecraft_nick = ?");
    $check->execute([$discordId, $minecraftNick]);
    if ($check->fetch()) {
        return ['success' => false, 'error' => 'Ya existe un registro con este Discord ID o nick'];
    }

    $stmt = $db->prepare("INSERT INTO furrsecurity_staff (discord_id, minecraft_nick, added_by) VALUES (?, ?, ?)");
    $stmt->execute([$discordId, $minecraftNick, $username]);

    logActivity($db, 'furrsecurity', 'add_staff', "Staff añadido: $minecraftNick (Discord: $discordId)");

    return ['success' => true, 'id' => $db->lastInsertId()];
}

/**
 * Elimina un miembro del staff whitelist
 */
function removeFurrSecurityStaff($db, $input) {
    $id = (int)($input['id'] ?? 0);

    if ($id <= 0) {
        return ['success' => false, 'error' => 'ID inválido'];
    }

    $stmt = $db->prepare("SELECT minecraft_nick FROM furrsecurity_staff WHERE id = ?");
    $stmt->execute([$id]);
    $entry = $stmt->fetch();

    if (!$entry) {
        return ['success' => false, 'error' => 'Entrada no encontrada'];
    }

    $db->prepare("DELETE FROM furrsecurity_staff WHERE id = ?")->execute([$id]);

    logActivity($db, 'furrsecurity', 'remove_staff', "Staff eliminado: {$entry['minecraft_nick']}");

    return ['success' => true];
}

/**
 * Obtiene las sesiones de verificación activas
 */
function getFurrSecuritySessions($db, $input) {
    $search = trim($input['search'] ?? '');
    $includeExpired = isset($input['include_expired']) ? (bool)$input['include_expired'] : false;

    $where = $includeExpired ? '1=1' : "status = 'verified' AND expires_at > NOW()";
    $params = [];

    if ($search) {
        $where .= ' AND (minecraft_nick LIKE :search OR uuid LIKE :search OR discord_id LIKE :search)';
        $params['search'] = "%$search%";
    }

    $stmt = $db->prepare("
        SELECT id, uuid, discord_id, minecraft_nick, status, verified_at, expires_at, ip_address, created_at
        FROM furrsecurity_verifications
        WHERE $where
        ORDER BY created_at DESC
        LIMIT 100
    ");
    $stmt->execute($params);
    $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);

    return [
        'success' => true,
        'data' => $sessions
    ];
}

/**
 * Obtiene los logs de FurrSecurity
 */
function getFurrSecurityLogs($db, $input) {
    $page = max(1, (int)($input['page'] ?? 1));
    $perPage = 50;
    $offset = ($page - 1) * $perPage;
    $filter = $input['filter'] ?? 'all';
    $search = trim($input['search'] ?? '');

    $where = '1=1';
    $params = [];

    if ($filter !== 'all') {
        $where .= ' AND action = :filter';
        $params['filter'] = $filter;
    }

    if ($search) {
        $where .= ' AND (minecraft_nick LIKE :search OR uuid LIKE :search OR discord_id LIKE :search OR details LIKE :search)';
        $params['search'] = "%$search%";
    }

    // Contar total
    $countStmt = $db->prepare("SELECT COUNT(*) FROM furrsecurity_logs WHERE $where");
    $countStmt->execute($params);
    $totalCount = (int)$countStmt->fetchColumn();

    // Obtener logs
    $params['limit'] = $perPage;
    $params['offset'] = $offset;

    $stmt = $db->prepare("
        SELECT id, uuid, minecraft_nick, discord_id, action, details, ip_address, created_at
        FROM furrsecurity_logs
        WHERE $where
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset
    ");
    $stmt->execute($params);
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    return [
        'success' => true,
        'data' => [
            'logs' => $logs,
            'pagination' => [
                'current_page' => $page,
                'total_pages' => ceil($totalCount / $perPage),
                'total' => $totalCount
            ]
        ]
    ];
}

/**
 * Revoca una sesión de verificación
 */
function revokeFurrSecuritySession($db, $input) {
    $id = (int)($input['id'] ?? 0);

    if ($id <= 0) {
        return ['success' => false, 'error' => 'ID inválido'];
    }

    $stmt = $db->prepare("SELECT minecraft_nick, status FROM furrsecurity_verifications WHERE id = ?");
    $stmt->execute([$id]);
    $session = $stmt->fetch();

    if (!$session) {
        return ['success' => false, 'error' => 'Sesión no encontrada'];
    }

    $db->prepare("UPDATE furrsecurity_verifications SET status = 'expired', expires_at = NOW() WHERE id = ?")->execute([$id]);

    logActivity($db, 'furrsecurity', 'revoke_session', "Sesión revocada: {$session['minecraft_nick']}");

    return ['success' => true];
}

/**
 * Obtiene estadísticas de FurrSecurity
 */
function getFurrSecurityStats($db) {
    $totalStaff = $db->query("SELECT COUNT(*) FROM furrsecurity_staff")->fetchColumn();
    $activeSessions = $db->query("SELECT COUNT(*) FROM furrsecurity_verifications WHERE status = 'verified' AND expires_at > NOW()")->fetchColumn();
    $pendingVerifications = $db->query("SELECT COUNT(*) FROM furrsecurity_verifications WHERE status = 'pending'")->fetchColumn();
    $verifiedToday = $db->query("SELECT COUNT(*) FROM furrsecurity_verifications WHERE status = 'verified' AND DATE(verified_at) = CURDATE()")->fetchColumn();

    return [
        'success' => true,
        'data' => [
            'total_staff' => (int)$totalStaff,
            'active_sessions' => (int)$activeSessions,
            'pending_verifications' => (int)$pendingVerifications,
            'verified_today' => (int)$verifiedToday
        ]
    ];
}
