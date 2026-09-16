<?php

declare(strict_types=1);

namespace Pterodactyl\Http\Middleware;

use Illuminate\Http\Request;
use Pterodactyl\Models\User;
use Pterodactyl\Services\FurrGuard\FurrGuardClient;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * The FurrGuard routes do not exist unless the integration is configured and
 * the panel user has the "FurrGuard" permission (Admin → Users). Whether the
 * Discord account behind that user may actually do anything is FurrGuard's call.
 */
class RequireFurrGuardAccess
{
    public function handle(Request $request, \Closure $next): mixed
    {
        $user = $request->user();

        if (!FurrGuardClient::configured() || !$user instanceof User || !$user->furrguard_access) {
            throw new NotFoundHttpException(trans('exceptions.api.resource_not_found'));
        }

        return $next($request);
    }
}
