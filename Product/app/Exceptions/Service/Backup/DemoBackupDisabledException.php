<?php

namespace Pterodactyl\Exceptions\Service\Backup;

use Pterodactyl\Exceptions\DisplayException;

class DemoBackupDisabledException extends DisplayException
{
    public function __construct()
    {
        parent::__construct('Backups are not available on the demo site.');
    }
}
