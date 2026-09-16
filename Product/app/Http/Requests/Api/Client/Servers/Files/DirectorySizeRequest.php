<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Files;

use Pterodactyl\Models\Permission;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

class DirectorySizeRequest extends ClientApiRequest
{
    /**
     * Reading the size of a directory exposes no more information than listing
     * it does, so the same permission applies.
     */
    public function permission(): string
    {
        return Permission::ACTION_FILE_READ;
    }

    public function rules(): array
    {
        return [
            'directory' => 'required|string',
        ];
    }
}
