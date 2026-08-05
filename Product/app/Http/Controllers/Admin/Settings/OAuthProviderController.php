<?php

namespace Pterodactyl\Http\Controllers\Admin\Settings;

use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\OAuthProvider;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Services\OAuth\OAuthProviderManager;

class OAuthProviderController extends Controller
{
    public function __construct(
        private OAuthProviderManager $providerManager,
    ) {
    }

    public function index(): JsonResponse
    {
        return new JsonResponse([
            'data' => $this->providerManager->getAdminProviders(),
            'presets' => $this->providerManager->presets(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $provider = $this->providerManager->createProvider($this->validateProvider($request));

        return new JsonResponse([
            'data' => $provider->toAdminArray(),
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $provider = OAuthProvider::query()->findOrFail($id);
        $provider = $this->providerManager->updateProvider($provider, $this->validateProvider($request, $provider));

        return new JsonResponse([
            'data' => $provider->toAdminArray(),
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $provider = OAuthProvider::query()->findOrFail($id);
        $this->providerManager->deleteProvider($provider);

        return new JsonResponse([], 204);
    }

    public function reorder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'providers' => ['required', 'array'],
            'providers.*.id' => ['required', 'integer', 'exists:oauth_providers,id'],
            'providers.*.order' => ['required', 'integer', 'min:0'],
        ]);

        $this->providerManager->reorderProviders($validated['providers']);

        return new JsonResponse([
            'data' => $this->providerManager->getAdminProviders(),
        ]);
    }

    private function validateProvider(Request $request, ?OAuthProvider $provider = null): array
    {
        return $request->validate([
            'provider_type' => [
                'required',
                'string',
                'max:191',
                'in:discord,google',
                Rule::unique('oauth_providers', 'provider_type')->ignore($provider?->id),
            ],
            'client_id' => ['required', 'string', 'max:2048'],
            'client_secret' => [$provider ? 'nullable' : 'required', 'string', 'max:2048'],
            'redirect_uri' => ['nullable', 'url', 'max:2048'],
            'enabled' => ['required', 'boolean'],
        ]);
    }
}
