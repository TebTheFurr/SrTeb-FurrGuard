<?php

namespace Pterodactyl\Services\OAuth;

use Pterodactyl\Models\OAuthProvider;

class OAuthProviderManager
{
    public function getEnabledProviders(): array
    {
        return OAuthProvider::query()
            ->where('enabled', true)
            ->orderBy('order')
            ->orderBy('provider_type')
            ->get()
            ->map(fn(OAuthProvider $provider) => $provider->toPublicArray())
            ->values()
            ->all();
    }

    public function getAdminProviders(): array
    {
        return OAuthProvider::query()
            ->orderBy('order')
            ->orderBy('provider_type')
            ->get()
            ->map(fn(OAuthProvider $provider) => $provider->toAdminArray())
            ->values()
            ->all();
    }

    public function createProvider(array $data): OAuthProvider
    {
        $data = $this->normaliseProviderData($data);
        $data['order'] = OAuthProvider::query()->max('order') + 1;

        return OAuthProvider::query()->create($data);
    }

    public function updateProvider(OAuthProvider $provider, array $data): OAuthProvider
    {
        $data = $this->normaliseProviderData($data, $provider);
        $provider->fill($data);
        $provider->save();

        return $provider->refresh();
    }

    public function deleteProvider(OAuthProvider $provider): void
    {
        $provider->delete();
    }

    public function reorderProviders(array $providers): void
    {
        foreach ($providers as $item) {
            if (!is_array($item) || !isset($item['id'], $item['order'])) {
                continue;
            }

            OAuthProvider::query()
                ->where('id', (int) $item['id'])
                ->update(['order' => (int) $item['order']]);
        }
    }

    public function presets(): array
    {
        return OAuthProvider::presets();
    }

    private function normaliseProviderData(array $data, ?OAuthProvider $provider = null): array
    {
        $providerType = (string) ($data['provider_type'] ?? $provider?->provider_type ?? '');
        $preset = $this->presets()[$providerType] ?? [];

        $data['provider_type'] = $providerType;
        $data['provider_key'] = $preset['provider_key'] ?? $providerType;

        foreach (['client_id', 'client_secret', 'redirect_uri'] as $field) {
            if (array_key_exists($field, $data) && is_string($data[$field])) {
                $data[$field] = trim($data[$field]);
            }
        }

        if ($provider && empty($data['client_secret'])) {
            unset($data['client_secret']);
        }

        $data['enabled'] = (bool) ($data['enabled'] ?? true);

        return $data;
    }
}
