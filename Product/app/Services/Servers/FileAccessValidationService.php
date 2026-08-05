<?php

namespace Pterodactyl\Services\Servers;

use Pterodactyl\Models\User;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\Subuser;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class FileAccessValidationService
{
    public function validateSubuserFileAccess(User $user, Server $server, string $path): void
    {
        if (!$this->isFileRestricted($user, $server, $path)) {
            return;
        }

        throw new NotFoundHttpException();
    }

    public function isFileRestricted(User $user, Server $server, string $path): bool
    {
        if ($user->root_admin || $server->owner_id === $user->id) {
            return false;
        }

        $subuser = $this->getSubuser($user, $server);

        if (!$subuser) {
            return false;
        }

        return $subuser->isFilenameExcluded($path);
    }

    public function getExcludedFilenames(User $user, Server $server): array
    {
        if ($user->root_admin || $server->owner_id === $user->id) {
            return [];
        }

        $subuser = $this->getSubuser($user, $server);

        if (!$subuser) {
            return [];
        }

        return $subuser->excluded_filenames ?? [];
    }

    public function hasExcludedFilenames(User $user, Server $server): bool
    {
        return count($this->getExcludedFilenames($user, $server)) > 0;
    }

    protected function getSubuser(User $user, Server $server): ?Subuser
    {
        return $server->subusers()->where('user_id', $user->id)->first();
    }
}
