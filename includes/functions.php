<?php
/**
 * FurrGuard - Helper Functions
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

function checkIpApi(string $ip, ?PDO $db = null, int $cacheTtl = 86400): ?array {
    $cacheKey = "ip_api_{$ip}";

    // Try to get from cache if DB connection provided
    if ($db) {
        try {
            $stmt = $db->prepare("
                SELECT data, status, hit_count
                FROM ip_cache
                WHERE ip = ? AND expires_at > NOW()
                LIMIT 1
                FOR UPDATE
            ");
            $stmt->execute([$ip]);
            $cached = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($cached && $cached['status'] === 'success') {
                // Update hit count asynchronously (don't wait for it)
                $db->prepare("UPDATE ip_cache SET hit_count = hit_count + 1 WHERE ip = ?")->execute([$ip]);
                return json_decode($cached['data'], true);
            }
        } catch (PDOException $e) {
            // Cache table might not exist, continue to API call
            error_log("IP Cache error: " . $e->getMessage());
        }
    }

    $url = "http://ip-api.com/json/{$ip}?fields=status,message,continent,continentCode,country,countryCode,region,regionName,city,district,zip,lat,lon,timezone,offset,currency,isp,org,as,asname,reverse,mobile,proxy,hosting,query";

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 5,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_USERAGENT => 'FurrGuard/1.0',
        CURLOPT_DNS_CACHE_TIMEOUT => 120
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$response) {
        // Cache failures for 5 minutes to avoid repeated failed requests
        if ($db) {
            try {
                $db->prepare("
                    INSERT INTO ip_cache (ip, data, status, expires_at)
                    VALUES (?, ?, 'fail', DATE_ADD(NOW(), INTERVAL 5 MINUTE))
                    ON DUPLICATE KEY UPDATE status = 'fail', expires_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE)
                ")->execute([$ip, 'null']);
            } catch (PDOException $e) {
                // Ignore cache errors
            }
        }

        // Check if we should fail open or closed
        if ($db) {
            $failOpen = getSetting($db, 'ip_api_fail_open', '0') === '1';

            if (!$failOpen) {
                // Fail closed - log and return null (caller should deny connection)
                error_log("IP API unavailable for $ip - failing closed (deny connection)");
            } else {
                error_log("IP API unavailable for $ip - failing open (allow connection)");
            }
        }

        return null;
    }

    $data = json_decode($response, true);

    if ($data['status'] === 'success') {
        // Cache successful response
        if ($db) {
            try {
                $db->prepare("
                    INSERT INTO ip_cache (ip, data, status, expires_at)
                    VALUES (?, ?, 'success', DATE_ADD(NOW(), INTERVAL ? SECOND))
                    ON DUPLICATE KEY UPDATE data = ?, status = 'success', expires_at = DATE_ADD(NOW(), INTERVAL ? SECOND)
                ")->execute([$ip, json_encode($data), $cacheTtl, json_encode($data), $cacheTtl]);
            } catch (PDOException $e) {
                // Ignore cache errors
            }
        }
        return $data;
    }

    return null;
}

/**
 * Normaliza un UUID al formato estándar con dashes (8-4-4-12).
 * Ejemplo: "7aaa768d415a4f7dbacbc1d2a8add707" -> "7aaa768d-415a-4f7d-bacb-c1d2a8add707"
 *
 * @param string|null $uuid UUID a normalizar (con o sin guiones)
 * @return string|null UUID normalizado con dashes
 */
function normalizeUuid(?string $uuid): ?string
{
    if ($uuid === null || $uuid === '') {
        return null;
    }
    // Eliminar cualquier non-hex characters and convert to lowercase
    $cleanUuid = preg_replace('/[^a-f0-9]/', '', strtolower($uuid));

    // Add dashes if no dashes present (format: 8-4-4-12)
    if (strlen($cleanUuid) === 32) {
        return substr($cleanUuid, 0, 8) . '-' .
               substr($cleanUuid, 8, 4) . '-' .
               substr($cleanUuid, 12, 4) . '-' .
               substr($cleanUuid, 16, 4) . '-' .
               substr($cleanUuid, 20, 12);
    }

    // If already has the format correcto, devolverlo in lowercase
    return strtolower($cleanUuid);
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
    $profile = lookupMinecraftProfile($nick);
    if ($profile['is_premium'] && $profile['uuid']) {
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
        if (!empty($uuidPlaceholders)) {
            $conditions[] = '(' . implode(' OR ', $uuidPlaceholders) . ')';
        }
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

function getSetting(PDO $db, string $key, $default = null) {
    $stmt = $db->prepare("SELECT value FROM settings WHERE `key` = :key");
    $stmt->execute(['key' => $key]);
    $result = $stmt->fetch();
    return $result ? $result['value'] : $default;
}

function setSetting(PDO $db, string $key, string $value): void {
    $stmt = $db->prepare("
        INSERT INTO settings (`key`, value) VALUES (:key, :value)
        ON DUPLICATE KEY UPDATE value = :value_upd
    ");
    $stmt->execute(['key' => $key, 'value' => $value, 'value_upd' => $value]);
}

function incrementCacheVersion(PDO $db): void {
    $current = (int)getSetting($db, 'cache_version', '0');
    setSetting($db, 'cache_version', (string)($current + 1));
}

function isCountryBlocked(PDO $db, ?string $countryCode): ?array {
    if (!$countryCode) return null;

    $stmt = $db->prepare("SELECT * FROM blocked_countries WHERE country_code = ? AND active = 1 LIMIT 1");
    $stmt->execute([strtoupper($countryCode)]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    return $result ?: null;
}

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

function logActivity(PDO $db, string $type, string $action, ?string $details = null, ?string $ip = null): void {
    $stmt = $db->prepare("
        INSERT INTO activity_logs (type, action, details, ip_address)
        VALUES (:type, :action, :details, :ip)
    ");
    $stmt->execute([
        'type' => $type,
        'action' => $action,
        'details' => $details,
        'ip' => $ip ?? ($_SERVER['REMOTE_ADDR'] ?? null)
    ]);
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
 * Obtiene el nombre de Minecraft asociado a una UUID usando la API de Minecraft
 * Con cache en base de datos para evitar llamadas repetidas
 */
function getMinecraftUsername(?PDO $db, string $uuid): ?string {
    if (!$db || !$uuid) {
        return null;
    }

    // Validar formato de UUID (sin guiones o con guiones)
    $cleanUuid = preg_replace('/[^a-f0-9]/i', '', $uuid);
    if (strlen($cleanUuid) !== 32) {
        return null;
    }

    // Formatear UUID con guiones para la API
    $formattedUuid = substr($cleanUuid, 0, 8) . '-' .
                     substr($cleanUuid, 8, 4) . '-' .
                     substr($cleanUuid, 12, 4) . '-' .
                     substr($cleanUuid, 16, 4) . '-' .
                     substr($cleanUuid, 20, 12);

    // Verificar cache en base de datos (incluso si expiró, usarlo como fallback)
    $cachedUsername = null;
    try {
        $stmt = $db->prepare("
            SELECT username, expires_at
            FROM minecraft_names_cache
            WHERE uuid = ?
            LIMIT 1
        ");
        $stmt->execute([$formattedUuid]);
        $cached = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($cached && $cached['username']) {
            // Si el cache aún es válido, retornarlo directamente
            if ($cached['expires_at'] && strtotime($cached['expires_at']) > time()) {
                return $cached['username'];
            }
            // Cache expirado pero lo guardamos como fallback
            $cachedUsername = $cached['username'];
        }
    } catch (PDOException $e) {
        // La tabla podría no existir, continuar con la llamada a la API
        error_log("Minecraft name cache error: " . $e->getMessage());
    }

    // Llamar a la API de Minecraft
    $url = "https://api.minecraftservices.com/minecraft/profile/lookup/" . $formattedUuid;

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 5,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_USERAGENT => 'FurrGuard/1.0',
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_FOLLOWLOCATION => true
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        error_log("Minecraft API curl error: " . $curlError);
        // Si falla la API, devolver el cache expirado si existe
        return $cachedUsername;
    }

    if ($httpCode === 200 && $response) {
        $data = json_decode($response, true);

        if (isset($data['name']) && !empty($data['name'])) {
            $username = $data['name'];

            // Guardar en cache (7 días de TTL)
            try {
                $stmt = $db->prepare("
                    INSERT INTO minecraft_names_cache (uuid, username, expires_at)
                    VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))
                    ON DUPLICATE KEY UPDATE username = ?, expires_at = DATE_ADD(NOW(), INTERVAL 7 DAY)
                ");
                $stmt->execute([$formattedUuid, $username, $username]);
            } catch (PDOException $e) {
                // Error al guardar en cache, no es crítico
                error_log("Failed to cache Minecraft name: " . $e->getMessage());
            }

            return $username;
        }
    }

    // Si la API devuelve 204, 404 u otro error, usar cache expirado si existe
    if ($cachedUsername) {
        return $cachedUsername;
    }

    return null;
}

/**
 * Obtiene nombres de Minecraft para múltiples UUIDs en batch
 * Más eficiente que llamar a getMinecraftUsername individualmente
 */
function getMinecraftUsernamesBatch(?PDO $db, array $entries): array {
    if (!$db || empty($entries)) {
        return [];
    }

    $result = [];
    $uuidsToFetch = [];

    // Primero, verificar cache y procesar entradas
    foreach ($entries as $entry) {
        if (isset($entry['type']) && $entry['type'] === 'uuid' && !empty($entry['value'])) {
            $uuid = $entry['value'];
            $cleanUuid = preg_replace('/[^a-f0-9]/i', '', $uuid);

            if (strlen($cleanUuid) === 32) {
                $formattedUuid = substr($cleanUuid, 0, 8) . '-' .
                                 substr($cleanUuid, 8, 4) . '-' .
                                 substr($cleanUuid, 12, 4) . '-' .
                                 substr($cleanUuid, 16, 4) . '-' .
                                 substr($cleanUuid, 20, 12);

                // Verificar cache
                try {
                    $stmt = $db->prepare("
                        SELECT username, expires_at
                        FROM minecraft_names_cache
                        WHERE uuid = ? AND expires_at > NOW()
                        LIMIT 1
                    ");
                    $stmt->execute([$formattedUuid]);
                    $cached = $stmt->fetch(PDO::FETCH_ASSOC);

                    if ($cached && $cached['username']) {
                        $result[$uuid] = $cached['username'];
                    } else {
                        $uuidsToFetch[$uuid] = $formattedUuid;
                    }
                } catch (PDOException $e) {
                    $uuidsToFetch[$uuid] = $formattedUuid;
                }
            }
        }
    }

    // Fetch usernames from API (individual requests - Minecraft API doesn't support batch)
    foreach ($uuidsToFetch as $originalUuid => $formattedUuid) {
        $username = getMinecraftUsername($db, $originalUuid);
        if ($username) {
            $result[$originalUuid] = $username;
        }
    }

    return $result;
}
/**
 * Consulta la API de Mojang para verificar si un nombre de jugador es premium
 * Retorna: ['is_premium' => bool, 'uuid' => string|null, 'name' => string|null, 'error' => string|null]
 *
 * @param string $playerName Nombre del jugador a verificar
 * @return array Resultado de la consulta
 */
function lookupMinecraftProfile(string $playerName): array {
    if (empty($playerName)) {
        return ['is_premium' => false, 'uuid' => null, 'name' => null, 'error' => 'Nombre vacío'];
    }

    // Validar formato de nombre de Minecraft (1-16 caracteres, alfanuméricos y guión bajo)
    if (!preg_match('/^[a-zA-Z0-9_]{1,16}$/', $playerName)) {
        return ['is_premium' => false, 'uuid' => null, 'name' => null, 'error' => 'Formato de nombre inválido'];
    }

    $url = "https://api.mojang.com/minecraft/profile/lookup/name/" . urlencode($playerName);

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_USERAGENT => 'FurrGuard/1.0',
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_FOLLOWLOCATION => true
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    // Error de conexión
    if ($curlError) {
        error_log("Mojang API curl error for $playerName: " . $curlError);
        return ['is_premium' => false, 'uuid' => null, 'name' => null, 'error' => 'Error de conexión: ' . $curlError];
    }

    // HTTP 200 = jugador premium encontrado
    if ($httpCode === 200 && $response) {
        $data = json_decode($response, true);

        if (isset($data['id']) && isset($data['name'])) {
            // Formatear UUID con guiones si no los tiene
            $uuid = $data['id'];
            if (strlen($uuid) === 32) {
                $uuid = substr($uuid, 0, 8) . '-' .
                        substr($uuid, 8, 4) . '-' .
                        substr($uuid, 12, 4) . '-' .
                        substr($uuid, 16, 4) . '-' .
                        substr($uuid, 20, 12);
            }

            return [
                'is_premium' => true,
                'uuid' => $uuid,
                'name' => $data['name'],
                'error' => null
            ];
        }
    }

    // HTTP 404 o 204 = jugador no encontrado (no premium)
    if ($httpCode === 404 || $httpCode === 204) {
        return [
            'is_premium' => false,
            'uuid' => null,
            'name' => $playerName,
            'error' => null
        ];
    }

    // Otros errores
    return [
        'is_premium' => false,
        'uuid' => null,
        'name' => $playerName,
        'error' => "HTTP {$httpCode}"
    ];
}

/**
 * Obtiene el historial de nombres de un jugador desde múltiples fuentes
 * Combina datos de Laby.net API y NameMC (similar al sistema de liforra/namehistory)
 *
 * @param string $playerName Nombre del jugador
 * @return array Resultado con 'success', 'data' (history array) y 'error'
 */
function getPlayerNameHistory(string $playerName): array {
    if (empty($playerName)) {
        return ['success' => false, 'data' => null, 'error' => 'Nombre vacío'];
    }

    // Validar formato de nombre de Minecraft
    if (!preg_match('/^[a-zA-Z0-9_]{1,16}$/', $playerName)) {
        return ['success' => false, 'data' => null, 'error' => 'Formato de nombre inválido'];
    }

    // Paso 1: Obtener UUID desde Mojang
    $mojangProfile = lookupMinecraftProfile($playerName);
    $uuid = $mojangProfile['uuid'] ?? null;
    $currentName = $mojangProfile['name'] ?? $playerName;

    // Paso 2: Obtener datos de múltiples fuentes
    $allRows = [];

    // Intentar con Laby.net API (requiere UUID)
    if ($uuid) {
        $labyRows = fetchLabyNameHistory($uuid);
        $allRows = array_merge($allRows, $labyRows);
    }

    // Intentar con NameMC (scraping)
    $namemcRows = fetchNameMCNameHistory($currentName);
    $allRows = array_merge($allRows, $namemcRows);

    // Paso 3: Combinar y mergear los datos
    if (empty($allRows)) {
        // Si no hay datos externos, al menos mostrar el nombre actual
        return [
            'success' => true,
            'data' => [
                'history' => [['name' => $currentName, 'changed_at' => null]],
                'uuid' => $uuid,
                'query' => $playerName,
                'last_seen_at' => null,
                'source' => 'fallback'
            ],
            'error' => null
        ];
    }

    // Merge inteligente de los datos
    $mergedHistory = mergeNameHistorySources($allRows, $currentName);

    return [
        'success' => true,
        'data' => [
            'history' => $mergedHistory,
            'uuid' => $uuid,
            'query' => $playerName,
            'last_seen_at' => null,
            'source' => 'multi'
        ],
        'error' => null
    ];
}

/**
 * Obtiene historial de nombres desde Laby.net API
 */
function fetchLabyNameHistory(string $uuid): array {
    // Laby.net requiere UUID sin guiones
    $cleanUuid = str_replace('-', '', $uuid);
    $url = "https://laby.net/api/user/{$cleanUuid}/get-names";

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_FOLLOWLOCATION => true
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$response) {
        return [];
    }

    $data = json_decode($response, true);
    if (!is_array($data)) {
        return [];
    }

    $rows = [];
    foreach ($data as $entry) {
        if (isset($entry['name'])) {
            $rows[] = [
                'name' => $entry['name'],
                'changed_at' => $entry['changed_at'] ?? null,
                'source' => 'laby'
            ];
        }
    }

    return $rows;
}

/**
 * Obtiene historial de nombres desde NameMC (scraping)
 */
function fetchNameMCNameHistory(string $username): array {
    $url = "https://namemc.com/profile/{$username}";

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        CURLOPT_HTTPHEADER => [
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language: en-US,en;q=0.5'
        ],
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_ENCODING => 'gzip, deflate'
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$response) {
        return [];
    }

    $rows = [];

    // Buscar tabla de historial de nombres
    // NameMC usa tablas con clase table-borderless o table-striped
    if (preg_match('/<table[^>]*class="[^"]*table-borderless[^"]*"[^>]*>(.*?)<\/table>/is', $response, $tableMatch) ||
        preg_match('/<table[^>]*class="[^"]*table-striped[^"]*"[^>]*>(.*?)<\/table>/is', $response, $tableMatch)) {

        $tableContent = $tableMatch[1];

        // Extraer filas
        if (preg_match('/<tbody>(.*?)<\/tbody>/is', $tableContent, $tbodyMatch)) {
            $tableContent = $tbodyMatch[1];
        }

        // Buscar cada fila
        preg_match_all('/<tr[^>]*>(.*?)<\/tr>/is', $tableContent, $rowMatches);

        foreach ($rowMatches[1] as $rowContent) {
            // Extraer nombre del link /search?q=NAME
            $name = null;
            if (preg_match('/<a[^>]*href="\/search\?q=([^"]+)"[^>]*>(.*?)<\/a>/is', $rowContent, $nameMatch)) {
                $name = trim(strip_tags($nameMatch[2]));
            }

            // Extraer timestamp del elemento <time>
            $changedAt = null;
            if (preg_match('/<time[^>]*datetime="([^"]+)"[^>]*>/i', $rowContent, $timeMatch)) {
                $changedAt = trim($timeMatch[1]);
            }

            if ($name) {
                $rows[] = [
                    'name' => $name,
                    'changed_at' => $changedAt,
                    'source' => 'namemc'
                ];
            }
        }
    }

    return $rows;
}

/**
 * Combina y mergea inteligentemente los datos de múltiples fuentes
 */
function mergeNameHistorySources(array $rows, string $currentName): array {
    // Paso 1: Normalizar timestamps
    $normalized = [];
    foreach ($rows as $row) {
        $name = $row['name'] ?? null;
        $changedAt = $row['changed_at'] ?? null;

        if (!$name) continue;

        // Normalizar timestamp a formato ISO
        $normalizedTs = null;
        if ($changedAt) {
            try {
                $dt = new DateTime($changedAt);
                $normalizedTs = $dt->format('c');
            } catch (Exception $e) {
                $normalizedTs = null;
            }
        }

        $normalized[] = [
            'name' => $name,
            'changed_at' => $normalizedTs,
            'timestamp' => $normalizedTs ? strtotime($normalizedTs) : 0
        ];
    }

    // Paso 2: Agrupar por nombre (case-insensitive)
    $byName = [];
    foreach ($normalized as $entry) {
        $key = strtolower($entry['name']);
        if (!isset($byName[$key])) {
            $byName[$key] = [];
        }
        $byName[$key][] = $entry;
    }

    // Paso 3: Si un nombre tiene tanto null como timestamp, descartar el null
    $cleaned = [];
    foreach ($byName as $entries) {
        $hasNull = false;
        $hasTimestamp = false;
        foreach ($entries as $e) {
            if ($e['changed_at'] === null) $hasNull = true;
            else $hasTimestamp = true;
        }

        if ($hasNull && $hasTimestamp) {
            // Solo mantener los que tienen timestamp
            foreach ($entries as $e) {
                if ($e['changed_at'] !== null) {
                    $cleaned[] = $e;
                }
            }
        } else {
            $cleaned = array_merge($cleaned, $entries);
        }
    }

    // Paso 4: Ordenar cronológicamente (null primero, luego por fecha)
    usort($cleaned, function($a, $b) {
        if ($a['changed_at'] === null && $b['changed_at'] === null) return 0;
        if ($a['changed_at'] === null) return -1;
        if ($b['changed_at'] === null) return 1;
        return $a['timestamp'] - $b['timestamp'];
    });

    // Paso 5: Eliminar duplicados consecutivos (mismo nombre seguido)
    $merged = [];
    foreach ($cleaned as $entry) {
        $name = $entry['name'];
        $lastKey = empty($merged) ? null : strtolower(end($merged)['name']);

        if (strtolower($name) !== $lastKey) {
            $merged[] = [
                'name' => $name,
                'changed_at' => $entry['changed_at']
            ];
        }
    }

    // Paso 6: Asegurar que el nombre actual está en la lista
    if (!empty($merged)) {
        $lastEntry = end($merged);
        if (strtolower($lastEntry['name']) !== strtolower($currentName)) {
            $merged[] = ['name' => $currentName, 'changed_at' => null];
        }
    } else {
        $merged[] = ['name' => $currentName, 'changed_at' => null];
    }

    return $merged;
}
