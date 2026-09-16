<?php

declare(strict_types=1);

namespace Pterodactyl\Services\Vault;

use Pterodactyl\Models\User;
use Pterodactyl\Models\Server;

/**
 * Server access checks for the Vault web routes, which live outside the client
 * API and therefore outside its AuthenticateServerAccess middleware.
 */
class VaultAccessService
{
    public const SHORT_REGEX = '/^[0-9a-f]{8}$/';

    /**
     * The server with that uuidShort if the user may use its Vault section:
     * owner, subuser or root admin (exactly like the client API), the server is
     * not suspended and the Vault is enabled for it.
     */
    public function findUsableServer(User $user, mixed $short): ?Server
    {
        if (!is_string($short) || preg_match(self::SHORT_REGEX, $short) !== 1) {
            return null;
        }

        $server = Server::query()->with('vaultServer')->where('uuidShort', $short)->first();

        return $server instanceof Server && $this->canUse($user, $server) ? $server : null;
    }

    public function canUse(User $user, Server $server): bool
    {
        return $this->canAccess($user, $server) && !$server->isSuspended() && $server->hasVaultEnabled();
    }

    public function canAccess(User $user, Server $server): bool
    {
        if ($user->root_admin || $server->owner_id === $user->id) {
            return true;
        }

        return $server->subusers()->where('user_id', $user->id)->exists();
    }
}
