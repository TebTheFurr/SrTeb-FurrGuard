<?php

declare(strict_types=1);

namespace Pterodactyl\Http\Middleware\Api\Client\Server;

use Illuminate\Http\Request;
use Pterodactyl\Models\Server;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * The Vault endpoints of a server do not exist unless the Vault is enabled for
 * it (and the integration is configured).
 */
class RequireVaultEnabled
{
    public function handle(Request $request, \Closure $next): mixed
    {
        $server = $request->route()->parameter('server');

        if (!$server instanceof Server || !$server->hasVaultEnabled()) {
            throw new NotFoundHttpException(trans('exceptions.api.resource_not_found'));
        }

        return $next($request);
    }
}
