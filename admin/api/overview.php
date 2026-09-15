<?php

declare(strict_types=1);

/**
 * FurrGuard - panel: resumen (get_overview).
 */

if (!defined('FURRGUARD_ROOT')) {
    http_response_code(404);
    exit;
}

/**
 * @param array<string, mixed> $in
 * @param AdminUser $user
 * @return array<string, mixed>
 */
function adminGetOverview(PDO $db, array $in, array $user): array
{
    $count = static fn (string $sql): int => (int) $db->query($sql)->fetchColumn();
    $canSeeIps = adminCanSeeIps($user);
    $connections = $db->query(
        'SELECT id, uuid, nick, ip, country, country_code, blocked, block_reason, created_at FROM player_connections ORDER BY id DESC LIMIT 10'
    )->fetchAll();
    // Sin consultas remotas: el resumen también sirve de sondeo de estado y no debe esperar a Mojang.
    $blocks = adminWithMinecraftNames($db, $db->query(
        'SELECT id, ban_id, type, value, reason, created_at FROM blacklist WHERE parent_id IS NULL ORDER BY created_at DESC, id DESC LIMIT 10'
    )->fetchAll(), 0);

    return [
        'online_players' => $count('SELECT COUNT(*) FROM players WHERE is_online = 1'),
        'total_players' => $count('SELECT COUNT(*) FROM players'),
        'connections_24h' => $count('SELECT COUNT(*) FROM player_connections WHERE created_at >= NOW() - INTERVAL 24 HOUR'),
        'blocked_24h' => $count('SELECT COUNT(*) FROM player_connections WHERE blocked = 1 AND created_at >= NOW() - INTERVAL 24 HOUR'),
        'recent_connections' => $canSeeIps ? $connections : adminHideIps($connections, ['ip']),
        'recent_blocks' => $blocks,
        'counts' => [
            'whitelist' => $count('SELECT COUNT(*) FROM whitelist'),
            'blacklist' => $count('SELECT COUNT(*) FROM blacklist WHERE ' . banInForceSql()),
            'providers' => $count('SELECT COUNT(*) FROM blocked_providers WHERE active = 1'),
            'countries' => $count('SELECT COUNT(*) FROM blocked_countries WHERE active = 1'),
            'continents' => $count('SELECT COUNT(*) FROM blocked_continents WHERE active = 1'),
        ],
        'health' => ['api_key_configured' => apiKeyConfigured($db)] + geoHealth($db),
        'ip_hidden' => !$canSeeIps,
    ];
}
