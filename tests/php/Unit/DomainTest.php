<?php

declare(strict_types=1);

namespace FurrGuard\Tests\Unit;

use PHPUnit\Framework\TestCase;
use ValidationError;

/**
 * Funciones puras del dominio: proveedores por palabra completa, valores de listas, objetivos de
 * baneos automáticos, detalles de traza y HTML de los SPA.
 */
final class DomainTest extends TestCase
{
    public function testProviderMatchUsesWholeWords(): void
    {
        $index = providerIndex([
            ['id' => 1, 'pattern' => 'aws'],
            ['id' => 2, 'pattern' => 'google'],
            ['id' => 3, 'pattern' => 'Google Cloud'],
            ['id' => 4, 'pattern' => 'servers.com'],
            ['id' => 5, 'pattern' => 'pir'],
            ['id' => 6, 'pattern' => '...'],
        ]);
        self::assertSame(2, $index['max_tokens']);
        self::assertArrayNotHasKey('', $index['keys'], 'un patrón sin letras ni números no se indexa');

        self::assertSame(1, providerMatch($index, ['Amazon AWS, Inc.']));
        self::assertNull(providerMatch($index, ['Lawson Networks', 'Empire Telecom']), 'aws ⊄ Lawson, pir ⊄ Empire');
        self::assertSame(3, providerMatch($index, ['GOOGLE-CLOUD platform']), 'la frase más larga gana');
        self::assertSame(2, providerMatch($index, ['google fiber']));
        self::assertSame(4, providerMatch($index, ['Servers.com, Inc']));
        self::assertNull(providerMatch($index, ['myservers.company']));
        self::assertSame(5, providerMatch($index, ['', 'PIR (Public Interest Registry)']));
        self::assertNull(providerMatch($index, ["\xff\xferoto"]), 'UTF-8 inválido no rompe');
    }

    public function testListValuesAreNormalizedOrRejected(): void
    {
        self::assertSame('069a79f4-44e9-4726-a5be-fca90e38aaf5', normalizeListValue('uuid', '069A79F444E94726A5BEFCA90E38AAF5'));
        self::assertSame('.Bedrock_1', normalizeListValue('nick', ' .Bedrock_1 '));
        self::assertSame('1.2.3.4', normalizeListValue('ip', '::ffff:1.2.3.4'));
        self::assertSame('10.0.0.0/8', normalizeListValue('ip_range', '10.9.8.7/8'));
        self::assertSame('AS3352', normalizeListValue('as', 'as3352 Telefonica'));
        foreach ([['nick', 'bad nick'], ['ip', '1.2.3'], ['ip_range', '10.0.0.0/4'], ['as', 'ASX'], ['uuid', 'nope'], ['cidr', '1.2.3.4/8']] as [$type, $value]) {
            try {
                normalizeListValue($type, $value);
                self::fail("{$type} {$value} debería rechazarse");
            } catch (ValidationError $e) {
                self::assertSame(422, $e->status);
            }
        }
    }

    public function testAutoBanTargets(): void
    {
        self::assertSame(['type' => 'ip', 'value' => '8.8.8.8'], autoBanIpTarget('::ffff:8.8.8.8'));
        self::assertSame(['type' => 'ip_range', 'value' => '2606:4700:10:20::/64'], autoBanIpTarget('2606:4700:10:20:1:2:3:4'));
        self::assertNull(autoBanIpTarget('192.168.1.10'), 'IP privada');
        self::assertNull(autoBanIpTarget('127.0.0.1'), 'IP reservada');
        self::assertNull(autoBanIpTarget('nope'));
        self::assertMatchesRegularExpression('/^[A-Z0-9]{12}\z/', generateBanId());
    }

    public function testActivityDetailsStartWithTypeAndValue(): void
    {
        self::assertSame('uuid: 069a79f4-44e9-4726-a5be-fca90e38aaf5', listActivityDetails('uuid', '069a79f4-44e9-4726-a5be-fca90e38aaf5'));
        $details = listActivityDetails('ip', '2001:db8::1', 'ABC', '', 'Por Grinch');
        self::assertSame('ip: 2001:db8::1 · ABC · Por Grinch', $details);
        self::assertSame('ip: 2001:db8::1', explode(ACTIVITY_DETAILS_SEPARATOR, $details)[0]);
        // Lo que hace el plugin: split("[:=]", 2) → tipo y valor.
        self::assertSame(['ip', ' 2001:db8::1'], preg_split('/[:=]/', 'ip: 2001:db8::1', 2));
    }

    public function testCountryContinentAndBanStates(): void
    {
        self::assertSame('EU', countryContinent('es'));
        self::assertSame('SA', countryContinent('AR'));
        self::assertSame('AS', countryContinent('SA'), 'Arabia Saudí es Asia');
        self::assertNull(countryContinent('ZZ'));
        self::assertSame('(b.active = 1 AND (b.expires_at IS NULL OR b.expires_at > NOW()))', banInForceSql('b'));
        self::assertSame('(1 = 1)', banStateSql('all'));
    }

    public function testSpaHtmlAddsNonceAndBootScriptBeforeModule(): void
    {
        $html = "<head>\n  <script type=\"module\" crossorigin src=\"/admin/assets/index.js\"></script>\n  <script>legacy()</script>\n</head>";
        $out = spaHtml($html, 'abc+/=', 'window.__FURRGUARD__ = ' . spaJson(['x' => '</script><script>alert(1)</script>', 'y' => "O'Neil & \"co\""]) . ';');
        self::assertSame(3, substr_count($out, '<script nonce="abc+/="'));
        self::assertLessThan(strpos($out, 'type="module"'), strpos($out, 'window.__FURRGUARD__'));
        self::assertStringNotContainsString('</script><script>alert', $out);
        self::assertStringContainsString(chr(92) . 'u003C/script' . chr(92) . 'u003E', $out, '< y > escapados');
        self::assertStringContainsString(chr(92) . 'u0027', $out, 'comilla simple escapada');
        self::assertStringContainsString(chr(92) . 'u0026', $out, '& escapado');
        self::assertStringNotContainsString('nonce="abc+/=" nonce=', $out);

        $plain = spaHtml('<html><head><title>x</title></head></html>', 'n', 'boot()');
        self::assertStringContainsString('<script nonce="n">boot()</script>', $plain);
        self::assertLessThan(strpos($plain, '</head>'), strpos($plain, 'boot()'));
    }
}
