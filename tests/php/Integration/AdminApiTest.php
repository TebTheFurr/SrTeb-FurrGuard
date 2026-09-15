<?php

declare(strict_types=1);

namespace FurrGuard\Tests\Integration;

use HttpError;
use ValidationError;

/**
 * API del panel (docs/API.md §4): CSRF, sesión, permisos que fallan en cerrado, IPs ocultas, listas
 * paginadas, búsquedas y acciones. Las sesiones se crean con adminSessionStart (sin atajos en la app).
 */
final class AdminApiTest extends DomainTestCase
{
    private const FOUNDER = '111111111111111111';
    private const ADMIN = '333333333333333333';
    private const OTHER_FOUNDER = '666666666666666666';

    protected function setUp(): void
    {
        parent::setUp();
        $this->db->exec("DELETE FROM admin_users WHERE discord_id IN ('" . self::FOUNDER . "', '" . self::ADMIN . "', '444444444444444444', '" . self::OTHER_FOUNDER . "')");
        $this->db->exec("INSERT INTO admin_users (discord_id, role) VALUES ('" . self::ADMIN . "', 'admin')");
        foreach (['REQUEST_METHOD', 'CONTENT_TYPE', 'HTTP_X_CSRF_TOKEN', 'HTTP_ORIGIN', 'HTTP_SEC_FETCH_SITE'] as $key) {
            unset($_SERVER[$key]);
        }
    }

    /**
     * @return AdminUser
     */
    private function login(string $discordId = self::FOUNDER, string $role = 'founder'): array
    {
        adminSessionStart($this->db, ['discord_id' => $discordId, 'username' => "user-{$role}", 'avatar' => null], $role);
        $_SERVER['REQUEST_METHOD'] = 'POST';
        $_SERVER['CONTENT_TYPE'] = 'application/json';
        $_SERVER['HTTP_X_CSRF_TOKEN'] = $_SESSION['csrf_token'];
        return adminApiAuthenticate($this->db);
    }

    /**
     * @param AdminUser $user
     * @param array<string, mixed> $params
     */
    private function call(array $user, string $action, array $params = []): mixed
    {
        return adminApiDispatch($this->db, $user, ['action' => $action] + $params);
    }

    private function assertHttpError(int $status, string $slug, callable $call): void
    {
        try {
            $call();
            self::fail("Se esperaba HTTP {$status} {$slug}");
        } catch (HttpError $e) {
            self::assertSame([$status, $slug], [$e->status, $e->slug], $e->getMessage());
        }
    }

    public function testRequestsNeedCsrfAndAValidSession(): void
    {
        $this->assertHttpError(403, 'csrf', static fn () => adminApiCheckRequest());
        $_SESSION['csrf_token'] = str_repeat('c', 64);
        $_SERVER += ['REQUEST_METHOD' => 'POST', 'CONTENT_TYPE' => 'application/json; charset=utf-8', 'HTTP_X_CSRF_TOKEN' => str_repeat('c', 64)];
        adminApiCheckRequest();
        $_SERVER['HTTP_ORIGIN'] = 'https://evil.example';
        $this->assertHttpError(403, 'csrf', static fn () => adminApiCheckRequest());
        unset($_SERVER['HTTP_ORIGIN']);
        $_SERVER['HTTP_X_CSRF_TOKEN'] = str_repeat('d', 64);
        $this->assertHttpError(403, 'csrf', static fn () => adminApiCheckRequest());

        $this->assertHttpError(401, 'unauthorized', fn () => adminApiAuthenticate($this->db));
        $user = $this->login();
        self::assertSame(['founder', self::FOUNDER], [$user['role'], $user['discord_id']]);
        self::assertNull($this->call($user, 'logout'));
        $this->assertHttpError(401, 'unauthorized', fn () => adminApiAuthenticate($this->db));
        self::assertSame(1, $this->countRows('activity_logs', "type = 'auth' AND action = 'logout'"));
    }

    public function testFounderRowsAreRemovableExceptFounderDiscordId(): void
    {
        $this->db->exec("INSERT INTO admin_users (discord_id, role) VALUES ('" . self::FOUNDER . "', 'founder'), ('" . self::OTHER_FOUNDER . "', 'founder')");
        $ids = $this->db->query("SELECT discord_id, id FROM admin_users WHERE role = 'founder'")->fetchAll(\PDO::FETCH_KEY_PAIR);
        $other = $this->login(self::OTHER_FOUNDER, 'founder');
        $founder = $this->login();

        $removable = array_column($this->call($founder, 'get_admin_users')['items'], 'removable', 'discord_id');
        self::assertSame([false, true], [$removable[self::FOUNDER], $removable[self::OTHER_FOUNDER]]);

        $this->assertHttpError(403, 'forbidden', fn () => $this->call($founder, 'remove_admin_user', ['id' => (int) $ids[self::FOUNDER]]));
        self::assertSame(1, $this->countRows('admin_users', 'discord_id = ?', [self::FOUNDER]));

        $this->call($founder, 'remove_admin_user', ['id' => (int) $ids[self::OTHER_FOUNDER]]);
        self::assertSame(0, $this->countRows('admin_users', 'discord_id = ?', [self::OTHER_FOUNDER]));
        self::assertSame(0, $this->countRows('admin_sessions', 'discord_id = ? AND revoked_at IS NULL', [self::OTHER_FOUNDER]), 'se revocan sus sesiones');
        self::assertSame('founder', $other['role']);
        self::assertSame(1, $this->countRows('activity_logs', "type = 'users' AND action = 'remove_user' AND details LIKE ?", ['%' . self::OTHER_FOUNDER . ' (founder)%']));

        $this->assertHttpError(422, 'validation', fn () => $this->call($founder, 'add_admin_user', ['discord_id' => '777777777777777777', 'role' => 'founder']));
        self::assertSame(0, $this->countRows('admin_users', 'discord_id = ?', ['777777777777777777']));
    }

    public function testDispatchFailsClosed(): void
    {
        $admin = $this->login(self::ADMIN, 'admin');
        $this->assertHttpError(404, 'unknown_action', fn () => $this->call($admin, 'remove_whitelist_by_value'));
        $this->assertHttpError(404, 'unknown_action', fn () => adminApiDispatch($this->db, $admin, []));
        foreach (['get_settings', 'get_ips', 'get_connections', 'get_logs', 'export_data', 'migrate_blacklist', 'get_admin_users', 'furrsecurity_get_staff'] as $action) {
            $this->assertHttpError(403, 'forbidden', fn () => $this->call($admin, $action));
        }
        self::assertIsArray($this->call($admin, 'get_overview'));

        $sections = array_merge(...array_values(ROLE_PERMISSIONS));
        foreach (adminApiActions() as $action => $route) {
            self::assertTrue($route['section'] === null ? $action === 'logout' : in_array($route['section'], $sections, true), $action);
        }
    }

    public function testAdminRoleNeverReceivesIps(): void
    {
        $this->ipApi['8.8.8.8'] = ['countryCode' => 'ES', 'country' => 'Spain', 'isp' => 'ISP'];
        checkPlayer($this->db, $this->player());
        $admin = $this->login(self::ADMIN, 'admin');

        $players = $this->call($admin, 'get_players');
        self::assertTrue($players['ip_hidden']);
        self::assertNull($players['items'][0]['last_ip']);
        self::assertSame(0, $this->call($admin, 'get_players', ['search' => '8.8.8'])['pagination']['total'], 'sin sección ips no se busca por IP');
        self::assertSame(1, $this->call($admin, 'get_players', ['search' => 'playe'])['pagination']['total']);

        $detail = $this->call($admin, 'get_player_detail', ['uuid' => strtoupper(str_replace('-', '', self::UUID))]);
        self::assertSame([null, [], null, true], [$detail['player']['last_ip'], $detail['ips'], $detail['recent_connections'][0]['ip'], $detail['ip_hidden']]);
        self::assertSame(['status' => 'not_found', 'uuid' => null], $detail['premium']);
        self::assertNull($this->call($admin, 'get_overview')['recent_connections'][0]['ip']);

        $this->db->exec("INSERT INTO admin_users (discord_id, role) VALUES ('444444444444444444', 'manager')");
        $manager = $this->login('444444444444444444', 'manager');
        self::assertSame('8.8.8.8', $this->call($manager, 'get_players', ['search' => '8.8.8'])['items'][0]['last_ip']);
        self::assertSame('8.8.8.8', $this->call($manager, 'get_player_detail', ['uuid' => self::UUID])['ips'][0]['ip']);
        $this->assertHttpError(404, 'not_found', fn () => $this->call($manager, 'get_player_detail', ['uuid' => '99999999-2222-4333-8444-555555555555']));
        $this->assertHttpError(422, 'validation', fn () => $this->call($manager, 'get_player_detail', ['uuid' => 'nope']));
    }

    public function testEveryListIsPaginatedWithTheSameShape(): void
    {
        $founder = $this->login();
        for ($i = 1; $i <= 3; $i++) {
            whitelistAdd($this->db, 'nick', "Friend{$i}", null, 'Admin');
            $this->db->prepare("INSERT INTO furrsecurity_staff (discord_id, minecraft_nick, added_by) VALUES (?, ?, 'x')")->execute(["55555555555555555{$i}", "Staff{$i}"]);
        }
        $lists = ['get_players', 'get_connections', 'get_ips', 'get_whitelist', 'get_blacklist', 'get_sanctions', 'get_providers', 'get_countries',
            'get_continents', 'get_logs', 'get_admin_users', 'get_furr_perms_whitelist', 'get_furr_perms_logs', 'furrsecurity_get_staff',
            'furrsecurity_get_sessions', 'furrsecurity_get_logs'];
        foreach ($lists as $action) {
            $result = $this->call($founder, $action, ['page' => 1, 'per_page' => 2]);
            self::assertIsList($result['items'], $action);
            self::assertSame(['page', 'per_page', 'total', 'total_pages'], array_keys($result['pagination']), $action);
        }
        $page = $this->call($founder, 'get_whitelist', ['page' => 2, 'per_page' => 2]);
        self::assertSame([1, ['page' => 2, 'per_page' => 2, 'total' => 3, 'total_pages' => 2]], [count($page['items']), $page['pagination']]);
        $this->assertHttpError(422, 'validation', fn () => $this->call($founder, 'get_whitelist', ['per_page' => 101]));

        // B3: el mismo término en varias columnas con placeholders posicionales.
        self::assertSame(['Staff2'], array_column($this->call($founder, 'furrsecurity_get_staff', ['search' => 'staff2'])['items'], 'minecraft_nick'));
        self::assertSame(1, $this->call($founder, 'furrsecurity_get_staff', ['search' => '555555555555555553'])['pagination']['total']);
        self::assertSame(0, $this->call($founder, 'get_whitelist', ['search' => '%'])['pagination']['total'], 'comodines escapados');
        $this->db->exec("INSERT INTO furrsecurity_logs (uuid, minecraft_nick, action, details) VALUES ('" . self::UUID . "', 'Staff1', 'verification_failed', 'Intento 1/3'), (NULL, 'Staff2', 'token_generated', 'x')");
        self::assertSame(1, $this->call($founder, 'furrsecurity_get_logs', ['group' => 'failed', 'search' => 'intento'])['pagination']['total']);
        self::assertSame(['hosting', 'vpn', 'proxy'], array_keys($this->call($founder, 'get_providers')['stats']));
        self::assertSame(['total', 'active', 'total_blocks'], array_keys($this->call($founder, 'get_countries')['stats']));
    }

    public function testBlacklistFromThePanel(): void
    {
        $founder = $this->login();
        updatePlayerInfo($this->db, self::UUID, 'Player', '8.8.8.8', []);
        $added = $this->call($founder, 'add_blacklist', ['type' => 'nick', 'value' => 'Player', 'reason' => 'x', 'duration_minutes' => 60, 'stain_ip' => true]);
        self::assertFalse($added['reactivated']);
        $this->assertHttpError(409, 'duplicate', fn () => $this->call($founder, 'add_blacklist', ['type' => 'nick', 'value' => 'player', 'reason' => '', 'duration_minutes' => 0, 'stain_ip' => false]));

        $list = $this->call($founder, 'get_blacklist', ['search' => '8.8.8.8']);
        self::assertSame([1, 'ip', '8.8.8.8'], [count($list['items']), $list['items'][0]['children'][0]['type'], $list['items'][0]['children'][0]['value']], 'la búsqueda encuentra al padre por la IP hija');

        $expires = $this->row('SELECT expires_at FROM blacklist WHERE id = ?', [$added['id']])['expires_at'];
        $this->call($founder, 'edit_blacklist', ['id' => $added['id'], 'reason' => 'nuevo', 'duration_minutes' => null]);
        self::assertSame(['nuevo', $expires], array_values($this->row('SELECT reason, expires_at FROM blacklist WHERE id = ?', [$added['id']])), 'null = sin cambios');
        $this->call($founder, 'edit_blacklist', ['id' => $added['id'], 'reason' => 'nuevo', 'duration_minutes' => 0]);
        self::assertSame(2, $this->countRows('blacklist', 'expires_at IS NULL'));

        $this->call($founder, 'set_blacklist_active', ['id' => $added['id'], 'active' => false]);
        self::assertSame(0, $this->countRows('blacklist', 'active = 1'));
        self::assertSame(1, $this->call($founder, 'get_blacklist', ['status' => 'inactive'])['pagination']['total']);
        self::assertTrue($this->call($founder, 'add_blacklist', ['type' => 'nick', 'value' => 'Player', 'reason' => 'otra vez', 'duration_minutes' => 0, 'stain_ip' => false])['reactivated']);
        self::assertIsInt($this->call($founder, 'add_blacklist_ip', ['parent_id' => $added['id'], 'ip' => '1.1.1.1'])['id']);
        $this->assertHttpError(409, 'duplicate', fn () => $this->call($founder, 'add_blacklist_ip', ['parent_id' => $added['id'], 'ip' => '1.1.1.1']));

        $sanctions = $this->call($founder, 'get_sanctions', ['filter' => 'temporary']);
        $stats = $sanctions['stats'];
        self::assertSame($stats['total'], $stats['active'] + $stats['expired'] + $stats['inactive'], 'estados disjuntos');
        self::assertSame($stats['active'], $stats['permanent'] + $stats['temporary']);
        self::assertSame($stats['temporary'], $sanctions['pagination']['total'], 'la pestaña y la estadística cuentan lo mismo');

        $this->mojang['busy'] = ['status' => 429, 'body' => null];
        $this->assertHttpError(503, 'mojang_unavailable', fn () => $this->call($founder, 'add_blacklist_unified', ['player_name' => 'Busy', 'reason' => '', 'duration_minutes' => 0, 'stain_ip' => false]));
        $this->premium('Notch', '069a79f4-44e9-4726-a5be-fca90e38aaf5');
        $unified = $this->call($founder, 'add_blacklist_unified', ['player_name' => 'notch', 'uuid' => self::UUID, 'is_premium' => false, 'reason' => '', 'duration_minutes' => 0, 'stain_ip' => false]);
        self::assertSame(['uuid', '069a79f4-44e9-4726-a5be-fca90e38aaf5', true, 'Notch'], [$unified['type'], $unified['value'], $unified['is_premium'], $unified['player_name']], 'B4: el uuid del cliente se ignora');

        $this->call($founder, 'remove_blacklist', ['id' => $added['id']]);
        self::assertSame(1, $this->countRows('blacklist'), 'solo queda el de Notch');
        self::assertSame(1, $this->countRows('activity_logs', "type = 'blacklist' AND action = 'remove' AND details LIKE 'nick: Player · %'"));
        $this->assertHttpError(404, 'not_found', fn () => $this->call($founder, 'remove_blacklist', ['id' => $added['id']]));
    }

    public function testSettingsMessagesUsersAndMigrations(): void
    {
        $founder = $this->login();
        $this->call($founder, 'save_settings', ['settings' => ['block_mobile' => 1, 'country_change_min_percentage' => 55.5, 'furrsecurity_session_duration' => 3600]]);
        self::assertSame(['1', '55.5', '3600'], array_values(getSettings($this->db, ['block_mobile', 'country_change_min_percentage', 'furrsecurity_session_duration'])));
        $this->assertHttpError(422, 'validation', fn () => $this->call($founder, 'save_settings', ['settings' => ['api_key_hash' => 'x']]));
        $settings = $this->call($founder, 'get_settings');
        self::assertArrayNotHasKey('api_key_hash', $settings['settings']);

        $key = $this->call($founder, 'regenerate_api_key');
        self::assertSame(['api_key', 'prefix', 'created_at'], array_keys($key));
        self::assertStringNotContainsString('api_key', (string) json_encode($this->call($founder, 'export_data')));

        $this->assertHttpError(422, 'validation', fn () => $this->call($founder, 'save_messages', ['messages' => ['no_such_key' => 'x']]));
        $this->call($founder, 'save_messages', ['messages' => ['prefix' => '&aNuevo', 'kick_vpn' => (string) $this->row("SELECT value FROM messages WHERE `key` = 'kick_vpn'")['value']]]);
        self::assertSame(1, $this->countRows('activity_logs', "type = 'messages' AND details LIKE '1 mensajes: prefix%'"), 'solo las claves que cambian');

        $added = $this->call($founder, 'add_admin_user', ['discord_id' => '444444444444444444', 'role' => 'manager']);
        $manager = $this->login('444444444444444444', 'manager');
        $founder = $this->login();
        $this->call($founder, 'remove_admin_user', ['id' => $added['id']]);
        self::assertSame(0, $this->countRows('admin_sessions', "discord_id = '444444444444444444' AND revoked_at IS NULL"), 'se revocan sus sesiones');
        self::assertSame('manager', $manager['role']);
        $this->assertHttpError(422, 'validation', fn () => $this->call($founder, 'add_admin_user', ['discord_id' => self::FOUNDER, 'role' => 'owner']));

        // B7: Mojang caído → se omite; un nick premium pasa a UUID; nunca un UUID premium a nick.
        $premiumUuid = '069a79f4-44e9-4726-a5be-fca90e38aaf5';
        upsertBan($this->db, ['type' => 'nick', 'value' => 'Busy', 'reason' => 'a', 'added_by' => 'x'], 'manual');
        upsertBan($this->db, ['type' => 'nick', 'value' => 'Notch', 'reason' => 'b', 'added_by' => 'x'], 'manual');
        upsertBan($this->db, ['type' => 'uuid', 'value' => '169a79f4-44e9-4726-a5be-fca90e38aaf5', 'reason' => 'c', 'added_by' => 'x'], 'manual');
        $this->mojang['busy'] = ['status' => 429, 'body' => null];
        $this->mojang['169a79f4-44e9-4726-a5be-fca90e38aaf5'] = ['status' => 429, 'body' => null];
        $this->premium('Notch', $premiumUuid);
        $batch = $this->call($founder, 'migrate_blacklist', ['batch_size' => 2]);
        self::assertSame([2, 1, 1], [$batch['processed'], $batch['skipped'], $batch['changed']]);
        self::assertIsInt($batch['next_cursor']);
        $last = $this->call($founder, 'migrate_blacklist', ['batch_size' => 2, 'cursor' => (string) $batch['next_cursor']]);
        self::assertSame([1, 1, null], [$last['processed'], $last['skipped'], $last['next_cursor']]);
        self::assertSame(['nick', 'uuid', 'uuid'], $this->db->query("SELECT type FROM blacklist WHERE value IN ('Busy', '{$premiumUuid}', '169a79f4-44e9-4726-a5be-fca90e38aaf5') ORDER BY id")->fetchAll(\PDO::FETCH_COLUMN));
        $this->assertHttpError(422, 'validation', fn () => $this->call($founder, 'migrate_players', ['batch_size' => 26]));
    }
}
