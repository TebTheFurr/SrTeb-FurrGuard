<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Mods;

use Pterodactyl\Models\Permission;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

class SearchModsRequest extends ClientApiRequest
{
    public function permission(): string
    {
        return Permission::ACTION_FILE_READ;
    }

    public function rules(): array
    {
        return [
            'game' => 'sometimes|nullable|string|in:minecraft,hytale',
            'query' => 'sometimes|nullable|string|max:255',
            'platforms' => 'sometimes|array',
            'platforms.*' => 'string|in:modrinth,curseforge',
            'gameVersion' => 'sometimes|nullable|string|max:50',
            'loader' => 'sometimes|nullable|string|max:50',
            'category' => 'sometimes|nullable|integer|min:1',
            'page' => 'sometimes|integer|min:1',
            'pageSize' => 'sometimes|integer|min:1|max:50',
        ];
    }
}
