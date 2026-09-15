<?php

declare(strict_types=1);

/**
 * FurrGuard - Helper Functions (dominio: listas, conexiones, detección de cuenta comprometida).
 *
 * Las funciones de plataforma viven en includes/{identity,settings,audit,geo,minecraft}.php.
 *
 * @author GrinchHorizon
 * @copyright SrTeb Limited
 * @website https://srteb.eu
 */

function generateBanId(): string {
    $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    $id = '';
    for ($i = 0; $i < 12; $i++) {
        $id .= $chars[random_int(0, strlen($chars) - 1)];
    }
    return $id;
}

/**
 * Check if a player is whitelisted (bypass all checks)
 */
function isPlayerWhitelisted(PDO $db, ?string $uuid, string $nick, string $ip, ?string $asn): bool {
    $conditions = [
        "(type = 'nick' AND LOWER(value) = LOWER(:nick))",
        "(type = 'ip' AND value = :ip)"
    ];
    $params = ['nick' => $nick, 'ip' => $ip];

    // Normalizar UUID para comparación consistente
    $normalizedUuid = normalizeUuid($uuid);
    if ($normalizedUuid) {
        $conditions[] = "(type = 'uuid' AND value = :uuid)";
        $params['uuid'] = $normalizedUuid;
    }

    if ($asn) {
        $conditions[] = "(type = 'as' AND value = :asn)";
        $params['asn'] = $asn;
    }

    $sql = "SELECT id FROM whitelist WHERE " . implode(' OR ', $conditions) . " LIMIT 1";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetch() !== false;
}

/**
 * Check if a player is blacklisted
 *
 * @return array<string, mixed>|null
 */
function isPlayerBlacklisted(PDO $db, ?string $uuid, string $nick, string $ip, ?string $asn): ?array {
    $conditions = [
        "(type = 'nick' AND LOWER(value) = LOWER(:nick))",
        "(type = 'ip' AND value = :ip)"
    ];
    $params = ['nick' => $nick, 'ip' => $ip];

    // Recolectar todos los UUIDs a verificar (normalizados)
    $uuidsToCheck = [];

    // Normalizar UUID del plugin si existe
    if ($uuid) {
        $uuidsToCheck[] = normalizeUuid($uuid);
    }

    // Intentar resolver UUID desde la BD por nick (para offline mode)
    $stmtUuid = $db->prepare("SELECT uuid FROM players WHERE last_nick = :nick1 OR first_nick = :nick2 LIMIT 1");
    $stmtUuid->execute(['nick1' => $nick, 'nick2' => $nick]);
    $foundPlayer = $stmtUuid->fetch();
    if ($foundPlayer && !empty($foundPlayer['uuid'])) {
        $normalized = normalizeUuid($foundPlayer['uuid']);
        if ($normalized && !in_array($normalized, $uuidsToCheck)) {
            $uuidsToCheck[] = $normalized;
        }
    }

    // También verificar con el UUID de Mojang si el jugador es premium
    // Esto es crítico para que las blacklists por UUID funcionen correctamente
    $profile = minecraftProfileByName($db, $nick);
    if ($profile['status'] === 'premium' && $profile['uuid']) {
        $normalized = normalizeUuid($profile['uuid']);
        if ($normalized && !in_array($normalized, $uuidsToCheck)) {
            $uuidsToCheck[] = $normalized;
        }
    }

    // Agregar condición para todos los UUIDs encontrados
    if (!empty($uuidsToCheck)) {
        $uuidPlaceholders = [];
        foreach ($uuidsToCheck as $i => $uuidValue) {
            $paramName = "uuid_$i";
            $uuidPlaceholders[] = "(type = 'uuid' AND value = :$paramName)";
            $params[$paramName] = $uuidValue;
        }
        $conditions[] = '(' . implode(' OR ', $uuidPlaceholders) . ')';
    }

    if ($asn) {
        $conditions[] = "(type = 'as' AND value = :asn)";
        $params['asn'] = $asn;
    }

    // Prioridad: uuid > nick > as > ip (para que el ban de jugador tenga prioridad sobre el de IP)
    $sql = "SELECT * FROM blacklist WHERE active = 1 AND (expires_at IS NULL OR expires_at > NOW()) AND (" . implode(' OR ', $conditions) . ") ORDER BY
        CASE type
            WHEN 'uuid' THEN 1
            WHEN 'nick' THEN 2
            WHEN 'as' THEN 3
            WHEN 'ip' THEN 4
            ELSE 5
        END ASC,
        created_at DESC
    LIMIT 1";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetch() ?: null;
}

function isInBlockedProviders(PDO $db, ?string $isp, ?string $org, ?string $asname, string $type): bool {
    if (!$isp && !$org && !$asname) return false;

    $searchTerms = array_filter([$isp, $org, $asname]);
    if (empty($searchTerms)) return false;

    $placeholders = [];
    $params = ['type' => $type];

    foreach ($searchTerms as $i => $term) {
        $placeholders[] = "LOWER(:term{$i}) LIKE CONCAT('%', LOWER(pattern), '%')";
        $params["term{$i}"] = $term;
    }

    $sql = "SELECT id FROM blocked_providers WHERE type = :type AND active = 1 AND (" . implode(' OR ', $placeholders) . ") LIMIT 1";
    $stmt = $db->prepare($sql);
    $stmt->execute($params);

    return $stmt->fetch() !== false;
}

/**
 * @param array<string, mixed> $data
 */
function logPlayerConnection(PDO $db, array $data): int {
    $stmt = $db->prepare("
        INSERT INTO player_connections 
        (uuid, nick, ip, ip_version, country, country_code, region, city, isp, org, asn, asname, 
         is_proxy, is_vpn, is_hosting, is_mobile, latitude, longitude, timezone, game_version, 
         blocked, block_reason, raw_data)
        VALUES 
        (:uuid, :nick, :ip, :ip_version, :country, :country_code, :region, :city, :isp, :org, :asn, :asname,
         :is_proxy, :is_vpn, :is_hosting, :is_mobile, :latitude, :longitude, :timezone, :game_version,
         :blocked, :block_reason, :raw_data)
    ");

    $stmt->execute($data);
    return (int)$db->lastInsertId();
}

/**
 * @param array<string, mixed> $ipData
 */
function updatePlayerInfo(PDO $db, ?string $uuid, string $nick, string $ip, array $ipData): void {
    $player = null;

    if ($uuid) {
        $stmt = $db->prepare("SELECT id FROM players WHERE uuid = :uuid");
        $stmt->execute(['uuid' => $uuid]);
        $player = $stmt->fetch();
    }

    if (!$player && $nick) {
        $stmt = $db->prepare("SELECT id FROM players WHERE last_nick = :nick1 OR first_nick = :nick2 LIMIT 1");
        $stmt->execute(['nick1' => $nick, 'nick2' => $nick]);
        $player = $stmt->fetch();
    }

    if ($player) {
        $playerId = $player['id'];
        $stmt = $db->prepare("
            UPDATE players SET
                last_nick = :nick,
                last_ip = :ip,
                last_country = :country,
                last_country_code = :country_code,
                last_seen = NOW(),
                total_connections = total_connections + 1
            WHERE id = :id
        ");
        $stmt->execute([
            'nick' => $nick,
            'ip' => $ip,
            'country' => $ipData['country'] ?? null,
            'country_code' => $ipData['countryCode'] ?? null,
            'id' => $playerId
        ]);
    } else {
        if (!$uuid) {
            return;
        }
        $stmt = $db->prepare("
            INSERT INTO players (uuid, first_nick, last_nick, first_ip, last_ip, last_country, last_country_code)
            VALUES (:uuid, :first_nick, :last_nick, :first_ip, :last_ip, :country, :country_code)
        ");
        $stmt->execute([
            'uuid' => $uuid,
            'first_nick' => $nick,
            'last_nick' => $nick,
            'first_ip' => $ip,
            'last_ip' => $ip,
            'country' => $ipData['country'] ?? null,
            'country_code' => $ipData['countryCode'] ?? null
        ]);
        $playerId = (int)$db->lastInsertId();
    }

    $stmt = $db->prepare("SELECT id FROM player_nicks WHERE player_id = :player_id AND LOWER(nick) = LOWER(:nick)");
    $stmt->execute(['player_id' => $playerId, 'nick' => $nick]);
    if (!$stmt->fetch()) {
        $stmt = $db->prepare("INSERT INTO player_nicks (player_id, nick) VALUES (:player_id, :nick)");
        $stmt->execute(['player_id' => $playerId, 'nick' => $nick]);
    }

    $stmt = $db->prepare("SELECT id FROM player_ips WHERE player_id = :player_id AND ip = :ip");
    $stmt->execute(['player_id' => $playerId, 'ip' => $ip]);
    if (!$stmt->fetch()) {
        $stmt = $db->prepare("
            INSERT INTO player_ips (player_id, ip, country, country_code, isp, asn)
            VALUES (:player_id, :ip, :country, :country_code, :isp, :asn)
        ");
        $stmt->execute([
            'player_id' => $playerId,
            'ip' => $ip,
            'country' => $ipData['country'] ?? null,
            'country_code' => $ipData['countryCode'] ?? null,
            'isp' => $ipData['isp'] ?? null,
            'asn' => $ipData['as'] ?? null
        ]);
    }
}


/**
 * @return array<string, mixed>|null
 */
function isCountryBlocked(PDO $db, ?string $countryCode): ?array {
    if (!$countryCode) return null;

    $stmt = $db->prepare("SELECT * FROM blocked_countries WHERE country_code = ? AND active = 1 LIMIT 1");
    $stmt->execute([strtoupper($countryCode)]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    return $result ?: null;
}

/**
 * @return array<string, mixed>|null
 */
function isContinentBlocked(PDO $db, ?string $continentCode): ?array {
    if (!$continentCode) return null;

    $stmt = $db->prepare("SELECT * FROM blocked_continents WHERE continent_code = ? AND active = 1 LIMIT 1");
    $stmt->execute([strtoupper($continentCode)]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    return $result ?: null;
}

function getIpVersion(string $ip): string {
    return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6) ? 'ipv6' : 'ipv4';
}


function formatTimeAgo(string $datetime): string {
    $now = new DateTime();
    $ago = new DateTime($datetime);
    $diff = $now->diff($ago);

    if ($diff->y > 0) return $diff->y . ' año' . ($diff->y > 1 ? 's' : '');
    if ($diff->m > 0) return $diff->m . ' mes' . ($diff->m > 1 ? 'es' : '');
    if ($diff->d > 0) return $diff->d . ' día' . ($diff->d > 1 ? 's' : '');
    if ($diff->h > 0) return $diff->h . ' hora' . ($diff->h > 1 ? 's' : '');
    if ($diff->i > 0) return $diff->i . ' minuto' . ($diff->i > 1 ? 's' : '');
    return 'Hace un momento';
}

/**
 * Mapeo de continentes para códigos de país
 * Basado en estándar ISO 3166-1 alpha-2
 */
function getContinentForCountry(string $countryCode): string {
    $continents = [
        // Europa
        'EU' => ['AD', 'AL', 'AT', 'AX', 'BA', 'BE', 'BG', 'BY', 'CH', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FO', 'FR', 'GB', 'GG', 'GI', 'GR', 'HR', 'HU', 'IE', 'IM', 'IS', 'IT', 'JE', 'LI', 'LT', 'LU', 'LV', 'MC', 'MD', 'ME', 'MK', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'RS', 'RU', 'SE', 'SI', 'SJ', 'SK', 'SM', 'UA', 'VA'],
        // América del Norte
        'NA' => ['AG', 'AI', 'AS', 'BB', 'BM', 'BS', 'BZ', 'CA', 'CR', 'CU', 'DM', 'DO', 'GD', 'GL', 'GP', 'GT', 'HN', 'HT', 'JM', 'KN', 'KY', 'LC', 'MF', 'MQ', 'MS', 'MX', 'NI', 'PA', 'PM', 'PR', 'SV', 'TC', 'TT', 'US', 'VC', 'VG', 'VI'],
        // América del Sur
        'SA' => ['AR', 'BO', 'BR', 'CL', 'CO', 'EC', 'FK', 'GF', 'GY', 'PE', 'PY', 'SR', 'UY', 'VE'],
        // Asia
        'AS' => ['AE', 'AF', 'BD', 'BH', 'BN', 'BT', 'CN', 'CY', 'GE', 'HK', 'ID', 'IL', 'IN', 'IQ', 'IR', 'JO', 'JP', 'KG', 'KH', 'KP', 'KR', 'KW', 'KZ', 'LA', 'LB', 'LK', 'MM', 'MN', 'MO', 'MV', 'MY', 'NP', 'OM', 'PH', 'PK', 'PS', 'QA', 'SA', 'SG', 'SY', 'TH', 'TJ', 'TL', 'TM', 'TW', 'UZ', 'VN', 'YE'],
        // África
        'AF' => ['AO', 'BF', 'BI', 'BJ', 'BW', 'CD', 'CF', 'CG', 'CI', 'CM', 'CV', 'DJ', 'DZ', 'EG', 'EH', 'ER', 'ET', 'GA', 'GH', 'GM', 'GN', 'GQ', 'GW', 'KE', 'KM', 'LR', 'LS', 'LY', 'MA', 'MG', 'ML', 'MR', 'MU', 'MW', 'MZ', 'NA', 'NE', 'NG', 'RE', 'RW', 'SC', 'SD', 'SH', 'SL', 'SN', 'SO', 'ST', 'SZ', 'TD', 'TG', 'TN', 'TZ', 'UG', 'YT', 'ZA', 'ZM', 'ZW'],
        // Oceanía
        'OC' => ['AU', 'CC', 'CK', 'CX', 'FJ', 'FM', 'GU', 'KI', 'MH', 'MP', 'NC', 'NF', 'NR', 'NU', 'NZ', 'PF', 'PG', 'PN', 'PW', 'SB', 'TO', 'TV', 'UM', 'VU', 'WF', 'WS']
    ];

    $code = strtoupper($countryCode);
    foreach ($continents as $continent => $countries) {
        if (in_array($code, $countries, true)) {
            return $continent;
        }
    }
    return 'UNKNOWN';
}

/**
 * Detecta si hay un cambio drástico de país para un jugador
 * Retorna array con información del cambio o null si no hay cambio sospechoso
 *
 * @param PDO $db Conexión a la base de datos
 * @param string|null $uuid UUID del jugador
 * @param string $nick Nick del jugador
 * @param string $currentCountry Código de país actual (ISO 3166-1 alpha-2)
 * @return array<string, mixed>|null Información del cambio sospechoso o null
 */
function detectDrasticCountryChange(PDO $db, ?string $uuid, string $nick, string $currentCountry): ?array {
    // Verificar si la detección está habilitada
    $enabled = getSetting($db, 'country_change_detection_enabled', '1') === '1';
    if (!$enabled) {
        return null;
    }

    // Mínimo de conexiones previas para detectar patrón
    $minConnections = (int)getSetting($db, 'country_change_min_connections', '3');

    // Obtener historial de países del jugador
    $historicalCountries = [];
    $totalConnections = 0;

    // Buscar por UUID primero
    if ($uuid) {
        $stmt = $db->prepare("
            SELECT country_code, COUNT(*) as count
            FROM player_connections
            WHERE uuid = :uuid
              AND country_code IS NOT NULL
              AND country_code != ''
            GROUP BY country_code
            ORDER BY count DESC
        ");
        $stmt->execute(['uuid' => $uuid]);
        $historicalCountries = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

        // Obtener total de conexiones
        $stmtTotal = $db->prepare("SELECT COUNT(*) FROM player_connections WHERE uuid = :uuid");
        $stmtTotal->execute(['uuid' => $uuid]);
        $totalConnections = (int)$stmtTotal->fetchColumn();
    }

    // Si no hay datos por UUID, buscar por nick
    if (empty($historicalCountries) && $nick) {
        $stmt = $db->prepare("
            SELECT country_code, COUNT(*) as count
            FROM player_connections
            WHERE nick = :nick
              AND country_code IS NOT NULL
              AND country_code != ''
            GROUP BY country_code
            ORDER BY count DESC
        ");
        $stmt->execute(['nick' => $nick]);
        $historicalCountries = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

        // Obtener total de conexiones
        $stmtTotal = $db->prepare("SELECT COUNT(*) FROM player_connections WHERE nick = :nick");
        $stmtTotal->execute(['nick' => $nick]);
        $totalConnections = (int)$stmtTotal->fetchColumn();
    }

    // Si no hay suficientes conexiones previas, no aplicar detección
    if ($totalConnections < $minConnections || empty($historicalCountries)) {
        return null;
    }

    // Si el país actual ya está en el historial, no es sospechoso
    $currentCountryUpper = strtoupper($currentCountry);
    if (isset($historicalCountries[$currentCountryUpper])) {
        return null;
    }

    // Obtener el país más común del jugador
    $mostCommonCountry = (string) array_key_first($historicalCountries);
    $mostCommonCount = $historicalCountries[$mostCommonCountry];
    $mostCommonPercentage = ($mostCommonCount / $totalConnections) * 100;

    // Verificar si el país más común representa un porcentaje significativo
    $minPercentage = (float)getSetting($db, 'country_change_min_percentage', '70.0');
    if ($mostCommonPercentage < $minPercentage) {
        // El jugador se conecta desde múltiples países regularmente, no es sospechoso
        return null;
    }

    // Verificar cambio de continente (más sospechoso)
    $currentContinent = getContinentForCountry($currentCountryUpper);
    $historicalContinent = getContinentForCountry($mostCommonCountry);

    $isContinentChange = ($currentContinent !== $historicalContinent && $currentContinent !== 'UNKNOWN' && $historicalContinent !== 'UNKNOWN');

    // Si solo está activada la detección de cambio de continente
    $continentOnlyMode = getSetting($db, 'country_change_continent_only', '0') === '1';
    if ($continentOnlyMode && !$isContinentChange) {
        return null;
    }

    // Construir información del cambio
    return [
        'detected' => true,
        'current_country' => $currentCountryUpper,
        'current_continent' => $currentContinent,
        'historical_country' => $mostCommonCountry,
        'historical_continent' => $historicalContinent,
        'is_continent_change' => $isContinentChange,
        'historical_connections' => $totalConnections,
        'country_percentage' => round($mostCommonPercentage, 1),
        'all_countries' => $historicalCountries
    ];
}

/**
 * Aplica blacklist automática por cuenta comprometida
 *
 * @param PDO $db Conexión a la base de datos
 * @param string|null $uuid UUID del jugador
 * @param string $nick Nick del jugador
 * @param string $ip IP del jugador
 * @param array<string, mixed> $countryChangeInfo Información del cambio de país
 * @return bool True si se aplicó correctamente
 */
function applyCompromisedAccountBlacklist(PDO $db, ?string $uuid, string $nick, string $ip, array $countryChangeInfo): bool {
    $reason = 'Cuenta comprometida';

    // Agregar información adicional al reason
    $reason .= sprintf(
        ' (Cambio de país: %s -> %s)',
        $countryChangeInfo['historical_country'],
        $countryChangeInfo['current_country']
    );

    $addedBy = 'FurrGuard Auto-Detection';

    try {
        // Aplicar blacklist por UUID si está disponible
        if ($uuid) {
            $banId = generateBanId();
            $stmt = $db->prepare("
                INSERT INTO blacklist (ban_id, type, value, reason, added_by, active)
                VALUES (:ban_id, 'uuid', :value, :reason, :added_by, 1)
                ON DUPLICATE KEY UPDATE reason = :reason_upd, added_by = :added_by_upd, active = 1, updated_at = NOW()
            ");
            $stmt->execute([
                'ban_id' => $banId,
                'value' => normalizeUuid($uuid),
                'reason' => $reason,
                'added_by' => $addedBy,
                'reason_upd' => $reason,
                'added_by_upd' => $addedBy
            ]);
        }

        // Aplicar blacklist por nick
        $banIdNick = generateBanId();
        $stmt = $db->prepare("
            INSERT INTO blacklist (ban_id, type, value, reason, added_by, active)
            VALUES (:ban_id, 'nick', :value, :reason, :added_by, 1)
            ON DUPLICATE KEY UPDATE reason = :reason_upd, added_by = :added_by_upd, active = 1, updated_at = NOW()
        ");
        $stmt->execute([
            'ban_id' => $banIdNick,
            'value' => $nick,
            'reason' => $reason,
            'added_by' => $addedBy,
            'reason_upd' => $reason,
            'added_by_upd' => $addedBy
        ]);

        // Aplicar blacklist a la IP actual
        $banIdIp = generateBanId();
        $stmt = $db->prepare("
            INSERT INTO blacklist (ban_id, type, value, reason, added_by, active)
            VALUES (:ban_id, 'ip', :value, :reason, :added_by, 1)
            ON DUPLICATE KEY UPDATE reason = :reason_upd, added_by = :added_by_upd, active = 1, updated_at = NOW()
        ");
        $stmt->execute([
            'ban_id' => $banIdIp,
            'value' => $ip,
            'reason' => $reason,
            'added_by' => $addedBy,
            'reason_upd' => $reason,
            'added_by_upd' => $addedBy
        ]);

        // Registrar en activity logs
        logActivity($db, 'security', 'compromised_account', "Jugador: {$nick}, País histórico: {$countryChangeInfo['historical_country']}, País actual: {$countryChangeInfo['current_country']}");

        // Incrementar versión de cache para notificar al plugin
        incrementCacheVersion($db);

        return true;
    } catch (PDOException $e) {
        error_log("Error applying compromised account blacklist: " . $e->getMessage());
        return false;
    }
}
