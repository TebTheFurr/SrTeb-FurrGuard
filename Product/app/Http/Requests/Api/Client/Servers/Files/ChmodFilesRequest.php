<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Files;

use Pterodactyl\Models\Permission;
use Pterodactyl\Contracts\Http\ClientPermissionsRequest;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Files\Concerns\ValidatesFileExclusions;

class ChmodFilesRequest extends ClientApiRequest implements ClientPermissionsRequest
{
    use ValidatesFileExclusions;

    public function permission(): string
    {
        return Permission::ACTION_FILE_UPDATE;
    }

    public function rules(): array
    {
        return [
            'root' => 'required|nullable|string',
            'files' => 'required|array',
            'files.*.file' => 'required|string',
            'files.*.mode' => 'required|numeric',
        ];
    }

    protected function passedValidation(): void
    {
        foreach ($this->input('files', []) as $file) {
            $this->validateFileAccessForRoot($this->input('root'), (string) $file['file']);
        }
    }
}
