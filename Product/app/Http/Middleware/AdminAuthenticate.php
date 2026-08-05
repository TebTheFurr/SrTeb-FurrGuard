<?php

namespace Pterodactyl\Http\Middleware;

use Illuminate\Http\Request;
use Pterodactyl\Services\ThemeEditor\ThemeEditorAccessService;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class AdminAuthenticate
{
    /**
     * Handle an incoming request.
     *
     * @throws AccessDeniedHttpException
     */
    public function handle(Request $request, \Closure $next): mixed
    {
        $user = $request->user();

        if (!$user) {
            throw new AccessDeniedHttpException();
        }

        if (!$user->root_admin && !app(ThemeEditorAccessService::class)->requestIsAllowed($user, $request)) {
            throw new AccessDeniedHttpException();
        }

        return $next($request);
    }
}
