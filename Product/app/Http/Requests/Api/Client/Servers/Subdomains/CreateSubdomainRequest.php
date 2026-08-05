<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Subdomains;

use Pterodactyl\Models\Permission;
use Pterodactyl\Contracts\Http\ClientPermissionsRequest;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

class CreateSubdomainRequest extends ClientApiRequest implements ClientPermissionsRequest
{
    public function permission(): string
    {
        return Permission::ACTION_SETTINGS_RENAME;
    }

    public function rules(): array
    {
        return [
            'subdomain' => 'required|string|min:1|max:63|regex:/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i',
            'allocation_id' => 'required|integer',
            'domain' => 'required|string|min:1|max:253',
        ];
    }
}
