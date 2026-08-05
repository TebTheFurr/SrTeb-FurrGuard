<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Files;

use Pterodactyl\Models\Permission;
use Pterodactyl\Contracts\Http\ClientPermissionsRequest;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Files\Concerns\ValidatesFileExclusions;

class PullFileRequest extends ClientApiRequest implements ClientPermissionsRequest
{
    use ValidatesFileExclusions;

    public function permission(): string
    {
        return Permission::ACTION_FILE_CREATE;
    }

    public function rules(): array
    {
        return [
            'url' => 'required|string|url',
            'directory' => 'nullable|string',
            'filename' => 'nullable|string',
            'use_header' => 'boolean',
            'foreground' => 'boolean',
        ];
    }

    protected function passedValidation(): void
    {
        if ($this->filled('filename')) {
            $this->validateFileAccessForRoot($this->input('directory'), (string) $this->input('filename'));

            return;
        }

        $path = (string) parse_url((string) $this->input('url'), PHP_URL_PATH);

        if ($path !== '') {
            $this->validateFileAccessForRoot($this->input('directory'), basename($path));
        }
    }
}
