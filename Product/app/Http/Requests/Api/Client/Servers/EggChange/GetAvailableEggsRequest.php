<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\EggChange;

use Pterodactyl\Models\Server;
use Pterodactyl\Models\Permission;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;
use Pterodactyl\Services\EggChanger\EggChangerService;

class GetAvailableEggsRequest extends ClientApiRequest
{
    public function permission(): string
    {
        return EggChangerService::getRequiredPermission();
    }

    public function rules(): array
    {
        return [];
    }
}
