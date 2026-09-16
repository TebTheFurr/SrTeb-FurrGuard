<?php

declare(strict_types=1);

namespace Pterodactyl\Http\Controllers\Api\Client;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Pterodactyl\Services\FurrGuard\FurrGuardClient;
use Pterodactyl\Exceptions\FurrGuard\FurrGuardException;
use Pterodactyl\Services\FurrGuard\FurrGuardSessionStore;
use Pterodactyl\Http\Requests\Api\Client\FurrGuard\ActionRequest;

/**
 * Client API of the FurrGuard page (`/api/client/furrguard/...`).
 *
 * A thin proxy: it adds the Discord session kept in the panel session plus the
 * audit headers, returns FurrGuard's `data` untouched and renders FurrGuard
 * errors in Pterodactyl's error format. Which actions a user may run is decided
 * by FurrGuard from the role of their Discord account.
 */
class FurrGuardController extends ClientApiController
{
    /** Actions of the bridge itself: they have their own routes here and are never proxied. */
    private const RESERVED_ACTIONS = ['oauth_start', 'oauth_exchange', 'session', 'logout'];

    public function __construct(private FurrGuardClient $client, private FurrGuardSessionStore $sessions)
    {
        parent::__construct();
    }

    /**
     * Without a Discord session: `{session: null}`. With one: the public profile
     * and permissions, freshly confirmed by FurrGuard (a role change or a revoked
     * session shows up here).
     */
    public function index(Request $request): JsonResponse
    {
        $session = $this->sessions->get($request);
        if (is_null($session)) {
            return new JsonResponse(['session' => null]);
        }

        return $this->withSession($request, function (string $token) use ($request) {
            $data = $this->client->call('session', [], $token, $request);
            if (is_array($data)) {
                $this->sessions->refresh($request, $data);
            }

            return ['session' => FurrGuardSessionStore::publicPart(is_array($data) ? $data : [])];
        });
    }

    /**
     * Closes the Discord session. The panel forgets it even if FurrGuard cannot
     * be told, so the user is logged out of the page either way.
     */
    public function logout(Request $request): JsonResponse
    {
        $session = $this->sessions->get($request);
        $this->sessions->forget($request);

        if (!is_null($session)) {
            try {
                $this->client->call('logout', [], $session['token'], $request);
            } catch (FurrGuardException $exception) {
                Log::info('Could not close a FurrGuard session on FurrGuard; it will expire on its own.', ['code' => $exception->getSlug()]);
            }
        }

        return new JsonResponse([]);
    }

    /**
     * Runs one panel action (FurrGuard docs/API.md §4.4) with the stored session.
     */
    public function action(ActionRequest $request): JsonResponse
    {
        $action = (string) $request->validated('action');
        if (in_array($action, self::RESERVED_ACTIONS, true)) {
            throw new FurrGuardException(404, 'unknown_action', 'Acción desconocida.');
        }

        $params = $request->validated('params') ?? [];

        return $this->withSession($request, fn (string $token) => ['data' => $this->client->call($action, is_array($params) ? $params : [], $token, $request)]);
    }

    /**
     * @throws FurrGuardException
     */
    private function withSession(Request $request, \Closure $callback): JsonResponse
    {
        $session = $this->sessions->get($request);
        if (is_null($session)) {
            throw new FurrGuardException(401, 'unauthorized', 'Inicia sesión con Discord para usar FurrGuard');
        }

        try {
            return new JsonResponse($callback($session['token']));
        } catch (FurrGuardException $exception) {
            if ($exception->isSessionError()) {
                $this->sessions->forget($request);
            }

            throw $exception;
        }
    }
}
