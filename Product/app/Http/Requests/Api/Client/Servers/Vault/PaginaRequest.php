<?php

declare(strict_types=1);

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Vault;

/**
 * Listings of jobs and activity (`?limite` and, for activity, `?cursor`).
 */
class PaginaRequest extends VaultRequest
{
    public function rules(): array
    {
        return [
            'cursor' => ['nullable', 'string', 'max:512'],
            'limite' => ['nullable', 'integer', 'min:1', 'max:200'],
        ];
    }
}
