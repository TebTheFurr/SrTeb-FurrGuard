<?php

namespace Pterodactyl\Http\Middleware\Api\Client\Server;

use Illuminate\Http\Request;
use Pterodactyl\Models\Server;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Pterodactyl\Exceptions\Http\Server\ServerStateConflictException;

class AuthenticateServerAccess
{
    /**
     * Routes that this middleware should not apply to if the user is an admin.
     */
    protected array $except = [
        'api:client:server.ws',
    ];

    /**
     * Name pattern of the Tebby Vault client routes (routes/api-client.php).
     */
    private const VAULT_ROUTES = 'api:client:server.vault.*';

    /**
     * AuthenticateServerAccess constructor.
     */
    public function __construct()
    {
    }

    /**
     * Authenticate that this server exists and is not suspended or marked as installing.
     */
    public function handle(Request $request, \Closure $next): mixed
    {
        /** @var \Pterodactyl\Models\User $user */
        $user = $request->user();
        $server = $request->route()->parameter('server');

        if (!$server instanceof Server) {
            throw new NotFoundHttpException(trans('exceptions.api.resource_not_found'));
        }

        // At the very least, ensure that the user trying to make this request is the
        // server owner, a subuser, or a root admin. We'll leave it up to the controllers
        // to authenticate more detailed permissions if needed.
        if ($user->id !== $server->owner_id && !$user->root_admin) {
            // Check for subuser status.
            if (!$server->subusers->contains('user_id', $user->id)) {
                throw new NotFoundHttpException(trans('exceptions.api.resource_not_found'));
            }
        }

        try {
            $server->validateCurrentState();
        } catch (ServerStateConflictException $exception) {
            // Still allow users to get information about their server if it is installing or
            // being transferred.
            if (!$request->routeIs('api:client:server.view') && !$this->isVaultRestoreConflict($request, $server)) {
                if (($server->isSuspended() || $server->node->isUnderMaintenance()) && !$request->routeIs('api:client:server.resources')) {
                    throw $exception;
                }
                if (!$user->root_admin || !$request->routeIs($this->except)) {
                    throw $exception;
                }
            }
        }

        $request->attributes->set('server', $server);

        return $next($request);
    }

    /**
     * A Tebby Vault restore that stops the server holds it in "restoring_backup"
     * until the job is over, and the Vault page has to keep polling (and be able
     * to cancel) that very job meanwhile. So the Vault client routes pass when
     * the restore is the only conflict; suspended, installing, transferring or
     * maintenance servers stay blocked. Writes that would clash with the running
     * job are refused by the vault itself (409 "ocupado").
     */
    private function isVaultRestoreConflict(Request $request, Server $server): bool
    {
        return $request->routeIs(self::VAULT_ROUTES)
            && $server->status === Server::STATUS_RESTORING_BACKUP
            && !$server->node->isUnderMaintenance()
            && is_null($server->transfer);
    }
}
