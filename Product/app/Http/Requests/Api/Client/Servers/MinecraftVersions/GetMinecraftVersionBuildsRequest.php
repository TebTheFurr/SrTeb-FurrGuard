<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\MinecraftVersions;

use Pterodactyl\Models\Permission;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

class GetMinecraftVersionBuildsRequest extends ClientApiRequest
{
    public function permission(): string
    {
        return Permission::ACTION_FILE_READ;
    }

    public function rules(): array
    {
        return [
            'fork' => 'required|string|in:vanilla,paper,purpur,spigot,folia,forge,neoforge,fabric,quilt,velocity,waterfall,bungeecord',
            'minecraftVersion' => 'sometimes|nullable|string|max:32',
        ];
    }
}
