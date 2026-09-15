<?php

declare(strict_types=1);

namespace FurrGuard\Tests\Integration;

use HttpError;
use PDO;

/**
 * Puente de Pterodactyl (docs/API.md §9) de punta a punta menos Discord: firma, nonce, sesión por
 * token y despacho a las acciones del panel con los permisos del rol.
 */
final class PanelBridgeFlowTest extends DatabaseTestCase
{
    private const ADMIN_ID = '222222222222222222';
    private PDO $db;
    /** @var array<string, mixed> */
    private array $serverBackup = [];

    protected function setUp(): void
    {
        $this->db = self::migratedDatabase();
        $this->db->exec('DELETE FROM admin_sessions');
        $this->db->exec('DELETE FROM panel_nonces');
        $this->db->exec('DELETE FROM admin_users WHERE discord_id = ' . $this->db->quote(self::ADMIN_ID));
        $this->db->prepare("INSERT INTO admin_users (discord_id, role) VALUES (?, 'admin')")->execute([self::ADMIN_ID]);
        $this->serverBackup = $_SERVER;
    }

    protected function tearDown(): void
    {
        $_SERVER = $this->serverBackup;
    }

    /**
     * @return array<string, string>
     */
    private function signedServer(string $body, ?string $session, string $nonce = 'nonce-0123456789'): array
    {
        $t = time();
        $server = [
            'REMOTE_ADDR' => '198.51.100.5',
            'REQUEST_METHOD' => 'POST',
            'REQUEST_URI' => '/api/panel.php',
            'HTTP_X_FURRGUARD_SIGNATURE' => sprintf('t=%d,n=%s,f=%s', $t, $nonce, panelBridgeExpectedSignature(PTERODACTYL_PANEL_KEY, 'POST', '/api/panel.php', $t, $nonce, $body)),
            'HTTP_X_FURRGUARD_CLIENT_IP' => '203.0.113.9',
        ];
        if ($session !== null) {
            $server['HTTP_X_FURRGUARD_SESSION'] = $session;
        }
        return $server;
    }

    /**
     * @return array{session_id: int, token: string}
     */
    private function tokenSession(): array
    {
        return adminSessionCreate($this->db, ['discord_id' => self::ADMIN_ID, 'username' => 'Tester', 'avatar' => null], '203.0.113.9');
    }

    public function testSignedRequestValidatesOnceAndAdoptsBrowserIp(): void
    {
        $body = '{"action":"session"}';
        $server = $this->signedServer($body, null);
        panelBridgeVerifyRequest($this->db, $server, $body);
        self::assertSame(1, (int) $this->db->query('SELECT COUNT(*) FROM panel_nonces')->fetchColumn());

        $_SERVER = $server + $_SERVER;
        panelBridgeAdoptClientIp();
        self::assertSame('203.0.113.9', getClientIp(), 'la IP del cliente pasa a ser la del navegador');

        try {
            panelBridgeVerifyRequest($this->db, $server, $body);
            self::fail('una firma repetida no vale');
        } catch (HttpError $e) {
            self::assertSame([401, 'panel_signature'], [$e->status, $e->slug]);
        }
        try {
            panelBridgeVerifyRequest($this->db, $this->signedServer($body, null, 'otro-nonce-987654'), '{"action":"logout"}');
            self::fail('el cuerpo firmado no coincide');
        } catch (HttpError $e) {
            self::assertSame('panel_signature', $e->slug);
        }
    }

    public function testSessionActionsFollowRoleAndRevocation(): void
    {
        $created = $this->tokenSession();
        $_SERVER = $this->signedServer('{"action":"session"}', $created['token']) + $_SERVER;
        panelBridgeAdoptClientIp();

        $session = panelBridgeDispatch($this->db, ['action' => 'session']);
        self::assertIsArray($session);
        self::assertSame(['discord_id' => self::ADMIN_ID, 'username' => 'Tester', 'avatar' => null, 'role' => 'admin'], $session['user']);
        self::assertSame(rolePermissions('admin'), $session['permissions']);
        self::assertFalse($session['can_see_ips']);

        $overview = panelBridgeDispatch($this->db, ['action' => 'get_overview']);
        self::assertIsArray($overview);
        self::assertArrayHasKey('online_players', $overview, 'las acciones del panel se despachan con la sesión por token');

        try {
            panelBridgeDispatch($this->db, ['action' => 'get_settings']);
            self::fail('admin no tiene la sección settings');
        } catch (HttpError $e) {
            self::assertSame([403, 'forbidden'], [$e->status, $e->slug]);
        }
        try {
            panelBridgeDispatch($this->db, ['action' => 'no_existe']);
            self::fail('acción desconocida');
        } catch (HttpError $e) {
            self::assertSame(404, $e->status);
        }

        self::assertNull(panelBridgeDispatch($this->db, ['action' => 'logout']));
        try {
            panelBridgeDispatch($this->db, ['action' => 'session']);
            self::fail('tras el logout el token ya no vale');
        } catch (HttpError $e) {
            self::assertSame([401, 'session_expired'], [$e->status, $e->slug]);
        }
        $logout = $this->db->query("SELECT details FROM activity_logs WHERE type = 'auth' AND action = 'logout' ORDER BY id DESC LIMIT 1")->fetchColumn();
        self::assertStringContainsString('desde Pterodactyl', (string) $logout);
    }

    public function testWithoutSessionOnlyOauthStartWorks(): void
    {
        $_SERVER = $this->signedServer('{"action":"oauth_start"}', null) + $_SERVER;
        $start = panelBridgeDispatch($this->db, ['action' => 'oauth_start']);
        self::assertIsArray($start);
        self::assertStringStartsWith('https://discord.com/api/oauth2/authorize?', $start['url']);
        self::assertStringContainsString('redirect_uri=' . rawurlencode('https://panel.test/furrguard/callback'), $start['url']);
        self::assertStringContainsString('state=' . rawurlencode($start['state']), $start['url']);
        self::assertTrue(panelBridgeStateValid(PTERODACTYL_PANEL_KEY, $start['state']));

        foreach (['session', 'get_overview', 'logout'] as $action) {
            try {
                panelBridgeDispatch($this->db, ['action' => $action]);
                self::fail("{$action} sin sesión");
            } catch (HttpError $e) {
                self::assertSame([401, 'unauthorized'], [$e->status, $e->slug], $action);
            }
        }

        try {
            panelBridgeDispatch($this->db, ['action' => 'oauth_exchange', 'state' => 'caducado', 'code' => 'abc']);
            self::fail('state inválido');
        } catch (HttpError $e) {
            self::assertSame([400, 'invalid_state'], [$e->status, $e->slug]);
        }
    }
}
