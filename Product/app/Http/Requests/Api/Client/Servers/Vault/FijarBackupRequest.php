<?php

declare(strict_types=1);

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Vault;

class FijarBackupRequest extends VaultRequest
{
    public function rules(): array
    {
        return [
            'fijada' => ['required', 'boolean'],
        ];
    }
}
