<?php

declare(strict_types=1);

namespace Pterodactyl\Services\Vault;

use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Pterodactyl\Models\User;
use Pterodactyl\Models\Server;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Cache;

/**
 * Short-lived download tickets for `/vault/descarga/{ticket}`.
 *
 * The URL handed to the browser is a Laravel signed URL valid for five minutes;
 * what it downloads (and for whom) is kept server-side in the cache, so the
 * link cannot be edited to point elsewhere and is useless to any other panel
 * user even if it leaks.
 */
class VaultDownloadTickets
{
    public const TTL_SECONDS = 300;

    public const TIPO_ARCHIVO = 'archivo';
    public const TIPO_ZIP = 'zip';

    public const TICKET_PATTERN = '[A-Za-z0-9]{40}';

    private const CACHE_PREFIX = 'vault:descarga:';

    public function forFile(User $user, Server $server, string $carpeta, string $ruta): string
    {
        return $this->issue([
            'tipo' => self::TIPO_ARCHIVO,
            'usuario' => $user->id,
            'servidor' => $server->id,
            'carpeta' => $carpeta,
            'ruta' => $ruta,
        ]);
    }

    public function forZip(User $user, Server $server, string $billete): string
    {
        return $this->issue([
            'tipo' => self::TIPO_ZIP,
            'usuario' => $user->id,
            'servidor' => $server->id,
            'billete' => $billete,
        ]);
    }

    /**
     * @return array{tipo: string, usuario: int, servidor: int}|null
     */
    public function resolve(string $ticket): ?array
    {
        $payload = Cache::get(self::CACHE_PREFIX . $ticket);

        return is_array($payload) && isset($payload['tipo'], $payload['usuario'], $payload['servidor']) ? $payload : null;
    }

    public function consume(string $ticket): void
    {
        Cache::forget(self::CACHE_PREFIX . $ticket);
    }

    /**
     * Returns the relative signed URL for a new ticket.
     */
    private function issue(array $payload): string
    {
        $ticket = Str::random(40);
        $expires = CarbonImmutable::now()->addSeconds(self::TTL_SECONDS);

        Cache::put(self::CACHE_PREFIX . $ticket, $payload, $expires);

        return URL::temporarySignedRoute('vault.descarga', $expires, ['ticket' => $ticket], false);
    }
}
