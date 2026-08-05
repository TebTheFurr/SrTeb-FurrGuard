<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Subdomains;

use Pterodactyl\Models\Permission;
use Pterodactyl\Contracts\Http\ClientPermissionsRequest;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

class CheckSubdomainRequest extends ClientApiRequest implements ClientPermissionsRequest
{
    public function permission(): string
    {
        return Permission::ACTION_SETTINGS_RENAME;
    }

    public function rules(): array
    {
        return [
            'subdomain' => 'required|string|min:1|max:63',
            'domain' => 'required|string|min:1|max:253',
        ];
    }
}
