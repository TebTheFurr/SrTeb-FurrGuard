<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Files;

use Pterodactyl\Models\Permission;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Files\Concerns\ValidatesFileExclusions;

class CompressFilesRequest extends ClientApiRequest
{
    use ValidatesFileExclusions;

    /**
     * Checks that the authenticated user is allowed to create archives for this server.
     */
    public function permission(): string
    {
        return Permission::ACTION_FILE_ARCHIVE;
    }

    public function rules(): array
    {
        return [
            'root' => 'sometimes|nullable|string',
            'files' => 'required|array',
            'files.*' => 'string',
        ];
    }

    protected function passedValidation(): void
    {
        foreach ($this->input('files', []) as $file) {
            $this->validateFileAccessForRoot($this->input('root'), (string) $file);
        }
    }
}
