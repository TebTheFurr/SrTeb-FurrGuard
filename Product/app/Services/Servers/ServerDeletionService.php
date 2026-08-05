<?php

namespace Pterodactyl\Services\Servers;

use Illuminate\Http\Response;
use Pterodactyl\Models\Server;
use Illuminate\Support\Facades\Log;
use Illuminate\Database\ConnectionInterface;
use Pterodactyl\Repositories\Wings\DaemonServerRepository;
use Pterodactyl\Services\Databases\DatabaseManagementService;
use Pterodactyl\Exceptions\Http\Connection\DaemonConnectionException;

class ServerDeletionService
{
    protected bool $force = false;
    private $subdomainService = null;

    public function __construct(
        private ConnectionInterface $connection,
        private DaemonServerRepository $daemonServerRepository,
        private DatabaseManagementService $databaseManagementService,
    ) {
        if (class_exists(\Pterodactyl\Services\Subdomains\SubdomainService::class)) {
            $this->subdomainService = app(\Pterodactyl\Services\Subdomains\SubdomainService::class);
        }
    }

    /**
     * Set if the server should be forcibly deleted from the panel (ignoring daemon errors) or not.
     */
    public function withForce(bool $bool = true): self
    {
        $this->force = $bool;

        return $this;
    }

    /**
     * Delete a server from the panel, clear any allocation notes, and remove any associated databases from hosts.
     *
     * @throws \Throwable
     * @throws \Pterodactyl\Exceptions\DisplayException
     */
    public function handle(Server $server): void
    {
        if (class_exists(\Pterodactyl\Services\ServerSplitter\ServerSplitterService::class)) {
            app(\Pterodactyl\Services\ServerSplitter\ServerSplitterService::class)->handleServerDeletion($server, $this->force);
        }

        try {
            $this->daemonServerRepository->setServer($server)->delete();
        } catch (DaemonConnectionException $exception) {
            // If there is an error not caused a 404 error and this isn't a forced delete,
            // go ahead and bail out. We specifically ignore a 404 since that can be assumed
            // to be a safe error, meaning the server doesn't exist at all on Wings so there
            // is no reason we need to bail out from that.
            if (!$this->force && $exception->getStatusCode() !== Response::HTTP_NOT_FOUND) {
                throw $exception;
            }

            Log::warning($exception);
        }

        $this->connection->transaction(function () use ($server) {
            foreach ($server->databases as $database) {
                try {
                    $this->databaseManagementService->delete($database);
                } catch (\Exception $exception) {
                    if (!$this->force) {
                        throw $exception;
                    }

                    $database->delete();

                    Log::warning($exception);
                }
            }

            if ($this->subdomainService && class_exists(\Pterodactyl\Models\Subdomain::class)) {
                $subdomains = \Pterodactyl\Models\Subdomain::where('server_id', $server->id)->get();
                foreach ($subdomains as $subdomain) {
                    try {
                        $this->subdomainService->deleteSubdomain($subdomain);
                    } catch (\Exception $exception) {
                        if (!$this->force) {
                            throw $exception;
                        }

                        $subdomain->delete();
                        Log::warning($exception);
                    }
                }
            }

            $server->allocations()->update(['notes' => null]);

            $server->delete();
        });
    }
}
