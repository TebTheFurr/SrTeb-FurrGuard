<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Modpacks;

use Pterodactyl\Models\Permission;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

class GetModpackVersionsRequest extends ClientApiRequest
{
    public function permission(): string
    {
        return Permission::ACTION_FILE_READ;
    }

    public function rules(): array
    {
        return [
            'platform' => 'required|string|in:modrinth,curseforge',
            'modpackId' => 'required|string|max:255',
            'gameVersion' => 'sometimes|nullable|string|max:20',
            'loader' => 'sometimes|nullable|string|max:50',
        ];
    }
}
