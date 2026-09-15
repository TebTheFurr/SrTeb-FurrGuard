<?php

declare(strict_types=1);

namespace FurrGuard\Tests\Integration;

use HttpError;
use ValidationError;

/**
 * check_player / recheck_players / lookup_player (docs/API.md §1.3) y acciones de lista del plugin.
 */
final class CheckPlayerTest extends DomainTestCase
{
    private const RESIDENTIAL = ['country' => 'Spain', 'countryCode' => 'ES', 'continentCode' => 'EU', 'isp' => 'Telefonica de Espana', 'org' => 'Movistar', 'as' => 'AS3352 Telefonica', 'proxy' => false, 'hosting' => false, 'mobile' => false];

    protected function setUp(): void
    {
        parent::setUp();
        $this->db->exec('DELETE FROM blocked_providers');
        $this->db->exec("INSERT INTO blocked_providers (id, name, pattern, type) VALUES
            (1, 'Amazon Web Services', 'aws', 'hosting'), (2, 'NordVPN', 'nordvpn', 'vpn'), (3, 'Soax', 'soax', 'proxy')");
    }

    protected function tearDown(): void
    {
        // Otros tests cuentan con los proveedores sembrados por la migración.
        $this->db->exec('DELETE FROM blocked_providers');
        $rows = loadProvidersTsv();
        foreach (array_chunk($rows, 500) as $chunk) {
            $this->db->prepare('INSERT IGNORE INTO blocked_providers (name, pattern, type) VALUES ' . implode(',', array_fill(0, count($chunk), '(?, ?, ?)')))
                ->execute(array_merge(...$chunk));
        }
        parent::tearDown();
    }

    public function testBlacklistBeatsWhitelistAndTheEvasionIpBecomesAChild(): void
    {
        $this->ipApi['8.8.8.8'] = self::RESIDENTIAL;
        whitelistAdd($this->db, 'uuid', self::UUID, null, 'Admin');
        $ban = banAddManual($this->db, ['type' => 'nick', 'value' => 'Player'], 'toxicidad', 'Admin', 0, false);

        $result = checkPlayer($this->db, $this->player());
        self::assertFalse($result['allowed']);
        self::assertSame(['blacklisted', 'toxicidad', 'nick', $ban['ban_id'], 'Player', false], [$result['reason'], $result['block_reason'], $result['block_type'], $result['ban_id'], $result['blocked_name'], $result['degraded']]);
        self::assertStringContainsString('"ip_data":{"country":"Spain"', (string) json_encode($result));

        $child = $this->row("SELECT parent_id, reason, added_by FROM blacklist WHERE type = 'ip' AND value = '8.8.8.8'");
        self::assertSame($ban['id'], $child['parent_id']);
        self::assertStringContainsString('evasión', (string) $child['reason']);
        self::assertSame(1, $this->countRows('activity_logs', "type = 'security' AND details LIKE 'ip: 8.8.8.8%'"));
        self::assertSame(1, $this->countRows('player_connections', "blocked = 1 AND block_reason = 'blacklisted'"));
    }

    public function testWhitelistExemptsRulesButRulesApplyToEveryoneElse(): void
    {
        $proxy = ['proxy' => true, 'hosting' => true] + self::RESIDENTIAL;
        $this->ipApi['8.8.4.4'] = $proxy;
        $this->ipApi['1.1.1.1'] = $proxy;
        whitelistAdd($this->db, 'ip', '8.8.4.4', null, 'Admin');

        self::assertSame([true, 'whitelisted'], $this->decide($this->player(ip: '8.8.4.4')));
        self::assertSame([false, 'proxy_detected'], $this->decide($this->player(ip: '1.1.1.1')));
        $empty = checkPlayer($this->db, $this->player(uuid: null, nick: 'Nobody', ip: '10.1.2.3'));
        self::assertSame('{}', json_encode($empty['ip_data']), 'ip_data es siempre un objeto');
        self::assertSame(1, $this->countRows('players'), 'sin UUID no se crea ficha');
    }

    public function testRulesOrderProvidersByWholeWordAndCounters(): void
    {
        $this->settings(['block_mobile' => '1']);
        $this->db->exec("INSERT INTO blocked_countries (id, country_code, country_name) VALUES (7, 'RU', 'Rusia')");
        $this->db->exec("INSERT INTO blocked_continents (id, continent_code, continent_name) VALUES (9, 'AF', 'África')");
        $cases = [
            '2.2.2.2' => [['isp' => 'Lawson Networks'], true, 'allowed'],
            '3.3.3.3' => [['org' => 'Amazon AWS, Inc.'], false, 'blocked_provider'],
            '4.4.4.4' => [['isp' => 'NordVPN S.A.'], false, 'vpn_detected'],
            '5.5.5.5' => [['isp' => 'Soax proxies'], false, 'proxy_detected'],
            '6.6.6.6' => [['mobile' => true], false, 'mobile_detected'],
            '7.7.7.7' => [['countryCode' => 'RU'], false, 'blocked_country'],
            '9.9.9.9' => [['countryCode' => 'ZA', 'continentCode' => 'AF'], false, 'blocked_continent'],
        ];
        foreach ($cases as $ip => [$data, $allowed, $reason]) {
            $this->ipApi[$ip] = $data + self::RESIDENTIAL;
            self::assertSame([$allowed, $reason], $this->decide($this->player(ip: $ip)), $ip);
        }
        self::assertSame([1, 1], [(int) $this->row('SELECT block_count FROM blocked_providers WHERE id = 1')['block_count'], (int) $this->row('SELECT block_count FROM blocked_providers WHERE id = 2')['block_count']]);
        self::assertSame(1, (int) $this->row('SELECT block_count FROM blocked_countries WHERE id = 7')['block_count']);
        self::assertSame(1, (int) $this->row('SELECT block_count FROM blocked_continents WHERE id = 9')['block_count']);
        self::assertSame(1, $this->countRows('player_connections', "is_vpn = 1 AND ip = '4.4.4.4'"), 'is_vpn real');

        $this->settings(['block_vpn' => '0']);
        $this->db->exec('DELETE FROM player_connections');
        self::assertSame([true, 'allowed'], $this->decide($this->player(ip: '4.4.4.4')), 'sin block_vpn el proveedor vpn no bloquea');
    }

    public function testDegradedMaxmindAndIpApiUnavailable(): void
    {
        $this->maxmind['8.8.8.8'] = ['country' => 'Spain', 'countryCode' => 'ES', 'continentCode' => 'EU', 'as' => 'AS3352 Telefonica', 'org' => 'Telefonica'];
        $degraded = checkPlayer($this->db, $this->player());
        self::assertSame([true, 'allowed', true], [$degraded['allowed'], $degraded['reason'], $degraded['degraded']]);
        self::assertSame('ES', ((array) $degraded['ip_data'])['countryCode'] ?? null);

        upsertBan($this->db, ['type' => 'as', 'value' => 'AS3352', 'reason' => 'isp', 'added_by' => 'Admin'], 'manual');
        self::assertSame([false, 'blacklisted'], $this->decide($this->player(uuid: null, nick: 'Other')), 'AS del espejo MaxMind');

        self::assertSame([false, 'ip_api_unavailable'], $this->decide($this->player(ip: '4.4.4.4')), 'sin ningún dato y fail_open=0');
        $this->settings(['ip_api_fail_open' => '1']);
        self::assertSame([true, 'allowed'], $this->decide($this->player(ip: '4.4.4.4')));
        $this->settings(['ip_api_fail_open' => '0']);
        self::assertSame([true, 'allowed'], $this->decide($this->player(ip: '192.168.1.5')), 'una IP privada nunca tiene datos: no es ip_api_unavailable');
    }

    public function testRecheckHasNoSideEffects(): void
    {
        for ($i = 0; $i < 4; $i++) {
            logPlayerConnection($this->db, $this->player(), self::RESIDENTIAL, false, null);
        }
        geoCacheWrite($this->db, '5.5.5.5', 'success', ['countryCode' => 'RU', 'isp' => 'NordVPN'] + self::RESIDENTIAL, 3600);
        banAddManual($this->db, ['type' => 'nick', 'value' => 'Banned'], 'x', 'Admin', 0, false);
        $before = [$this->countRows('player_connections'), $this->countRows('activity_logs'), $this->countRows('blacklist'), $this->countRows('ip_api_logs'), $this->countRows('minecraft_profiles')];

        $results = recheckPlayers($this->db, [
            ['uuid' => self::UUID, 'nick' => 'Player', 'ip' => '5.5.5.5'],
            ['uuid' => '22222222-2222-4222-8222-222222222222', 'nick' => 'Banned', 'ip' => '8.8.8.8'],
            ['uuid' => '33333333-3333-4333-8333-333333333333', 'nick' => 'Unknown', 'ip' => '9.9.9.9'],
        ])['results'];
        self::assertSame(['vpn_detected', 'blacklisted', 'ip_api_unavailable'], array_column($results, 'reason'), 'sin detección de cuenta comprometida');
        self::assertSame(['uuid', 'allowed', 'reason', 'block_reason', 'block_type', 'expires_at', 'ban_id'], array_keys($results[0]));
        self::assertSame($before, [$this->countRows('player_connections'), $this->countRows('activity_logs'), $this->countRows('blacklist'), $this->countRows('ip_api_logs'), $this->countRows('minecraft_profiles')]);
        self::assertSame([0, 0, 0], [$this->ipApiCalls, $this->mojangCalls, (int) $this->row('SELECT COALESCE(SUM(block_count), 0) AS n FROM blocked_providers')['n']]);
    }

    public function testCompromisedAccountBansUuidWithChildrenAndReportsCountries(): void
    {
        for ($i = 0; $i < 4; $i++) {
            logPlayerConnection($this->db, $this->player(), self::RESIDENTIAL, false, null);
        }
        for ($i = 0; $i < 10; $i++) {
            logPlayerConnection($this->db, $this->player(ip: '2606:4700:1:2::9'), ['countryCode' => 'RU'] + self::RESIDENTIAL, true, 'blacklisted');
        }
        $this->ipApi['2606:4700:1:2::9'] = ['countryCode' => 'RU', 'country' => 'Russia', 'continentCode' => 'EU'] + self::RESIDENTIAL;
        setSetting($this->db, 'country_change_min_connections', '3');
        $version = (int) getSetting($this->db, 'cache_version');

        $result = checkPlayer($this->db, $this->player(ip: '2606:4700:1:2::9'));
        self::assertSame(['compromised_account', 'uuid', 'ES', 'RU'], [$result['reason'], $result['block_type'], $result['historical_country'], $result['current_country']], 'los intentos bloqueados no blanquean el país');
        $root = $this->row("SELECT id, ban_id FROM blacklist WHERE type = 'uuid'");
        self::assertSame($root['ban_id'], $result['ban_id']);
        self::assertSame([['nick', 'Player'], ['ip_range', '2606:4700:1:2::/64']], $this->db->query("SELECT type, value FROM blacklist WHERE parent_id = {$root['id']} ORDER BY type")->fetchAll(\PDO::FETCH_NUM));
        self::assertGreaterThan($version, (int) getSetting($this->db, 'cache_version'));
        self::assertSame(1, $this->countRows('activity_logs', "type = 'security' AND action = 'compromised_account'"));
        self::assertSame('blacklisted', checkPlayer($this->db, $this->player(ip: '2606:4700:1:2::9'))['reason']);
    }

    public function testLookupPlayerAndPremiumUuidMatching(): void
    {
        self::assertSame(['found' => false], lookupPlayer($this->db, 'Ghost'));
        $this->ipApi['8.8.8.8'] = self::RESIDENTIAL;
        checkPlayer($this->db, $this->player());
        $connections = $this->countRows('player_connections');
        $lookup = lookupPlayer($this->db, 'player');
        self::assertSame([true, self::UUID, '8.8.8.8', false, true, 'allowed'], [$lookup['found'], $lookup['uuid'], $lookup['ip'], $lookup['is_online'], $lookup['allowed'], $lookup['reason']]);
        self::assertSame($connections, $this->countRows('player_connections'), 'lookup no registra nada');

        // Un baneo por UUID premium alcanza a quien entra en offline con ese nick (el UUID premium nunca exime en whitelist).
        $premium = '069a79f4-44e9-4726-a5be-fca90e38aaf5';
        $this->premium('Notch', $premium);
        upsertBan($this->db, ['type' => 'uuid', 'value' => $premium, 'reason' => 'premium', 'added_by' => 'Admin'], 'manual');
        whitelistAdd($this->db, 'uuid', $premium, null, 'Admin');
        $result = checkPlayer($this->db, $this->player(uuid: '44444444-4444-3444-8444-444444444444', nick: 'Notch'));
        self::assertSame(['blacklisted', 'Notch'], [$result['reason'], $result['blocked_name']]);
    }

    public function testPluginListActionsAndPollChangesFormat(): void
    {
        $version = (int) getSetting($this->db, 'cache_version');
        pluginAddWhitelist($this->db, ['type' => 'nick', 'value' => 'Friend', 'added_by' => 'Staff']);
        pluginAddBlacklist($this->db, ['type' => 'ip', 'value' => '::ffff:9.9.9.9', 'reason' => 'x', 'duration' => '30']);
        try {
            pluginAddBlacklist($this->db, ['type' => 'ip', 'value' => '9.9.9.9']);
            self::fail('409 esperado');
        } catch (HttpError $e) {
            self::assertSame(409, $e->status);
        }
        upsertBan($this->db, ['type' => 'uuid', 'value' => self::UUID, 'reason' => 'auto', 'added_by' => 'FurrGuard'], 'auto');
        self::assertSame(['success' => true, 'affected' => 1], pluginRemoveBlacklist($this->db, ['type' => 'ip', 'value' => '9.9.9.9']));
        self::assertSame(['success' => true, 'deleted' => 1], pluginRemoveWhitelist($this->db, ['type' => 'nick', 'value' => 'FRIEND']));

        $poll = pollChanges($this->db, $version, 0);
        self::assertTrue($poll['changed']);
        self::assertSame(
            [['whitelist', 'add', 'nick: Friend'], ['blacklist', 'add', 'ip: 9.9.9.9'], ['blacklist', 'disable', 'ip: 9.9.9.9'], ['whitelist', 'remove', 'nick: FRIEND']],
            array_map(static fn (array $a): array => [$a['type'], $a['action'], $a['details']], $poll['recent_actions']),
            'solo whitelist/blacklist, por id creciente y con "tipo: valor"'
        );
        $ids = array_column($poll['recent_actions'], 'id');
        self::assertSame($ids, array_values(array_unique($ids)));
        $sorted = $ids;
        sort($sorted);
        self::assertSame($sorted, $ids);
        self::assertFalse(pollChanges($this->db, $poll['cache_version'], 0)['changed']);

        $this->expectException(ValidationError::class);
        inputPlayerList(['players' => '[{"uuid":"' . self::UUID . '","nick":"bad nick","ip":"1.1.1.1"}]']);
    }

    /**
     * @param array{uuid: ?string, nick: string, ip: string, game_version: ?string} $player
     * @return array{0: mixed, 1: mixed}
     */
    private function decide(array $player): array
    {
        $result = checkPlayer($this->db, $player);
        return [$result['allowed'], $result['reason']];
    }
}
