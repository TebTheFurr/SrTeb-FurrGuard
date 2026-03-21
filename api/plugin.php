<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: ' . (getenv('CORS_ALLOWED_ORIGIN') ?: 'https://furrguard.srteb.eu'));
header('Access-Control-Allow-Methods: POST, GET');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');

// Handle CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/ip_api_improvements.php';

// Check database connection early
$db = db();
if ($db === null) {
    http_response_code(503);
    echo json_encode([
        'error' => 'database_unavailable',
        'message' => 'Database temporarily unavailable',
        'fallback' => 'deny',
        'retry_after' => 60
    ]);
    exit;
}

// Rate limit: 120 requests per minute per IP for plugin API
$clientIp = getClientIp();
enforceRateLimit($clientIp, 120, 60, 'plugin_api');

// TODAS las acciones requieren API key (fix: autenticación obligatoria)
$action = $_GET['action'] ?? $_POST['action'] ?? '';
requireApiKey();

// Validate action is a known action
$validActions = ['check_player', 'lookup_player', 'player_join', 'player_quit', 'get_messages', 'add_whitelist', 'remove_whitelist', 'add_blacklist', 'remove_blacklist', 'get_settings', 'poll_changes', 'check_furr_perms_whitelist', 'log_furr_perms_command'];
if (!in_array($action, $validActions, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid action']);
    exit;
}

try {
    switch ($action) {
        case 'check_player':
            // Extra rate limit for check_player (consumes ip-api.com quota)
            enforceRateLimit($clientIp, 45, 60, 'check_player');
            handleCheckPlayer($db);
            break;

        case 'lookup_player':
            handleLookupPlayer($db);
            break;

        case 'player_join':
            handlePlayerJoin($db);
            break;

        case 'player_quit':
            handlePlayerQuit($db);
            break;

        case 'get_messages':
            handleGetMessages($db);
            break;

        case 'add_whitelist':
            handleAddWhitelist($db);
            break;

        case 'remove_whitelist':
            handleRemoveWhitelist($db);
            break;

        case 'add_blacklist':
            handleAddBlacklist($db);
            break;

        case 'remove_blacklist':
            handleRemoveBlacklist($db);
            break;

        case 'get_settings':
            handleGetSettings($db);
            break;

        case 'poll_changes':
            handlePollChanges($db);
            break;

        case 'check_furr_perms_whitelist':
            handleCheckFurrPermsWhitelist($db);
            break;

        case 'log_furr_perms_command':
            handleLogFurrPermsCommand($db);
            break;

        default:
            http_response_code(400);
            echo json_encode(['error' => 'Invalid action']);
    }
} catch (PDOException $e) {
    error_log("API PDO Error: " . $e->getMessage());
    http_response_code(503); // Service Unavailable
    header('Retry-After: 60'); // Suggest retry after 60 seconds
    echo json_encode([
        'error' => 'database_unavailable',
        'message' => 'Database temporarily unavailable',
        'fallback' => 'deny', // Tell plugin to deny connections
        'retry_after' => 60
    ]);
} catch (Exception $e) {
    error_log("API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'error' => 'internal_error',
        'message' => 'Internal server error',
        'fallback' => 'deny' // Tell plugin to deny connections on internal errors
    ]);
}

function handleCheckPlayer(PDO $db): void {
    $uuid = trim($_POST['uuid'] ?? '');
    $nick = trim($_POST['nick'] ?? '');
    $ip = trim($_POST['ip'] ?? '');
    $gameVersion = trim($_POST['game_version'] ?? '');

    if (!$nick || !$ip) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields']);
        return;
    }

    // Validate IP format
    if (!filter_var($ip, FILTER_VALIDATE_IP)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid IP address']);
        return;
    }

    // Validate nick format (Minecraft usernames: 1-16 chars, alphanumeric + underscore)
    if (!preg_match('/^[a-zA-Z0-9_]{1,16}$/', $nick)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid nickname']);
        return;
    }

    // Validate UUID if provided
    if ($uuid && !preg_match('/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i', $uuid)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid UUID']);
        return;
    }

    // Sanitize game version
    $gameVersion = substr($gameVersion, 0, 20);

    $ipData = checkIpApiWithRateLimit($ip, $db);

    // Check if IP API failed and we should fail closed
    if ($ipData === null) {
        $failOpen = getSetting($db, 'ip_api_fail_open', '0') === '1';

        if (!$failOpen) {
            // Fail closed - deny connection when IP API is unavailable
            echo json_encode([
                'allowed' => false,
                'reason' => 'ip_api_unavailable',
                'ip_data' => []
            ]);
            return;
        }

        // Fail open - allow but log warning
        error_log("IP API unavailable for $ip, allowing connection (fail_open mode)");

        // Use empty IP data and continue with whitelist/blacklist checks only
        $ipData = [];
    }

    $asn = $ipData['as'] ?? null;

    $uuidOrNull = $uuid ?: null;

    // Si no tenemos UUID, intentar resolverlo desde la BD por nick
    if (!$uuidOrNull && $nick) {
        $stmtUuid = $db->prepare("SELECT uuid FROM players WHERE last_nick = :nick1 OR first_nick = :nick2 LIMIT 1");
        $stmtUuid->execute(['nick1' => $nick, 'nick2' => $nick]);
        $foundPlayer = $stmtUuid->fetch();
        if ($foundPlayer && !empty($foundPlayer['uuid'])) {
            $uuidOrNull = $foundPlayer['uuid'];
        }
    }

    if (isPlayerWhitelisted($db, $uuidOrNull, $nick, $ip, $asn)) {
        echo json_encode([
            'allowed' => true,
            'reason' => 'whitelisted',
            'ip_data' => $ipData
        ]);
        return;
    }

    // Detectar cambio drástico de país (cuenta comprometida)
    $currentCountryCode = $ipData['countryCode'] ?? null;
    $countryChangeInfo = null;
    if ($currentCountryCode) {
        $countryChangeInfo = detectDrasticCountryChange($db, $uuidOrNull, $nick, $currentCountryCode);
        if ($countryChangeInfo !== null) {
            // Aplicar blacklist automática por cuenta comprometida
            applyCompromisedAccountBlacklist($db, $uuidOrNull, $nick, $ip, $countryChangeInfo);

            // Log de la conexión bloqueada
            $connectionData = [
                'uuid' => $uuidOrNull,
                'nick' => $nick,
                'ip' => $ip,
                'ip_version' => getIpVersion($ip),
                'country' => $ipData['country'] ?? null,
                'country_code' => $ipData['countryCode'] ?? null,
                'region' => $ipData['regionName'] ?? null,
                'city' => $ipData['city'] ?? null,
                'isp' => $ipData['isp'] ?? null,
                'org' => $ipData['org'] ?? null,
                'asn' => $ipData['as'] ?? null,
                'asname' => $ipData['asname'] ?? null,
                'is_proxy' => ($ipData['proxy'] ?? false) ? 1 : 0,
                'is_vpn' => 0,
                'is_hosting' => ($ipData['hosting'] ?? false) ? 1 : 0,
                'is_mobile' => ($ipData['mobile'] ?? false) ? 1 : 0,
                'latitude' => $ipData['lat'] ?? null,
                'longitude' => $ipData['lon'] ?? null,
                'timezone' => $ipData['timezone'] ?? null,
                'game_version' => $gameVersion,
                'blocked' => 1,
                'block_reason' => 'compromised_account',
                'raw_data' => json_encode($ipData)
            ];
            logPlayerConnection($db, $connectionData);

            echo json_encode([
                'allowed' => false,
                'reason' => 'compromised_account',
                'block_reason' => 'Cuenta comprometida',
                'details' => sprintf(
                    'Cambio de país detectado: %s → %s',
                    $countryChangeInfo['historical_country'],
                    $countryChangeInfo['current_country']
                ),
                'country_change' => $countryChangeInfo,
                'ip_data' => $ipData
            ]);
            return;
        }
    }

    $blacklistEntry = isPlayerBlacklisted($db, $uuidOrNull, $nick, $ip, $asn);
    if ($blacklistEntry) {
        $blockedName = null;
        if ($blacklistEntry['type'] === 'uuid' && $blacklistEntry['value']) {
            $blockedName = getMinecraftUsername($db, $blacklistEntry['value']);
        }

        // Auto-ban IP if player is blacklisted by uuid/nick but IP is not
        if (in_array($blacklistEntry['type'], ['uuid', 'nick'])) {
            $checkIp = $db->prepare("SELECT id FROM blacklist WHERE type = 'ip' AND value = ? AND active = 1");
            $checkIp->execute([$ip]);
            if (!$checkIp->fetch()) {
                // Auto-ban IP with retry on duplicate ban_id
                $maxRetries = 3;
                $ipBanned = false;

                for ($i = 0; $i < $maxRetries; $i++) {
                    try {
                        $ipBanId = generateBanId();
                        $stmt = $db->prepare("
                            INSERT INTO blacklist (ban_id, type, value, reason, added_by, expires_at)
                            VALUES (?, 'ip', ?, ?, ?, ?)
                        ");
                        $stmt->execute([
                            $ipBanId,
                            $ip,
                            $blacklistEntry['reason'] . ' - Ban Evading (Blacklist)',
                            $blacklistEntry['added_by'] ?? 'Plugin',
                            $blacklistEntry['expires_at']
                        ]);
                        $ipBanned = true;
                        incrementCacheVersion($db);
                        break;
                    } catch (PDOException $e) {
                        // Check if it's a duplicate ban_id error
                        if (strpos($e->getMessage(), 'uk_ban_id') !== false && $i < $maxRetries - 1) {
                            // Retry with new ban_id
                            continue;
                        }
                        error_log("Failed to auto-ban IP $ip for blacklisted player: " . $e->getMessage());
                        break;
                    }
                }

                if (!$ipBanned) {
                    error_log("CRITICAL: Failed to auto-ban IP $ip - player may evade ban");
                }
            }
        }

        $connectionData = [
            'uuid' => $uuidOrNull,
            'nick' => $nick,
            'ip' => $ip,
            'ip_version' => getIpVersion($ip),
            'country' => $ipData['country'] ?? null,
            'country_code' => $ipData['countryCode'] ?? null,
            'region' => $ipData['regionName'] ?? null,
            'city' => $ipData['city'] ?? null,
            'isp' => $ipData['isp'] ?? null,
            'org' => $ipData['org'] ?? null,
            'asn' => $ipData['as'] ?? null,
            'asname' => $ipData['asname'] ?? null,
            'is_proxy' => ($ipData['proxy'] ?? false) ? 1 : 0,
            'is_vpn' => 0,
            'is_hosting' => ($ipData['hosting'] ?? false) ? 1 : 0,
            'is_mobile' => ($ipData['mobile'] ?? false) ? 1 : 0,
            'latitude' => $ipData['lat'] ?? null,
            'longitude' => $ipData['lon'] ?? null,
            'timezone' => $ipData['timezone'] ?? null,
            'game_version' => $gameVersion,
            'blocked' => 1,
            'block_reason' => 'blacklisted',
            'raw_data' => json_encode($ipData)
        ];
        logPlayerConnection($db, $connectionData);

        echo json_encode([
            'allowed' => false,
            'reason' => 'blacklisted',
            'block_reason' => $blacklistEntry['reason'],
            'block_type' => $blacklistEntry['type'],
            'expires_at' => $blacklistEntry['expires_at'] ?? null,
            'ban_id' => $blacklistEntry['ban_id'] ?? null,
            'blocked_name' => $blockedName,
            'ip_data' => $ipData
        ]);
        return;
    }

    $blockVpn = getSetting($db, 'block_vpn', '1') === '1';
    $blockProxy = getSetting($db, 'block_proxy', '1') === '1';
    $blockHosting = getSetting($db, 'block_hosting', '1') === '1';

    $blocked = false;
    $blockReason = null;

    if ($ipData) {
        if ($blockProxy && ($ipData['proxy'] ?? false)) {
            $blocked = true;
            $blockReason = 'proxy_detected';
        } elseif ($blockVpn && ($ipData['hosting'] ?? false) && isInBlockedProviders($db, $ipData['isp'] ?? null, $ipData['org'] ?? null, $ipData['asname'] ?? null, 'vpn')) {
            $blocked = true;
            $blockReason = 'vpn_detected';
        } elseif ($blockHosting && ($ipData['hosting'] ?? false)) {
            $blocked = true;
            $blockReason = 'hosting_detected';
        }

        if (!$blocked && isInBlockedProviders($db, $ipData['isp'] ?? null, $ipData['org'] ?? null, $ipData['asname'] ?? null, 'hosting')) {
            $blocked = true;
            $blockReason = 'blocked_provider';
        }

        if (!$blocked) {
            $blockedCountry = isCountryBlocked($db, $ipData['countryCode'] ?? null);
            if ($blockedCountry) {
                $blocked = true;
                $blockReason = 'blocked_country';

                $db->prepare("UPDATE blocked_countries SET block_count = block_count + 1 WHERE id = ?")->execute([$blockedCountry['id']]);
            }
        }

        if (!$blocked) {
            $blockedContinent = isContinentBlocked($db, $ipData['continentCode'] ?? null);
            if ($blockedContinent) {
                $blocked = true;
                $blockReason = 'blocked_continent';

                $db->prepare("UPDATE blocked_continents SET block_count = block_count + 1 WHERE id = ?")->execute([$blockedContinent['id']]);
            }
        }
    }

    $connectionData = [
        'uuid' => $uuidOrNull,
        'nick' => $nick,
        'ip' => $ip,
        'ip_version' => getIpVersion($ip),
        'country' => $ipData['country'] ?? null,
        'country_code' => $ipData['countryCode'] ?? null,
        'region' => $ipData['regionName'] ?? null,
        'city' => $ipData['city'] ?? null,
        'isp' => $ipData['isp'] ?? null,
        'org' => $ipData['org'] ?? null,
        'asn' => $ipData['as'] ?? null,
        'asname' => $ipData['asname'] ?? null,
        'is_proxy' => ($ipData['proxy'] ?? false) ? 1 : 0,
        'is_vpn' => 0,
        'is_hosting' => ($ipData['hosting'] ?? false) ? 1 : 0,
        'is_mobile' => ($ipData['mobile'] ?? false) ? 1 : 0,
        'latitude' => $ipData['lat'] ?? null,
        'longitude' => $ipData['lon'] ?? null,
        'timezone' => $ipData['timezone'] ?? null,
        'game_version' => $gameVersion,
        'blocked' => $blocked ? 1 : 0,
        'block_reason' => $blockReason,
        'raw_data' => json_encode($ipData)
    ];

    logPlayerConnection($db, $connectionData);

    if ($ipData) {
        updatePlayerInfo($db, $uuidOrNull, $nick, $ip, $ipData);
    }

    echo json_encode([
        'allowed' => !$blocked,
        'reason' => $blocked ? $blockReason : 'allowed',
        'ip_data' => $ipData
    ]);
}

function handleLookupPlayer(PDO $db): void {
    $nick = trim($_POST['nick'] ?? '');

    if (!$nick) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing nick']);
        return;
    }

    if (!preg_match('/^[a-zA-Z0-9_]{1,16}$/', $nick)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid nickname']);
        return;
    }

    // Search player by last_nick or first_nick
    $stmt = $db->prepare("SELECT uuid, last_nick, last_ip, last_country, last_country_code, is_online, first_seen, last_seen FROM players WHERE last_nick = :nick1 OR first_nick = :nick2 LIMIT 1");
    $stmt->execute(['nick1' => $nick, 'nick2' => $nick]);
    $player = $stmt->fetch();

    // Also check player_nicks table as fallback
    if (!$player || empty($player['last_ip'])) {
        $stmt2 = $db->prepare("SELECT p.uuid, p.last_nick, p.last_ip, p.last_country, p.last_country_code, p.is_online, p.first_seen, p.last_seen FROM player_nicks pn JOIN players p ON p.id = pn.player_id WHERE pn.nick = :nick LIMIT 1");
        $stmt2->execute(['nick' => $nick]);
        $player = $stmt2->fetch();
    }

    if (!$player || empty($player['last_ip'])) {
        echo json_encode(['error' => 'player_not_found']);
        return;
    }

    $ip = $player['last_ip'];
    $uuid = $player['uuid'];
    $lastNick = $player['last_nick'];

    // Run IP check with their last known IP
    $ipData = checkIpApiWithRateLimit($ip, $db);
    $asn = $ipData['as'] ?? null;

    $isWhitelisted = isPlayerWhitelisted($db, $uuid, $lastNick, $ip, $asn);
    $blacklistInfo = isPlayerBlacklisted($db, $uuid, $lastNick, $ip, $asn);
    $isBlacklisted = $blacklistInfo !== false;

    $blocked = false;
    $blockReason = 'allowed';
    $blockType = null;
    $expiresAt = null;
    $banId = null;

    if ($isBlacklisted && !$isWhitelisted) {
        $blocked = true;
        $blockReason = 'blacklisted';
        $blockType = $blacklistInfo['type'] ?? null;
        $expiresAt = $blacklistInfo['expires_at'] ?? null;
        $banId = $blacklistInfo['ban_id'] ?? null;
    } elseif (!$isWhitelisted) {
        $isProxy = $ipData['proxy'] ?? false;
        $isHosting = $ipData['hosting'] ?? false;
        $isp = $ipData['isp'] ?? null;
        $org = $ipData['org'] ?? null;
        $asname = $ipData['asname'] ?? null;
        $providerBlocked = isInBlockedProviders($db, $isp, $org, $asname, 'hosting') || isInBlockedProviders($db, $isp, $org, $asname, 'vpn') || isInBlockedProviders($db, $isp, $org, $asname, 'proxy');

        if ($isProxy) {
            $blocked = true;
            $blockReason = 'proxy_detected';
        } elseif ($isHosting) {
            $blocked = true;
            $blockReason = 'hosting_detected';
        } elseif ($providerBlocked) {
            $blocked = true;
            $blockReason = 'blocked_provider';
        }
    }

    echo json_encode([
        'found' => true,
        'uuid' => $uuid,
        'nick' => $lastNick,
        'ip' => $ip,
        'is_online' => (bool)$player['is_online'],
        'first_seen' => $player['first_seen'],
        'last_seen' => $player['last_seen'],
        'allowed' => !$blocked,
        'reason' => $blocked ? $blockReason : 'allowed',
        'block_type' => $blockType,
        'expires_at' => $expiresAt,
        'ban_id' => $banId,
        'ip_data' => $ipData
    ]);
}

function handlePlayerJoin(PDO $db): void {
    $uuid = trim($_POST['uuid'] ?? '');
    $nick = trim($_POST['nick'] ?? '');
    $ip = trim($_POST['ip'] ?? '');

    if (!$uuid) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing UUID']);
        return;
    }

    $stmt = $db->prepare("SELECT id FROM players WHERE uuid = :uuid");
    $stmt->execute(['uuid' => $uuid]);
    $player = $stmt->fetch();

    if ($player) {
        $params = ['nick' => $nick, 'uuid' => $uuid];
        $ipUpdate = '';
        if ($ip) {
            $ipUpdate = ', last_ip = :ip';
            $params['ip'] = $ip;
        }
        $stmt = $db->prepare("
            UPDATE players SET
                last_nick = :nick,
                is_online = 1,
                last_seen = NOW()
                $ipUpdate
            WHERE uuid = :uuid
        ");
        $stmt->execute($params);
        $playerId = $player['id'];
    } else {
        $stmt = $db->prepare("
            INSERT INTO players (uuid, first_nick, last_nick, first_ip, last_ip, is_online)
            VALUES (:uuid, :first_nick, :last_nick, :first_ip, :last_ip, 1)
        ");
        $stmt->execute([
            'uuid' => $uuid,
            'first_nick' => $nick,
            'last_nick' => $nick,
            'first_ip' => $ip ?: null,
            'last_ip' => $ip ?: null
        ]);
        $playerId = (int)$db->lastInsertId();
    }

    if ($nick && $playerId) {
        $stmt = $db->prepare("SELECT id FROM player_nicks WHERE player_id = :player_id AND LOWER(nick) = LOWER(:nick)");
        $stmt->execute(['player_id' => $playerId, 'nick' => $nick]);
        if (!$stmt->fetch()) {
            $stmt = $db->prepare("INSERT INTO player_nicks (player_id, nick) VALUES (:player_id, :nick)");
            $stmt->execute(['player_id' => $playerId, 'nick' => $nick]);
        }
    }

    if ($ip && $playerId) {
        $stmt = $db->prepare("SELECT id FROM player_ips WHERE player_id = :player_id AND ip = :ip");
        $stmt->execute(['player_id' => $playerId, 'ip' => $ip]);
        if (!$stmt->fetch()) {
            $stmt = $db->prepare("INSERT INTO player_ips (player_id, ip) VALUES (:player_id, :ip)");
            $stmt->execute(['player_id' => $playerId, 'ip' => $ip]);
        }
    }

    echo json_encode(['success' => true]);
}

function handlePlayerQuit(PDO $db): void {
    $uuid = $_POST['uuid'] ?? '';

    if (!$uuid) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing UUID']);
        return;
    }

    $stmt = $db->prepare("UPDATE players SET is_online = 0, last_seen = NOW() WHERE uuid = :uuid");
    $stmt->execute(['uuid' => $uuid]);

    echo json_encode(['success' => true]);
}

function handleGetMessages(PDO $db): void {
    $stmt = $db->prepare("SELECT `key`, value FROM messages");
    $stmt->execute();
    $messages = [];
    while ($row = $stmt->fetch()) {
        $messages[$row['key']] = $row['value'];
    }
    echo json_encode($messages);
}

/**
 * Validate whitelist/blacklist value based on type.
 * Returns validated value or null if invalid.
 */
function validateListValue(string $type, string $value): ?string {
    $value = trim($value);

    switch ($type) {
        case 'uuid':
            // Validate UUID format (with or without dashes)
            if (preg_match('/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i', $value)) {
                // Normalize to dashed format
                return preg_replace('/^([0-9a-f]{8})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{4})([0-9a-f]{12})$/i', '$1-$2-$3-$4-$5', str_replace('-', '', $value));
            }
            return null;

        case 'nick':
            // Validate Minecraft username format
            if (preg_match('/^[a-zA-Z0-9_]{1,16}$/', $value)) {
                return $value;
            }
            return null;

        case 'ip':
            // Validate IP address (IPv4 or IPv6)
            if (filter_var($value, FILTER_VALIDATE_IP)) {
                return $value;
            }
            return null;

        case 'ip_range':
            // Validate CIDR notation (IPv4 or IPv6)
            if (preg_match('/^([0-9a-f.:]+)\/(\d+)$/i', $value, $matches)) {
                $ip = $matches[1];
                $prefix = (int)$matches[2];
                if (filter_var($ip, FILTER_VALIDATE_IP)) {
                    $isIPv6 = filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6);
                    $maxPrefix = $isIPv6 ? 128 : 32;
                    if ($prefix >= 0 && $prefix <= $maxPrefix) {
                        return $value;
                    }
                }
            }
            return null;

        case 'as':
            // Validate ASN format (AS12345 or just 12345)
            if (preg_match('/^AS\d+$/i', $value)) {
                return strtoupper($value);
            }
            if (preg_match('/^\d+$/', $value)) {
                return 'AS' . $value;
            }
            return null;

        default:
            return null;
    }
}

function handleAddWhitelist(PDO $db): void {
    $type = $_POST['type'] ?? '';
    $value = $_POST['value'] ?? '';
    $reason = $_POST['reason'] ?? '';
    $addedBy = $_POST['added_by'] ?? 'Plugin';

    if (!in_array($type, ['uuid', 'nick', 'ip', 'as', 'ip_range'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid type']);
        return;
    }

    if (empty($value)) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing value']);
        return;
    }

    // Validate value format based on type
    $validatedValue = validateListValue($type, $value);
    if ($validatedValue === null) {
        http_response_code(400);
        echo json_encode(['error' => "Invalid value format for type '{$type}'"]);
        return;
    }

    // Sanitize reason
    $reason = substr(trim($reason), 0, 255);

    // Sanitize added_by
    $addedBy = substr(trim($addedBy), 0, 50);

    $stmt = $db->prepare("
        INSERT INTO whitelist (type, value, reason, added_by)
        VALUES (:type, :value, :reason, :added_by)
        ON DUPLICATE KEY UPDATE reason = :reason_upd, added_by = :added_by_upd, updated_at = NOW()
    ");
    $stmt->execute([
        'type' => $type,
        'value' => $validatedValue,
        'reason' => $reason,
        'added_by' => $addedBy,
        'reason_upd' => $reason,
        'added_by_upd' => $addedBy
    ]);

    logActivity($db, 'whitelist', 'add', "{$type}: {$validatedValue}");
    incrementCacheVersion($db);

    echo json_encode(['success' => true]);
}

function handleRemoveWhitelist(PDO $db): void {
    $type = $_POST['type'] ?? '';
    $value = $_POST['value'] ?? '';

    $stmt = $db->prepare("DELETE FROM whitelist WHERE type = :type AND value = :value");
    $stmt->execute(['type' => $type, 'value' => $value]);

    logActivity($db, 'whitelist', 'remove', "{$type}: {$value}");
    incrementCacheVersion($db);

    echo json_encode(['success' => true, 'deleted' => $stmt->rowCount()]);
}

function handleAddBlacklist(PDO $db): void {
    $type = $_POST['type'] ?? '';
    $value = $_POST['value'] ?? '';
    $reason = $_POST['reason'] ?? '';
    $addedBy = $_POST['added_by'] ?? 'Plugin';
    $duration = isset($_POST['duration']) ? (int)$_POST['duration'] : 0;
    $stainIp = isset($_POST['stain_ip']) ? (int)$_POST['stain_ip'] : 1;

    if (!in_array($type, ['uuid', 'nick', 'ip', 'as', 'ip_range'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid type']);
        return;
    }

    if (empty($value)) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing value']);
        return;
    }

    // Validate value format based on type
    $validatedValue = validateListValue($type, $value);
    if ($validatedValue === null) {
        http_response_code(400);
        echo json_encode(['error' => "Invalid value format for type '{$type}'"]);
        return;
    }

    // Sanitize reason
    $reason = substr(trim($reason), 0, 255);

    // Sanitize added_by
    $addedBy = substr(trim($addedBy), 0, 50);

    $expiresAt = null;
    if ($duration > 0) {
        $expiresAt = date('Y-m-d H:i:s', time() + ($duration * 60));
    }

    $banId = generateBanId();

    // Check if entry already exists (ON DUPLICATE KEY won't need new ban_id)
    $existing = $db->prepare("SELECT id, ban_id FROM blacklist WHERE type = :type AND value = :value");
    $existing->execute(['type' => $type, 'value' => $validatedValue]);
    $existingEntry = $existing->fetch();

    $parentId = null;
    if ($existingEntry) {
        $banId = $existingEntry['ban_id'];
        $parentId = $existingEntry['id'];
        $stmt = $db->prepare("
            UPDATE blacklist SET reason = :reason, added_by = :added_by, active = 1, expires_at = :expires_at, updated_at = NOW()
            WHERE type = :type AND value = :value
        ");
        $stmt->execute([
            'type' => $type,
            'value' => $validatedValue,
            'reason' => $reason,
            'added_by' => $addedBy,
            'expires_at' => $expiresAt
        ]);
    } else {
        $stmt = $db->prepare("
            INSERT INTO blacklist (ban_id, type, value, reason, added_by, expires_at)
            VALUES (:ban_id, :type, :value, :reason, :added_by, :expires_at)
        ");
        $stmt->execute([
            'ban_id' => $banId,
            'type' => $type,
            'value' => $validatedValue,
            'reason' => $reason,
            'added_by' => $addedBy,
            'expires_at' => $expiresAt
        ]);
        $parentId = (int)$db->lastInsertId();
    }

    // IP Manchada: Si el tipo es uuid o nick, también añadir la IP a la blacklist automáticamente con parent_id
    if ($stainIp && in_array($type, ['uuid', 'nick']) && $parentId) {
        $ipsToAdd = [];

        if ($type === 'uuid') {
            // Buscar IPs asociadas a este UUID
            $stmt = $db->prepare("SELECT DISTINCT ip FROM player_ips WHERE player_id = (SELECT id FROM players WHERE uuid = :uuid LIMIT 1)");
            $stmt->execute(['uuid' => $validatedValue]);
            $ips = $stmt->fetchAll(PDO::FETCH_COLUMN);
            $ipsToAdd = $ips ?: [];
        } elseif ($type === 'nick') {
            // Buscar IPs asociadas a este nick
            $stmt = $db->prepare("SELECT DISTINCT ip FROM player_connections WHERE nick = :nick");
            $stmt->execute(['nick' => $validatedValue]);
            $ips = $stmt->fetchAll(PDO::FETCH_COLUMN);
            $ipsToAdd = $ips ?: [];
        }

        // Añadir cada IP a la blacklist con parent_id si no existe ya
        foreach ($ipsToAdd as $ip) {
            $check = $db->prepare("SELECT id FROM blacklist WHERE type = 'ip' AND value = :ip");
            $check->execute(['ip' => $ip]);
            if (!$check->fetch()) {
                $ipBanId = generateBanId();
                $stmt = $db->prepare("
                    INSERT INTO blacklist (ban_id, type, value, reason, added_by, expires_at, parent_id)
                    VALUES (:ban_id, 'ip', :ip, :reason, :added_by, :expires_at, :parent_id)
                ");
                $stmt->execute([
                    'ban_id' => $ipBanId,
                    'ip' => $ip,
                    'reason' => $reason,
                    'added_by' => $addedBy,
                    'expires_at' => $expiresAt,
                    'parent_id' => $parentId
                ]);
            }
        }
    }

    logActivity($db, 'blacklist', 'add', "{$type}: {$validatedValue}");
    incrementCacheVersion($db);

    echo json_encode(['success' => true]);
}

function handleRemoveBlacklist(PDO $db): void {
    $type = $_POST['type'] ?? '';
    $value = $_POST['value'] ?? '';

    $stmt = $db->prepare("UPDATE blacklist SET active = 0 WHERE type = :type AND value = :value");
    $stmt->execute(['type' => $type, 'value' => $value]);

    logActivity($db, 'blacklist', 'remove', "{$type}: {$value}");
    incrementCacheVersion($db);

    echo json_encode(['success' => true, 'affected' => $stmt->rowCount()]);
}

function handleGetSettings(PDO $db): void {
    $stmt = $db->prepare("SELECT `key`, value FROM settings");
    $stmt->execute();
    $settings = [];
    while ($row = $stmt->fetch()) {
        $settings[$row['key']] = $row['value'];
    }
    echo json_encode($settings);
}

function handlePollChanges(PDO $db): void {
    $lastVersion = isset($_POST['last_version']) ? (int)$_POST['last_version'] : -1;
    $maxWait = 25;
    $interval = 1;

    for ($i = 0; $i < $maxWait; $i += $interval) {
        $currentVersion = (int)getSetting($db, 'cache_version', '0');

        if ($lastVersion >= 0 && $currentVersion !== $lastVersion) {
            // Fetch recent activity logs to tell the plugin what changed
            $stmt = $db->prepare("SELECT id, type, action, details FROM activity_logs ORDER BY id DESC LIMIT 10");
            $stmt->execute();
            $recentActions = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode([
                'changed' => true,
                'cache_version' => $currentVersion,
                'recent_actions' => $recentActions
            ]);
            return;
        }

        if ($i + $interval < $maxWait) {
            sleep($interval);
        }
    }

    $currentVersion = (int)getSetting($db, 'cache_version', '0');
    $stmt = $db->prepare("SELECT id, type, action, details FROM activity_logs ORDER BY id DESC LIMIT 10");
    $stmt->execute();
    $recentActions = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['changed' => false, 'cache_version' => $currentVersion, 'recent_actions' => $recentActions]);
}

/**
 * Verifica si un jugador está en la whitelist de FurrPerms
 */
function handleCheckFurrPermsWhitelist(PDO $db): void {
    $nick = trim($_POST['nick'] ?? '');
    $uuid = trim($_POST['uuid'] ?? '');

    if (!$nick) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing nick']);
        return;
    }

    // Validar nick format
    if (!preg_match('/^[a-zA-Z0-9_]{1,16}$/', $nick)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid nickname']);
        return;
    }

    // Verificar si FurrPerms está habilitado
    $enabled = getSetting($db, 'fur_perms_enabled', '1') === '1';
    if (!$enabled) {
        // Si está deshabilitado, permitir todos
        echo json_encode(['allowed' => true]);
        return;
    }

    // Buscar en whitelist
    $stmt = $db->prepare("SELECT active FROM fur_perms_whitelist WHERE nick = :nick AND active = 1");
    $stmt->execute(['nick' => $nick]);
    $entry = $stmt->fetch();

    $allowed = $entry !== false;

    echo json_encode(['allowed' => $allowed]);
}

/**
 * Registra la ejecución de un comando en los logs de FurrPerms
 */
function handleLogFurrPermsCommand(PDO $db): void {
    $playerUuid = trim($_POST['player_uuid'] ?? '');
    $playerNick = trim($_POST['player_nick'] ?? '');
    $command = trim($_POST['command'] ?? '');
    $serverName = trim($_POST['server_name'] ?? 'unknown');
    $allowed = isset($_POST['allowed']) ? (int)$_POST['allowed'] : 1;
    $reason = trim($_POST['reason'] ?? '');
    $ipAddress = trim($_POST['ip_address'] ?? '');

    if (!$playerNick || !$command) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required fields']);
        return;
    }

    // Validar formato de nick
    if (!preg_match('/^[a-zA-Z0-9_]{1,16}$/', $playerNick)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid nickname format']);
        return;
    }

    // Validar formato de UUID si se proporciona
    if ($playerUuid && !preg_match('/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i', $playerUuid)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid UUID format']);
        return;
    }

    // Validar formato de IP si se proporciona
    if ($ipAddress && !filter_var($ipAddress, FILTER_VALIDATE_IP)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid IP address format']);
        return;
    }

    // Sanitizar comando: solo permitir caracteres seguros (alfanuméricos, espacios, guiones, puntos, dos puntos, barra)
    // Previene inyección de caracteres maliciosos en logs
    $command = preg_replace('/[^\p{L}\p{N}\s\-_.:\/\\\\]/u', '', $command);
    $command = substr($command, 0, 255);

    // Sanitizar server_name: solo alfanuméricos, guiones y guiones bajos
    $serverName = preg_replace('/[^a-zA-Z0-9_\-]/', '', $serverName);
    $serverName = substr($serverName, 0, 100);

    // Sanitizar reason: remover caracteres de control y limitar longitud
    $reason = preg_replace('/[\x00-\x1F\x7F]/', '', $reason);
    $reason = substr($reason, 0, 500);

    // Verificar si se debe registrar según configuración
    $logAllowed = getSetting($db, 'fur_perms_log_allowed', '1') === '1';
    $logBlocked = getSetting($db, 'fur_perms_log_blocked', '1') === '1';

    if ($allowed && !$logAllowed) {
        echo json_encode(['success' => true]);
        return;
    }
    if (!$allowed && !$logBlocked) {
        echo json_encode(['success' => true]);
        return;
    }

    $stmt = $db->prepare("
        INSERT INTO fur_perms_command_logs
        (player_uuid, player_nick, command, server_name, allowed, reason, ip_address)
        VALUES (:uuid, :nick, :command, :server, :allowed, :reason, :ip)
    ");
    $stmt->execute([
        'uuid' => $playerUuid ?: null,
        'nick' => $playerNick,
        'command' => $command,
        'server' => $serverName ?: 'unknown',
        'allowed' => $allowed,
        'reason' => $reason ?: null,
        'ip' => $ipAddress ?: null
    ]);

    echo json_encode(['success' => true]);
}