<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Modpacks;

use Pterodactyl\Models\Permission;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

class SwitchModpackEggRequest extends ClientApiRequest
{
    public function permission(): string
    {
        return Permission::ACTION_SETTINGS_RENAME;
    }

    public function rules(): array
    {
        return [
            'target_egg_id' => 'required|integer|exists:eggs,id',
            'mc_version' => 'sometimes|nullable|string|max:32',
            'loader_type' => 'sometimes|nullable|string|in:forge,neoforge,fabric,quilt',
            'loader_version' => 'sometimes|nullable|string|max:64',
        ];
    }
}
