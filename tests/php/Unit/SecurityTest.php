<?php

declare(strict_types=1);

namespace FurrGuard\Tests\Unit;

use PHPUnit\Framework\TestCase;

final class SecurityTest extends TestCase
{
    public function testClientIpDirect(): void
    {
        self::assertSame('203.0.113.5', getClientIp(['REMOTE_ADDR' => '203.0.113.5', 'HTTP_X_FORWARDED_FOR' => '1.1.1.1'], []));
        self::assertSame('1.2.3.4', getClientIp(['REMOTE_ADDR' => '::ffff:1.2.3.4'], []));
        self::assertSame('0.0.0.0', getClientIp([], []));
    }

    public function testCloudflareHeaderOnlyFromCloudflare(): void
    {
        $spoofed = ['REMOTE_ADDR' => '203.0.113.5', 'HTTP_CF_CONNECTING_IP' => '9.9.9.9'];
        self::assertSame('203.0.113.5', getClientIp($spoofed, []));
        $fromCf = ['REMOTE_ADDR' => '172.64.1.1', 'HTTP_CF_CONNECTING_IP' => '2001:DB8::5'];
        self::assertSame('2001:db8::5', getClientIp($fromCf, []));
        $badHeader = ['REMOTE_ADDR' => '172.64.1.1', 'HTTP_CF_CONNECTING_IP' => 'nope'];
        self::assertSame('172.64.1.1', getClientIp($badHeader, []));
    }

    public function testTrustedProxiesWalkRightToLeft(): void
    {
        $trusted = ['10.0.0.0/8', '192.168.1.10'];
        // El cliente escribe la entrada izquierda; el proxy añade la IP real a la derecha (M4).
        $server = ['REMOTE_ADDR' => '10.0.0.2', 'HTTP_X_FORWARDED_FOR' => '6.6.6.6, 198.51.100.7'];
        self::assertSame('198.51.100.7', getClientIp($server, $trusted));
        // Dos proxies de confianza encadenados.
        $server = ['REMOTE_ADDR' => '10.0.0.2', 'HTTP_X_FORWARDED_FOR' => '6.6.6.6, 198.51.100.7, 192.168.1.10'];
        self::assertSame('198.51.100.7', getClientIp($server, $trusted));
        // Todo de confianza: la más a la izquierda.
        $server = ['REMOTE_ADDR' => '10.0.0.2', 'HTTP_X_FORWARDED_FOR' => '10.1.1.1, 10.2.2.2'];
        self::assertSame('10.1.1.1', getClientIp($server, $trusted));
        // Entrada inválida: se para en el último salto válido.
        $server = ['REMOTE_ADDR' => '10.0.0.2', 'HTTP_X_FORWARDED_FOR' => '6.6.6.6, basura'];
        self::assertSame('10.0.0.2', getClientIp($server, $trusted));
        // REMOTE_ADDR que no es de confianza: X-Forwarded-For se ignora.
        $server = ['REMOTE_ADDR' => '198.51.100.99', 'HTTP_X_FORWARDED_FOR' => '6.6.6.6'];
        self::assertSame('198.51.100.99', getClientIp($server, $trusted));
        // Proxy propio detrás de Cloudflare.
        $server = ['REMOTE_ADDR' => '10.0.0.2', 'HTTP_X_FORWARDED_FOR' => '6.6.6.6, 172.64.1.1', 'HTTP_CF_CONNECTING_IP' => '198.51.100.8'];
        self::assertSame('198.51.100.8', getClientIp($server, $trusted));
    }

    public function testLikePattern(): void
    {
        self::assertSame('%a\%b\_c\\\\d%', likePattern('a%b_c\d'));
        self::assertSame('%Steve%', likePattern('Steve'));
    }

    public function testContentSecurityPolicy(): void
    {
        $csp = buildContentSecurityPolicy('abc', false);
        self::assertStringContainsString("script-src 'self' 'nonce-abc';", $csp);
        self::assertStringContainsString("frame-ancestors 'none'", $csp);
        self::assertStringContainsString("form-action 'self' https://discord.com", $csp);
        foreach (['unpkg', 'unsafe-eval', 'script-src-attr', 'crafatar', 'mineskin', 'googleapis', 'gstatic', 'localhost'] as $forbidden) {
            self::assertStringNotContainsString($forbidden, $csp);
        }
        self::assertStringContainsString('ws://localhost:5173', buildContentSecurityPolicy('abc', true));
    }

    public function testSensitivePaths(): void
    {
        self::assertTrue(isSensitivePath('/admin/api.php', '/admin/api.php'));
        self::assertTrue(isSensitivePath('/admin/index.php', '/admin/players?x=1'));
        self::assertTrue(isSensitivePath('/verify.php', '/verify.php?token=abc'));
        self::assertFalse(isSensitivePath('/index.php', '/'));
    }

    public function testOriginOf(): void
    {
        self::assertSame('https://furrguard.srteb.eu', originOf('https://FurrGuard.srteb.eu:443/admin/'));
        self::assertSame('http://localhost:8080', originOf('http://localhost:8080'));
        self::assertSame('', originOf('null'));
    }

    public function testAdminApiRequestRules(): void
    {
        $token = str_repeat('a', 64);
        $origin = 'https://furrguard.test';
        $valid = [
            'REQUEST_METHOD' => 'POST',
            'CONTENT_TYPE' => 'application/json; charset=utf-8',
            'HTTP_X_CSRF_TOKEN' => $token,
            'HTTP_ORIGIN' => 'https://furrguard.test',
            'HTTP_SEC_FETCH_SITE' => 'same-origin',
        ];
        self::assertTrue(isValidAdminApiRequest($valid, $token, $origin));
        unset($valid['HTTP_ORIGIN'], $valid['HTTP_SEC_FETCH_SITE']);
        self::assertTrue(isValidAdminApiRequest($valid, $token, $origin), 'Origin y Sec-Fetch-Site son opcionales');

        $cases = [
            'GET' => ['REQUEST_METHOD' => 'GET'],
            'form' => ['CONTENT_TYPE' => 'application/x-www-form-urlencoded'],
            'text/plain (CSRF simple)' => ['CONTENT_TYPE' => 'text/plain'],
            'token distinto' => ['HTTP_X_CSRF_TOKEN' => str_repeat('b', 64)],
            'sin token' => ['HTTP_X_CSRF_TOKEN' => null],
            'otro origen' => ['HTTP_ORIGIN' => 'https://evil.test'],
            'origin null' => ['HTTP_ORIGIN' => 'null'],
            'cross-site' => ['HTTP_SEC_FETCH_SITE' => 'cross-site'],
        ];
        foreach ($cases as $label => $override) {
            $server = array_filter($override + $valid, static fn ($v) => $v !== null);
            self::assertFalse(isValidAdminApiRequest($server, $token, $origin), $label);
        }
        self::assertFalse(isValidAdminApiRequest($valid, null, $origin), 'sin token en sesión');
        self::assertFalse(isValidAdminApiRequest($valid + ['HTTP_ORIGIN' => 'https://furrguard.test'], $token, ''), 'APP_URL vacía con Origin');
    }

    public function testCsrfTokenLifecycle(): void
    {
        $_SESSION = [];
        $token = csrfToken();
        self::assertSame(64, strlen($token));
        self::assertSame($token, csrfToken());
        self::assertTrue(validateCsrfToken($token));
        self::assertFalse(validateCsrfToken('x'));
        self::assertFalse(validateCsrfToken(null));
        $rotated = rotateCsrfToken();
        self::assertNotSame($token, $rotated);
        self::assertFalse(validateCsrfToken($token));
        $_SESSION = [];
    }

    public function testApiKeyMatches(): void
    {
        $key = 'fg_' . str_repeat('ab', 24);
        self::assertTrue(apiKeyMatches(apiKeyHash($key), $key));
        self::assertFalse(apiKeyMatches(apiKeyHash($key), $key . 'x'));
        self::assertFalse(apiKeyMatches(null, $key));
        self::assertFalse(apiKeyMatches(apiKeyHash(API_KEY_PLACEHOLDER), API_KEY_PLACEHOLDER), 'la clave de ejemplo nunca vale (C5)');
        self::assertFalse(apiKeyMatches(apiKeyHash(''), ''));
    }

    public function testRolePermissionsMatchContract(): void
    {
        self::assertFalse(hasPermission('founder', 'modules'));
        self::assertTrue(hasPermission('owner', 'furrsecurity'));
        self::assertFalse(hasPermission('owner', 'settings'));
        self::assertFalse(hasPermission('manager', 'logs'));
        self::assertSame(['overview', 'players', 'whitelist', 'blacklist', 'sanctions'], rolePermissions('admin'));
        self::assertSame([], rolePermissions('nobody'));
    }
}
