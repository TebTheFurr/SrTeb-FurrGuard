<?php

declare(strict_types=1);

namespace FurrGuard\Tests\Unit;

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class IdentityTest extends TestCase
{
    /**
     * @return iterable<string, array{?string, ?string}>
     */
    public static function uuids(): iterable
    {
        yield 'sin guiones' => ['7AAA768D415A4F7DBACBC1D2A8ADD707', '7aaa768d-415a-4f7d-bacb-c1d2a8add707'];
        yield 'canónico con espacios' => [' 7aaa768d-415a-4f7d-bacb-c1d2a8add707 ', '7aaa768d-415a-4f7d-bacb-c1d2a8add707'];
        yield 'guiones mal colocados' => ['7aaa768d4-15a-4f7d-bacb-c1d2a8add707', null];
        yield 'no hex' => ['zaaa768d-415a-4f7d-bacb-c1d2a8add707', null];
        yield 'corto' => ['7aaa768d', null];
        yield 'salto final' => ["7aaa768d415a4f7dbacbc1d2a8add707\n", '7aaa768d-415a-4f7d-bacb-c1d2a8add707'];
        yield 'vacío' => ['', null];
        yield 'null' => [null, null];
    }

    #[DataProvider('uuids')]
    public function testNormalizeUuid(?string $input, ?string $expected): void
    {
        self::assertSame($expected, normalizeUuid($input));
    }

    /**
     * @return iterable<string, array{?string, ?string}>
     */
    public static function ips(): iterable
    {
        yield 'ipv4' => ['1.2.3.4', '1.2.3.4'];
        yield 'ipv4 mapeada' => ['::ffff:1.2.3.4', '1.2.3.4'];
        yield 'ipv4 mapeada hex' => ['::ffff:0102:0304', '1.2.3.4'];
        yield 'ipv6 comprimida' => ['2001:0DB8:0000:0000:0000:0000:0000:0001', '2001:db8::1'];
        yield 'ipv6 con zona' => ['fe80::1%eth0', 'fe80::1'];
        yield 'ceros a la izquierda' => ['01.2.3.4', null];
        yield 'basura' => ['not-an-ip', null];
        yield 'rango' => ['1.2.3.0/24', null];
        yield 'ipv4 con %' => ['1.2.3.4%eth0', null];
    }

    #[DataProvider('ips')]
    public function testNormalizeIp(?string $input, ?string $expected): void
    {
        self::assertSame($expected, normalizeIp($input));
    }

    /**
     * @return iterable<string, array{string, ?string}>
     */
    public static function cidrs(): iterable
    {
        yield 'red canónica' => ['10.1.2.3/8', '10.0.0.0/8'];
        yield 'ipv4 /32' => ['1.2.3.4/32', '1.2.3.4/32'];
        yield 'ipv4 prefijo demasiado amplio' => ['10.0.0.0/7', null];
        yield 'ipv4 prefijo > 32' => ['1.2.3.4/33', null];
        yield 'ipv6 /64' => ['2001:db8:1:2:3:4:5:6/64', '2001:db8:1:2::/64'];
        yield 'ipv6 /16 mínimo' => ['2001:db8::/16', '2001::/16'];
        yield 'ipv6 prefijo demasiado amplio' => ['2001:db8::/15', null];
        yield 'mapeada a ipv4' => ['::ffff:10.9.8.7/104', '10.0.0.0/8'];
        yield 'mapeada demasiado amplia' => ['::ffff:10.9.8.7/100', null];
        yield 'sin prefijo' => ['1.2.3.4', null];
        yield 'prefijo no numérico' => ['1.2.3.4/abc', null];
        yield 'prefijo vacío' => ['1.2.3.4/', null];
        yield 'bits en medio de un octeto' => ['192.168.77.1/20', '192.168.64.0/20'];
    }

    #[DataProvider('cidrs')]
    public function testNormalizeCidr(string $input, ?string $expected): void
    {
        self::assertSame($expected, normalizeCidr($input));
    }

    public function testNormalizeAsn(): void
    {
        self::assertSame('AS1234', normalizeAsn('AS1234'));
        self::assertSame('AS1234', normalizeAsn('as1234'));
        self::assertSame('AS1234', normalizeAsn('1234'));
        self::assertSame('AS1234', normalizeAsn('AS 01234'));
        self::assertSame('AS3352', normalizeAsn('AS3352 Telefonica de Espana SAU'));
        self::assertSame('AS4294967295', normalizeAsn('4294967295'));
        self::assertNull(normalizeAsn('4294967296'));
        self::assertNull(normalizeAsn('AS0'));
        self::assertNull(normalizeAsn('1234abc'));
        self::assertNull(normalizeAsn('ASX'));
        self::assertNull(normalizeAsn(''));
        self::assertNull(normalizeAsn(null));
    }

    public function testIsValidNick(): void
    {
        self::assertTrue(isValidNick('Steve_123'));
        self::assertTrue(isValidNick('a'));
        self::assertTrue(isValidNick('.BedrockPlayer12'));
        self::assertTrue(isValidNick('*Bedrock'));
        self::assertTrue(isValidNick('abcdefghijklmnop'));
        self::assertFalse(isValidNick('abcdefghijklmnopq'));
        self::assertFalse(isValidNick('.abcdefghijklmnop'));
        self::assertFalse(isValidNick('.'));
        self::assertFalse(isValidNick('ab..c'));
        self::assertFalse(isValidNick("Steve\n"));
        self::assertFalse(isValidNick('Stève'));
        self::assertFalse(isValidNick(''));
    }

    public function testIpInCidr(): void
    {
        self::assertTrue(ipInCidr('10.20.30.40', '10.0.0.0/8'));
        self::assertTrue(ipInCidr('::ffff:10.20.30.40', '10.0.0.0/8'));
        self::assertFalse(ipInCidr('11.0.0.1', '10.0.0.0/8'));
        self::assertTrue(ipInCidr('1.2.3.4', '1.2.3.4'));
        self::assertTrue(ipInCidr('2001:db8::1', '2001:db8::/32'));
        self::assertFalse(ipInCidr('2001:db9::1', '2001:db8::/32'));
        self::assertFalse(ipInCidr('10.0.0.1', '2001:db8::/32'));
        self::assertTrue(ipInCidr('203.0.113.9', '0.0.0.0/0'));
        // Un prefijo inválido no debe convertirse en /0 (antes (int)"abc" = 0 aceptaba todo).
        self::assertFalse(ipInCidr('203.0.113.9', '10.0.0.0/abc'));
        self::assertFalse(ipInCidr('203.0.113.9', '10.0.0.0/'));
        self::assertFalse(ipInCidr('203.0.113.9', '10.0.0.0/33'));
        self::assertFalse(ipInCidr('garbage', '10.0.0.0/8'));
    }

    public function testIpScopes(): void
    {
        self::assertSame('2001:db8:1:2::/64', ipv6Prefix64Cidr('2001:db8:1:2:aaaa:bbbb:cccc:dddd'));
        self::assertNull(ipv6Prefix64Cidr('1.2.3.4'));
        self::assertSame('1.2.3.4', ipScopeKey('::ffff:1.2.3.4'));
        self::assertTrue(sameIpScope('2001:db8:1:2::1', '2001:db8:1:2:ffff::9'));
        self::assertFalse(sameIpScope('2001:db8:1:2::1', '2001:db8:1:3::1'));
        self::assertTrue(sameIpScope('1.2.3.4', '::ffff:1.2.3.4'));
        self::assertFalse(sameIpScope('1.2.3.4', '1.2.3.5'));
        self::assertFalse(sameIpScope('1.2.3.4', null));
        self::assertFalse(sameIpScope('bad', 'bad'));
        self::assertSame('ipv6', ipFamily('2001:db8::1'));
        self::assertSame('ipv4', ipFamily('::ffff:1.2.3.4'));
        self::assertNull(ipFamily('x'));
    }
}
