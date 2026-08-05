<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\Response;
use Pterodactyl\Models\Server;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Repositories\Wings\DaemonPowerRepository;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Http\Requests\Api\Client\Servers\SendPowerRequest;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

class PowerController extends ClientApiController
{
    private const SERVER_IMPORT_SERVICE = 'Pterodactyl\Services\ServerImport\ServerImportService';

    /**
     * PowerController constructor.
     */
    public function __construct(private DaemonPowerRepository $repository)
    {
        parent::__construct();
    }

    /**
     * Send a power action to a server.
     */
    public function index(SendPowerRequest $request, Server $server): Response
    {
        $signal = $request->input('signal');

        if (in_array($signal, ['start', 'restart'], true) && $this->isServerImportInProgress($server)) {
            throw new BadRequestHttpException('This server cannot be started while a file import is in progress.');
        }

        $this->repository->setServer($server)->send($signal);

        Activity::event(strtolower("server:power.{$signal}"))->log();

        return $this->returnNoContent();
    }

    private function isServerImportInProgress(Server $server): bool
    {
        $serviceClass = self::SERVER_IMPORT_SERVICE;

        if (!class_exists($serviceClass)) {
            return false;
        }

        return $serviceClass::isServerLocked($server);
    }
}
