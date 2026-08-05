<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\ReverseProxy;

use Pterodactyl\Models\Permission;
use Pterodactyl\Contracts\Http\ClientPermissionsRequest;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

class CheckDomainRequest extends ClientApiRequest implements ClientPermissionsRequest
{
    public function permission(): string
    {
        return Permission::ACTION_SETTINGS_RENAME;
    }

    public function rules(): array
    {
        return [
            'domain' => 'required|string|max:255',
            'allocation_id' => 'nullable|integer|exists:allocations,id',
        ];
    }
}
