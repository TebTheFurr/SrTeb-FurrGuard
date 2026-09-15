<?php

declare(strict_types=1);

namespace FurrGuard\Tests\Integration;

use PDO;

final class AdminSessionTest extends DatabaseTestCase
{
    private const ADMIN_ID = '222222222222222222';
    private PDO $db;

    protected function setUp(): void
    {
        $this->db = self::migratedDatabase();
        $this->db->exec('DELETE FROM admin_sessions');
        $this->db->exec('DELETE FROM admin_users WHERE discord_id = ' . $this->db->quote(self::ADMIN_ID));
        $this->db->prepare("INSERT INTO admin_users (discord_id, role) VALUES (?, 'manager')")->execute([self::ADMIN_ID]);
        $_SESSION = [];
        $_SERVER['REMOTE_ADDR'] = '198.51.100.10';
    }

    protected function tearDown(): void
    {
        $_SESSION = [];
        unset($_SERVER['REMOTE_ADDR']);
    }

    private function login(string $discordId = self::ADMIN_ID, string $role = 'manager'): void
    {
        adminSessionStart($this->db, ['discord_id' => $discordId, 'username' => 'Tester', 'avatar' => null], $role);
    }

    public function testStartStoresOnlyTokenHashAndValidates(): void
    {
        $_SESSION['csrf_token'] = str_repeat('0', 64);
        $this->login();
        $session = $_SESSION[ADMIN_SESSION_KEY];
        self::assertNotSame(str_repeat('0', 64), $_SESSION['csrf_token'], 'CSRF nuevo tras el login');
        $row = $this->db->query('SELECT * FROM admin_sessions')->fetch();
        self::assertSame(hash('sha256', $session['token']), $row['session_token_hash']);
        self::assertSame('198.51.100.10', $row['ipv4_address']);
        self::assertNull($row['ipv6_address']);

        $result = adminSessionValidate($this->db);
        self::assertNull($result['error']);
        self::assertSame(['discord_id' => self::ADMIN_ID, 'username' => 'Tester', 'avatar' => null, 'role' => 'manager', 'session_id' => $session['session_id']], $result['user']);
        self::assertSame(['user' => null, 'error' => null], (function (): array {
            $_SESSION = [];
            return adminSessionValidate($this->db);
        })());
    }

    public function testIpRulesPerFamily(): void
    {
        $this->login();
        // Cambiar a IPv6 no cierra la sesión: se aprende la IPv6.
        $_SERVER['REMOTE_ADDR'] = '2001:db8:aa:bb::1';
        self::assertNull(adminSessionValidate($this->db)['error']);
        $_SERVER['REMOTE_ADDR'] = '2001:db8:aa:bb:ffff::2';
        self::assertNull(adminSessionValidate($this->db)['error'], 'misma /64');
        $_SERVER['REMOTE_ADDR'] = '198.51.100.10';
        self::assertNull(adminSessionValidate($this->db)['error'], 'volver a la IPv4 aprendida');
        $_SERVER['REMOTE_ADDR'] = '2001:db8:aa:cc::1';
        self::assertSame('session_expired', adminSessionValidate($this->db)['error'], 'otra /64');
        self::assertNotNull($this->db->query('SELECT revoked_at FROM admin_sessions')->fetchColumn());

        $_SERVER['REMOTE_ADDR'] = '198.51.100.10';
        $this->login();
        $_SERVER['REMOTE_ADDR'] = '198.51.100.11';
        self::assertSame('session_expired', adminSessionValidate($this->db)['error'], 'otra IPv4');
        self::assertArrayNotHasKey(ADMIN_SESSION_KEY, $_SESSION);
    }

    public function testIdleAndAbsoluteExpiry(): void
    {
        $this->login();
        $this->db->exec('UPDATE admin_sessions SET last_activity_at = NOW() - INTERVAL 7201 SECOND');
        self::assertSame('session_expired', adminSessionValidate($this->db)['error']);

        $this->login();
        $this->db->exec('UPDATE admin_sessions SET expires_at = NOW() - INTERVAL 1 SECOND WHERE revoked_at IS NULL');
        self::assertSame('session_expired', adminSessionValidate($this->db)['error']);

        $this->login();
        $this->db->exec('UPDATE admin_sessions SET last_activity_at = NOW() - INTERVAL 5 MINUTE WHERE revoked_at IS NULL');
        self::assertNull(adminSessionValidate($this->db)['error']);
        self::assertSame(0, (int) $this->db->query('SELECT TIMESTAMPDIFF(MINUTE, last_activity_at, NOW()) FROM admin_sessions WHERE revoked_at IS NULL')->fetchColumn(), 'actividad actualizada');
    }

    public function testRevocationAndRoleChanges(): void
    {
        $this->login();
        $this->db->prepare("UPDATE admin_users SET role = 'admin' WHERE discord_id = ?")->execute([self::ADMIN_ID]);
        self::assertSame(1, adminSessionRevokeForDiscordId($this->db, self::ADMIN_ID));
        self::assertSame('access_revoked', adminSessionValidate($this->db)['error']);

        $this->login(self::ADMIN_ID, 'admin');
        $this->db->prepare('DELETE FROM admin_users WHERE discord_id = ?')->execute([self::ADMIN_ID]);
        self::assertSame('access_revoked', adminSessionValidate($this->db)['error'], 'usuario quitado sin revocar filas');

        $this->login('111111111111111111', 'founder');
        $first = $_SESSION[ADMIN_SESSION_KEY];
        $this->login('111111111111111111', 'founder');
        $_SESSION[ADMIN_SESSION_KEY] = $first;
        self::assertSame('session_expired', adminSessionValidate($this->db)['error'], 'un login nuevo revoca las sesiones anteriores');
    }

    public function testTamperedTokenAndLogout(): void
    {
        $this->login();
        $_SESSION[ADMIN_SESSION_KEY]['token'] = str_repeat('f', 64);
        self::assertSame('session_expired', adminSessionValidate($this->db)['error']);

        $this->login();
        adminSessionLogout($this->db);
        self::assertSame([], $_SESSION);
        self::assertSame(0, (int) $this->db->query('SELECT COUNT(*) FROM admin_sessions WHERE revoked_at IS NULL')->fetchColumn());
    }

    public function testRolesAndLoginUrl(): void
    {
        self::assertSame('founder', getUserRole($this->db, '111111111111111111'));
        self::assertSame('manager', getUserRole($this->db, self::ADMIN_ID));
        self::assertNull(getUserRole($this->db, ''));
        self::assertNull(getUserRole($this->db, '333'));
        self::assertNull(getUserRole($this->db, "' OR 1=1 --"));

        $url = getDiscordLoginUrl();
        self::assertStringStartsWith('https://discord.com/api/oauth2/authorize?', $url);
        self::assertStringContainsString('redirect_uri=' . rawurlencode('https://furrguard.test/admin/callback.php'), $url);
        self::assertStringContainsString('state=' . $_SESSION['oauth_state'], $url);
        self::assertSame($url, getDiscordLoginUrl(), 'el state se reutiliza dentro de la sesión');
    }

    // ─── Puente de Pterodactyl (sesión por token, docs/API.md §9) ────────────

    /**
     * @return array{session_id: int, token: string}
     */
    private function createTokenSession(string $ip = '203.0.113.9'): array
    {
        return adminSessionCreate($this->db, ['discord_id' => self::ADMIN_ID, 'username' => 'Tester', 'avatar' => null], $ip);
    }

    public function testTokenSessionStoresHashAndValidates(): void
    {
        $created = $this->createTokenSession();
        $row = $this->db->query('SELECT * FROM admin_sessions')->fetch();
        self::assertSame(hash('sha256', $created['token']), $row['session_token_hash']);
        self::assertSame('203.0.113.9', $row['ipv4_address'], 'la IP es la del navegador que indica el panel, no la del panel');
        self::assertSame([], $_SESSION, 'no toca la sesión PHP');

        $result = adminSessionValidateToken($this->db, $created['token']);
        self::assertNull($result['error']);
        self::assertSame(['discord_id' => self::ADMIN_ID, 'username' => 'Tester', 'avatar' => null, 'role' => 'manager', 'session_id' => $created['session_id']], $result['user']);

        self::assertSame('session_expired', adminSessionValidateToken($this->db, str_repeat('0', 64))['error'], 'token desconocido');
        self::assertSame('session_expired', adminSessionValidateToken($this->db, 'no-es-un-token')['error']);

        $this->db->exec('DELETE FROM admin_users WHERE discord_id = ' . $this->db->quote(self::ADMIN_ID));
        self::assertSame('access_revoked', adminSessionValidateToken($this->db, $created['token'])['error']);
        self::assertNotNull($this->db->query('SELECT revoked_at FROM admin_sessions')->fetchColumn(), 'sin rol la fila queda revocada');
        self::assertSame('access_revoked', adminSessionValidateToken($this->db, $created['token'])['error'], 'revocada y sin rol');
    }

    public function testTokenSessionRevokesPreviousAndExpires(): void
    {
        $first = $this->createTokenSession();
        $second = $this->createTokenSession('2001:db8::7');
        self::assertSame('session_expired', adminSessionValidateToken($this->db, $first['token'])['error'], 'entrar de nuevo revoca la sesión anterior');
        self::assertNull(adminSessionValidateToken($this->db, $second['token'])['error']);
        self::assertSame('2001:db8::7', $this->db->query('SELECT ipv6_address FROM admin_sessions WHERE revoked_at IS NULL')->fetchColumn());

        $this->db->exec('UPDATE admin_sessions SET last_activity_at = NOW() - INTERVAL 7201 SECOND');
        self::assertSame('session_expired', adminSessionValidateToken($this->db, $second['token'])['error'], 'inactividad');
        self::assertSame(0, (int) $this->db->query('SELECT COUNT(*) FROM admin_sessions WHERE revoked_at IS NULL')->fetchColumn());
    }

    public function testBridgeNonceIsSingleUse(): void
    {
        $this->db->exec('DELETE FROM panel_nonces');
        self::assertTrue(panelBridgeConsumeNonce($this->db, 'abcdefghijklmnop'));
        self::assertFalse(panelBridgeConsumeNonce($this->db, 'abcdefghijklmnop'), 'repetición');
        self::assertTrue(panelBridgeConsumeNonce($this->db, 'ponmlkjihgfedcba'));
        $this->db->exec('UPDATE panel_nonces SET created_at = NOW() - INTERVAL 301 SECOND');
        self::assertTrue(panelBridgeConsumeNonce($this->db, 'abcdefghijklmnop'), 'los nonces caducados se limpian');
    }
}
