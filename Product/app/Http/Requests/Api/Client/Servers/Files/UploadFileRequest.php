<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Files;

use Pterodactyl\Models\Server;
use Pterodactyl\Models\Permission;
use Pterodactyl\Services\Servers\FileAccessValidationService;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class UploadFileRequest extends ClientApiRequest
{
    public function permission(): string
    {
        return Permission::ACTION_FILE_CREATE;
    }

    protected function passedValidation(): void
    {
        $server = $this->route()->parameter('server');

        if (!$server instanceof Server) {
            return;
        }

        if (app(FileAccessValidationService::class)->hasExcludedFilenames($this->user(), $server)) {
            throw new NotFoundHttpException();
        }
    }
}
