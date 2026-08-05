<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Modpacks;

use Pterodactyl\Models\Permission;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

class GetModpackDownloadUrlRequest extends ClientApiRequest
{
    public function permission(): string
    {
        return Permission::ACTION_FILE_CREATE;
    }

    public function rules(): array
    {
        return [
            'platform' => 'required|string|in:modrinth,curseforge',
            'modpackId' => 'required|string|max:255',
            'versionId' => 'required|string|max:255',
        ];
    }
}
