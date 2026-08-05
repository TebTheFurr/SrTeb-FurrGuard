<?php

namespace Pterodactyl\Http\Middleware\Admin;

use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;

class DemoSectionDisabled
{
    public function handle(Request $request, \Closure $next): mixed
    {
        if (!filter_var(env('IS_DEMO', false), FILTER_VALIDATE_BOOLEAN)) {
            return $next($request);
        }

        if ($request->expectsJson()) {
            return response()->json(['error' => 'This section is disabled on the demo site.'], 403);
        }

        throw new HttpException(403, 'This section is disabled on the demo site.');
    }
}
