<?php

declare(strict_types=1);

namespace FurrGuard\Tests\Unit;

use HttpError;
use PHPUnit\Framework\TestCase;
use ValidationError;

final class EnvAndHttpTest extends TestCase
{
    public function testParseEnvFile(): void
    {
        $vars = parseEnvFile(<<<'ENV'
            # comentario
            APP_URL=https://furrguard.srteb.eu   # comentario al final
            export DB_NAME=furrguard
            QUOTED="valor con # almohadilla y \"comillas\"\nsegunda"
            SINGLE='literal \n sin escapes # ni comentarios'
            EMPTY=
            PASSWORD=abc#def
            1INVALID=x
            ENV);
        self::assertSame('https://furrguard.srteb.eu', $vars['APP_URL']);
        self::assertSame('furrguard', $vars['DB_NAME']);
        self::assertSame("valor con # almohadilla y \"comillas\"\nsegunda", $vars['QUOTED']);
        self::assertSame('literal \n sin escapes # ni comentarios', $vars['SINGLE']);
        self::assertSame('', $vars['EMPTY']);
        self::assertSame('abc#def', $vars['PASSWORD']);
        self::assertArrayNotHasKey('1INVALID', $vars);
    }

    public function testLoadEnvDoesNotOverrideRealEnvironment(): void
    {
        $file = tempnam(sys_get_temp_dir(), 'fgenv');
        self::assertIsString($file);
        file_put_contents($file, "FG_TEST_REAL=from_file\nFG_TEST_ONLY_FILE=file\n");
        putenv('FG_TEST_REAL=real');
        try {
            loadEnv($file);
            self::assertSame('real', env('FG_TEST_REAL'));
            self::assertSame('file', env('FG_TEST_ONLY_FILE'));
        } finally {
            putenv('FG_TEST_REAL');
            putenv('FG_TEST_ONLY_FILE');
            unset($_ENV['FG_TEST_ONLY_FILE']);
            unlink($file);
        }
    }

    public function testParseJsonObject(): void
    {
        self::assertSame(['action' => 'x'], parseJsonObject(' {"action":"x"}'));
        self::assertSame([], parseJsonObject('{}'));
        foreach (['[]', '"x"', '{bad', '', 'null'] as $raw) {
            try {
                parseJsonObject($raw);
                self::fail("Debería rechazar {$raw}");
            } catch (HttpError $e) {
                self::assertSame(400, $e->status);
            }
        }
    }

    public function testStringAccessors(): void
    {
        $in = ['name' => '  Steve ', 'empty' => '   ', 'num' => 42, 'list' => ['a'], 'long' => str_repeat('á', 11)];
        self::assertSame('Steve', inputString($in, 'name'));
        self::assertSame('42', inputString($in, 'num'));
        self::assertNull(inputOptionalString($in, 'empty'));
        self::assertNull(inputOptionalString($in, 'missing'));
        self::assertSame('def', inputString($in, 'missing', default: 'def'));
        $this->assertValidationError(static fn () => inputString($in, 'missing'), 'missing');
        $this->assertValidationError(static fn () => inputString($in, 'list'), 'list');
        $this->assertValidationError(static fn () => inputString($in, 'long', 10), 'long');
        $this->assertValidationError(static fn () => inputString(['bad' => "\xff"], 'bad'), 'bad');
    }

    public function testIntBoolEnumArrayAccessors(): void
    {
        $in = ['page' => '3', 'neg' => -5, 'float' => 1.5, 'big' => '99999999999999999999', 'flag' => 'true', 'zero' => 0,
            'type' => 'uuid', 'players' => '[{"uuid":"a"}]', 'arr' => [1, 2, 3]];
        self::assertSame(3, inputInt($in, 'page', 1, 10));
        self::assertSame(-5, inputInt($in, 'neg'));
        self::assertSame(7, inputInt($in, 'missing', default: 7));
        $this->assertValidationError(static fn () => inputInt($in, 'float'), 'float');
        $this->assertValidationError(static fn () => inputInt($in, 'big'), 'big');
        $this->assertValidationError(static fn () => inputInt($in, 'page', 1, 2), 'page');
        self::assertTrue(inputBool($in, 'flag'));
        self::assertFalse(inputBool($in, 'zero'));
        self::assertTrue(inputBool($in, 'missing', true));
        $this->assertValidationError(static fn () => inputBool(['b' => 'yes'], 'b'), 'b');
        self::assertSame('uuid', inputEnum($in, 'type', ['uuid', 'nick']));
        $this->assertValidationError(static fn () => inputEnum($in, 'type', ['ip']), 'type');
        self::assertSame([['uuid' => 'a']], inputArray($in, 'players'));
        $this->assertValidationError(static fn () => inputArray($in, 'arr', 2), 'arr');
        $this->assertValidationError(static fn () => inputArray(['p' => 'nope'], 'p'), 'p');
    }

    public function testPagination(): void
    {
        self::assertSame(['page' => 1, 'per_page' => 25, 'offset' => 0], paginationParams([]));
        self::assertSame(['page' => 3, 'per_page' => 10, 'offset' => 20], paginationParams(['page' => 3, 'per_page' => '10']));
        $this->assertValidationError(static fn () => paginationParams(['per_page' => 101]), 'per_page');
        $this->assertValidationError(static fn () => paginationParams(['page' => 0]), 'page');
        $result = paginatedResult([['id' => 1]], 51, ['page' => 2, 'per_page' => 25]);
        self::assertSame(['page' => 2, 'per_page' => 25, 'total' => 51, 'total_pages' => 3], $result['pagination']);
        self::assertSame(1, paginatedResult([], 0, ['page' => 1, 'per_page' => 25])['pagination']['total_pages']);
    }

    public function testResponseBodies(): void
    {
        self::assertSame(['success' => true, 'data' => ['x' => 1]], panelOkBody(['x' => 1]));
        self::assertSame(['success' => false, 'error' => 'No', 'code' => 'forbidden'], panelErrorBody('No', 'forbidden'));
        self::assertSame(['error' => 'invalid_api_key', 'message' => 'Mal', 'retry_after' => 5], pluginErrorBody('invalid_api_key', 'Mal', ['retry_after' => 5]));
    }

    private function assertValidationError(callable $fn, string $field): void
    {
        try {
            $fn();
            self::fail('Se esperaba ValidationError');
        } catch (ValidationError $e) {
            self::assertSame($field, $e->field);
            self::assertSame(422, $e->status);
        }
    }
}
