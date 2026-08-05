<?php

namespace Pterodactyl\Http\Controllers\Api\Client;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Services\OAuth\OAuthService;
use Pterodactyl\Services\OAuth\OAuthProviderManager;

class OAuthProviderController extends ClientApiController
{
    public function __construct(
        private OAuthProviderManager $providerManager,
        private OAuthService $oauthService,
    ) {
        parent::__construct();
    }

    public function index(): JsonResponse
    {
        return new JsonResponse([
            'data' => $this->providerManager->getEnabledProviders(),
        ]);
    }

    public function identities(Request $request): JsonResponse
    {
        $identities = $request->user()
            ->oauthIdentities()
            ->with('provider')
            ->get()
            ->map(fn($identity) => $identity->toClientArray())
            ->values();

        return new JsonResponse([
            'data' => $identities,
            'providers' => $this->providerManager->getEnabledProviders(),
        ]);
    }

    public function unlink(Request $request, int $id): JsonResponse
    {
        $this->oauthService->unlinkProvider($request->user(), $id);

        return new JsonResponse([], 204);
    }
}
