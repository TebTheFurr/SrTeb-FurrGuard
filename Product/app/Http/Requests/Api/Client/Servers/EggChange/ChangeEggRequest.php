<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\EggChange;

use Pterodactyl\Models\Permission;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;
use Pterodactyl\Services\EggChanger\EggChangerService;

class ChangeEggRequest extends ClientApiRequest
{
    public function permission(): string
    {
        return EggChangerService::getRequiredPermission();
    }

    public function rules(): array
    {
        return [
            'egg_id' => 'required|integer|exists:eggs,id',
            'reinstall' => 'boolean',
            'change_startup' => 'boolean',
            'clear_files' => 'boolean',
        ];
    }
}
