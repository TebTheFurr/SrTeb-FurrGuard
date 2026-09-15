<?php

declare(strict_types=1);

namespace FurrGuard\Tests\Unit;

use PHPUnit\Framework\TestCase;

/**
 * Firma HMAC y `state` OAuth del puente de Pterodactyl (includes/panel_bridge.php), sin BD.
 */
final class PanelBridgeTest extends TestCase
{
    private const KEY = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
    private const NOW = 1_800_000_000;

    private static function header(int $timestamp, string $nonce, string $method = 'POST', string $target = '/api/panel.php', string $body = '{"action":"session"}', string $key = self::KEY): string
    {
        return sprintf('t=%d,n=%s,f=%s', $timestamp, $nonce, panelBridgeExpectedSignature($key, $method, $target, $timestamp, $nonce, $body));
    }

    public function testValidSignatureReturnsNonce(): void
    {
        $nonce = 'abcdefghijklmnop';
        $header = self::header(self::NOW, $nonce);
        self::assertSame($nonce, panelBridgeCheckSignature(self::KEY, $header, 'POST', '/api/panel.php', '{"action":"session"}', self::NOW));
        self::assertSame($nonce, panelBridgeCheckSignature(self::KEY, $header, 'post', '/api/panel.php', '{"action":"session"}', self::NOW + PANEL_BRIDGE_MAX_CLOCK_SKEW), 'método sin distinguir mayúsculas y desfase justo en el límite');
    }

    public function testSignatureRejectsTamperingClockAndFormat(): void
    {
        $header = self::header(self::NOW, 'abcdefghijklmnop');
        self::assertNull(panelBridgeCheckSignature(self::KEY, $header, 'POST', '/api/panel.php', '{"action":"logout"}', self::NOW), 'otro cuerpo');
        self::assertNull(panelBridgeCheckSignature(self::KEY, $header, 'POST', '/api/panel.php?x=1', '{"action":"session"}', self::NOW), 'otra ruta');
        self::assertNull(panelBridgeCheckSignature(self::KEY, $header, 'GET', '/api/panel.php', '{"action":"session"}', self::NOW), 'otro método');
        self::assertNull(panelBridgeCheckSignature(str_repeat('0', 64), $header, 'POST', '/api/panel.php', '{"action":"session"}', self::NOW), 'otra clave');
        self::assertNull(panelBridgeCheckSignature(self::KEY, $header, 'POST', '/api/panel.php', '{"action":"session"}', self::NOW + PANEL_BRIDGE_MAX_CLOCK_SKEW + 1), 'reloj adelantado');
        self::assertNull(panelBridgeCheckSignature(self::KEY, $header, 'POST', '/api/panel.php', '{"action":"session"}', self::NOW - PANEL_BRIDGE_MAX_CLOCK_SKEW - 1), 'reloj atrasado');
        self::assertNull(panelBridgeCheckSignature('', self::header(self::NOW, 'abcdefghijklmnop', key: ''), 'POST', '/api/panel.php', '{"action":"session"}', self::NOW), 'sin clave nunca vale');
        self::assertNull(panelBridgeCheckSignature(self::KEY, null, 'POST', '/api/panel.php', '', self::NOW), 'sin cabecera');
        self::assertNull(panelBridgeCheckSignature(self::KEY, 't=1,n=corto,f=' . str_repeat('a', 64), 'POST', '/api/panel.php', '', self::NOW), 'nonce demasiado corto');
        self::assertNull(panelBridgeParseSignature('t=1,n=abcdefghijklmnop,f=ZZ'), 'firma que no es hex');
    }

    public function testStateIsSignedAndExpires(): void
    {
        $state = panelBridgeMakeState(self::KEY, self::NOW);
        self::assertMatchesRegularExpression('/^\d+\.[0-9a-f]{32}\.[0-9a-f]{64}\z/', $state);
        self::assertNotSame($state, panelBridgeMakeState(self::KEY, self::NOW), 'nonce aleatorio');
        self::assertTrue(panelBridgeStateValid(self::KEY, $state, self::NOW));
        self::assertTrue(panelBridgeStateValid(self::KEY, $state, self::NOW + PANEL_BRIDGE_STATE_TTL));
        self::assertFalse(panelBridgeStateValid(self::KEY, $state, self::NOW + PANEL_BRIDGE_STATE_TTL + 1), 'caducado');
        self::assertFalse(panelBridgeStateValid(self::KEY, $state, self::NOW - PANEL_BRIDGE_MAX_CLOCK_SKEW - 1), 'del futuro');
        self::assertFalse(panelBridgeStateValid(str_repeat('0', 64), $state, self::NOW), 'otra clave');
        self::assertFalse(panelBridgeStateValid('', $state, self::NOW), 'sin clave');
        self::assertFalse(panelBridgeStateValid(self::KEY, substr($state, 0, -1) . '0', self::NOW), 'firma alterada');
        self::assertFalse(panelBridgeStateValid(self::KEY, 'lo-que-sea', self::NOW));
    }

    public function testActorHeaderIsSanitised(): void
    {
        self::assertSame('7:admin?', panelBridgeActor(['HTTP_X_FURRGUARD_ACTOR' => " 7:admin\u{1F43E} "]));
        self::assertSame('', panelBridgeActor([]));
        self::assertSame(str_repeat('a', PANEL_BRIDGE_ACTOR_MAX), panelBridgeActor(['HTTP_X_FURRGUARD_ACTOR' => str_repeat('a', 300)]));
    }
}
