<?php

declare(strict_types=1);

namespace FurrGuard\Tests\Integration;

use PDO;

/**
 * Base de los tests de dominio y endpoints: BD migrada con las tablas de negocio vacías y dobles de
 * ip-api, MaxMind y Mojang (nunca hay red). Por defecto Mojang responde 404 (nadie es premium).
 */
abstract class DomainTestCase extends DatabaseTestCase
{
    protected const UUID = '11111111-2222-4333-8444-555555555555';

    private const TABLES = [
        'blacklist', 'whitelist', 'player_connections', 'player_nicks', 'player_ips', 'players', 'activity_logs',
        'ip_cache', 'ip_api_logs', 'minecraft_profiles', 'minecraft_names_cache', 'blocked_countries',
        'blocked_continents', 'furrsecurity_verifications', 'furrsecurity_logs', 'furrsecurity_failed_attempts',
        'furrsecurity_staff', 'fur_perms_whitelist', 'fur_perms_command_logs', 'admin_sessions',
    ];

    protected PDO $db;
    /** @var array<string, array<string, mixed>|null> ip => respuesta de ip-api (null = sin respuesta) */
    protected array $ipApi = [];
    /** @var array<string, array<string, mixed>> ip => datos de MaxMind */
    protected array $maxmind = [];
    /** @var array<string, array{status: int, body: ?string}> nombre o uuid → respuesta de Mojang */
    protected array $mojang = [];
    protected int $ipApiCalls = 0;
    protected int $mojangCalls = 0;

    protected function setUp(): void
    {
        $this->db = self::migratedDatabase();
        foreach (self::TABLES as $table) {
            $this->db->exec("DELETE FROM {$table}");
        }
        foreach (settingDefinitions() as $key => $definition) {
            if ($definition['default'] !== null && empty($definition['system'])) {
                setSetting($this->db, $key, $definition['default']);
            }
        }
        @unlink(ipApiPauseFile());
        geoUseTestDoubles(function (string $ip): array {
            $this->ipApiCalls++;
            $data = $this->ipApi[$ip] ?? null;
            return $data === null
                ? ['status' => 0, 'headers' => [], 'body' => null]
                : ['status' => 200, 'headers' => ['x-rl' => '40', 'x-ttl' => '60'], 'body' => (string) json_encode($data + ['status' => 'success', 'query' => $ip])];
        }, fn (string $ip): ?array => $this->maxmind[$ip] ?? null);
        minecraftUseHttpClient(function (string $url): array {
            $this->mojangCalls++;
            $response = $this->mojang[strtolower(basename($url))] ?? ['status' => 404, 'body' => null];
            return ['status' => $response['status'], 'headers' => [], 'body' => $response['body']];
        });
        $_SESSION = [];
        $_SERVER['REMOTE_ADDR'] = '203.0.113.50';
    }

    protected function tearDown(): void
    {
        geoUseTestDoubles(null, null);
        minecraftUseHttpClient(null);
        $_SESSION = [];
    }

    protected function premium(string $name, string $uuid): void
    {
        $this->mojang[strtolower($name)] = ['status' => 200, 'body' => (string) json_encode(['id' => str_replace('-', '', $uuid), 'name' => $name])];
        $this->mojang[str_replace('-', '', $uuid)] = $this->mojang[strtolower($name)];
        $this->mojang[$uuid] = $this->mojang[strtolower($name)];
    }

    /**
     * @param array<string, string> $values
     */
    protected function settings(array $values): void
    {
        foreach ($values as $key => $value) {
            setSetting($this->db, $key, $value);
        }
    }

    /**
     * @param list<mixed> $params
     */
    protected function countRows(string $table, string $where = '1 = 1', array $params = []): int
    {
        $stmt = $this->db->prepare("SELECT COUNT(*) FROM {$table} WHERE {$where}");
        $stmt->execute($params);
        return (int) $stmt->fetchColumn();
    }

    /**
     * @param list<mixed> $params
     * @return array<string, mixed>
     */
    protected function row(string $sql, array $params = []): array
    {
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $row = $stmt->fetch();
        self::assertIsArray($row, "Sin fila para: {$sql}");
        return $row;
    }

    /**
     * @return array{uuid: ?string, nick: string, ip: string, game_version: ?string}
     */
    protected function player(?string $uuid = self::UUID, string $nick = 'Player', string $ip = '8.8.8.8'): array
    {
        return ['uuid' => $uuid, 'nick' => $nick, 'ip' => $ip, 'game_version' => '1.21.4'];
    }
}
