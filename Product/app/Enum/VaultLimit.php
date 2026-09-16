<?php

declare(strict_types=1);

namespace Pterodactyl\Enum;

use Illuminate\Http\Request;
use Pterodactyl\Models\Server;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Routing\Middleware\ThrottleRequests;

/**
 * Rate limits of the Vault routes, on top of the general client API limit.
 *
 * Jobs that move data (backups, restores, syncs) are limited per server, since
 * each one ends up walking the whole server volume on the node; the login flow
 * and download links are limited per panel user.
 */
enum VaultLimit
{
    case Login;
    case Callback;
    case Download;
    case Links;
    case Backup;
    case Restore;
    case Sync;

    public function throttleKey(): string
    {
        return mb_strtolower("vault:{$this->name}");
    }

    public function middleware(): string
    {
        return ThrottleRequests::using($this->throttleKey());
    }

    public function limit(): Limit
    {
        return match ($this) {
            self::Login => Limit::perMinute(10),
            self::Callback => Limit::perMinute(20),
            self::Download => Limit::perMinute(30),
            self::Links => Limit::perMinute(60),
            self::Backup, self::Restore => Limit::perMinutes(10, 5),
            self::Sync => Limit::perMinutes(10, 10),
        };
    }

    public static function boot(): void
    {
        foreach (self::cases() as $case) {
            RateLimiter::for($case->throttleKey(), function (Request $request) use ($case) {
                $server = $request->route()?->parameter('server');

                $key = $case->perServer() && $server instanceof Server
                    ? 'server:' . $server->uuid
                    : 'user:' . ($request->user()?->id ?? $request->ip());

                return $case->limit()->by($key);
            });
        }
    }

    private function perServer(): bool
    {
        return in_array($this, [self::Backup, self::Restore, self::Sync], true);
    }
}
