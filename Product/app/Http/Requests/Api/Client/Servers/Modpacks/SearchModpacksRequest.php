<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Modpacks;

use Pterodactyl\Models\Permission;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

class SearchModpacksRequest extends ClientApiRequest
{
    public function permission(): string
    {
        return Permission::ACTION_FILE_READ;
    }

    public function rules(): array
    {
        return [
            'query' => 'sometimes|nullable|string|max:255',
            'platforms' => 'sometimes|array',
            'platforms.*' => 'string|in:modrinth,curseforge',
            'gameVersion' => 'sometimes|nullable|string|max:20',
            'loader' => 'sometimes|nullable|string|max:50',
            'page' => 'sometimes|integer|min:1',
            'pageSize' => 'sometimes|integer|min:1|max:50',
        ];
    }
}
