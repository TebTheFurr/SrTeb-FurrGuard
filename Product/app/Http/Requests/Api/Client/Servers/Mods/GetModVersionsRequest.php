<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Mods;

use Pterodactyl\Models\Permission;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

class GetModVersionsRequest extends ClientApiRequest
{
    public function permission(): string
    {
        return Permission::ACTION_FILE_READ;
    }

    public function rules(): array
    {
        return [
            'game' => 'sometimes|nullable|string|in:minecraft,hytale',
            'platform' => 'required|string|in:modrinth,curseforge',
            'modId' => 'required|string|max:255',
            'gameVersion' => 'sometimes|nullable|string|max:50',
            'loader' => 'sometimes|nullable|string|max:50',
        ];
    }
}
