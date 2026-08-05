<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Files;

use Pterodactyl\Models\Server;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Files\Concerns\ValidatesFileExclusions;

class DownloadFileRequest extends ClientApiRequest
{
    use ValidatesFileExclusions;

    /**
     * Ensure that the user making this request has permission to download files
     * from this server.
     */
    public function authorize(): bool
    {
        return $this->user()->can('file.read', $this->parameter('server', Server::class));
    }

    public function rules(): array
    {
        return [
            'file' => 'required|string',
        ];
    }

    protected function passedValidation(): void
    {
        $this->validateFileAccess((string) $this->input('file'));
    }
}
