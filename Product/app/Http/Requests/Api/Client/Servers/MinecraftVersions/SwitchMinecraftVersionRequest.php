<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\MinecraftVersions;

use Pterodactyl\Models\Permission;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

class SwitchMinecraftVersionRequest extends ClientApiRequest
{
    public function permission(): string
    {
        return Permission::ACTION_SETTINGS_RENAME;
    }

    public function rules(): array
    {
        return [
            'fork' => 'required|string|in:vanilla,paper,purpur,spigot,folia,forge,neoforge,fabric,quilt,velocity,waterfall,bungeecord',
            'minecraftVersion' => 'sometimes|nullable|string|max:32',
            'versionName' => 'sometimes|nullable|string|max:191',
            'buildId' => 'sometimes|nullable|string|max:128',
            'buildName' => 'sometimes|nullable|string|max:191',
            'downloadName' => 'sometimes|nullable|string|max:191',
            'buildType' => 'sometimes|nullable|string|max:32',
            'javaVersion' => 'sometimes|nullable|integer|min:1|max:99',
            'targetEggId' => 'sometimes|nullable|integer|exists:eggs,id',
            'cleanupMode' => 'sometimes|nullable|string|in:none,smart,full',
            'writeEula' => 'sometimes|boolean',
        ];
    }
}
