<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Files\Concerns;

use Pterodactyl\Models\Server;
use Pterodactyl\Services\Servers\FileAccessValidationService;

trait ValidatesFileExclusions
{
    protected function validateFileAccess(string $path): void
    {
        $server = $this->route()->parameter('server');

        if (!$server instanceof Server) {
            return;
        }

        app(FileAccessValidationService::class)->validateSubuserFileAccess($this->user(), $server, $path);
    }

    protected function validateFileAccessForRoot(?string $root, string $path): void
    {
        $root = $root ?: '/';
        $path = ltrim($path, '/');

        $this->validateFileAccess(rtrim($root, '/') . '/' . $path);
    }
}
