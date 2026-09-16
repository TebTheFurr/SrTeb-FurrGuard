<?php

declare(strict_types=1);

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Vault;

use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

/**
 * Base request for the Vault endpoints.
 *
 * There is no Pterodactyl subuser permission on purpose: panel access to the
 * server is checked by the route group and what the user may do inside the
 * Vault is decided by the vault from their Discord identity and level.
 */
class VaultRequest extends ClientApiRequest
{
    public const CARPETAS = ['Global', 'Mundos', 'Backups', 'M-Backups'];

    public const CARPETAS_BACKUP = ['Backups', 'M-Backups'];

    /** Relative path as the vault accepts it (§6.3): at most 4096 bytes. */
    protected const MAX_PATH_LENGTH = 4096;

    public function rules(): array
    {
        return [];
    }
}
