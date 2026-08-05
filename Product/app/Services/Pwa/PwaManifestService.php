<?php

namespace Pterodactyl\Services\Pwa;

use Pterodactyl\Models\ThemeSettings;

class PwaManifestService
{
    private const MANIFEST_PATH = 'favicons/manifest.json';

    public function sync(): void
    {
        $manifest = $this->buildManifest();
        $path = public_path(self::MANIFEST_PATH);

        file_put_contents(
            $path,
            json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n"
        );
    }

    public function buildManifest(): array
    {
        $pwa = ThemeSettings::getValue('seo.pwa', []);
        if (!is_array($pwa)) {
            $pwa = [];
        }

        $siteName = trim((string) ThemeSettings::getValue('general.site_name', 'Pterodactyl'));
        $name = trim((string) ($pwa['name'] ?? ''));
        if ($name === '') {
            $name = $siteName !== '' ? $siteName : 'Pterodactyl';
        }

        $shortName = trim((string) ($pwa['short_name'] ?? ''));
        if ($shortName === '') {
            $shortName = mb_strlen($name) > 12 ? mb_substr($name, 0, 12) : $name;
        }

        $description = trim((string) ($pwa['description'] ?? ''));
        if ($description === '') {
            $description = "Manage your servers with {$name}.";
        }

        return [
            'id' => '/',
            'name' => $name,
            'short_name' => $shortName,
            'description' => $description,
            'start_url' => '/',
            'scope' => '/',
            'display' => 'standalone',
            'orientation' => 'portrait',
            'background_color' => $this->normalizeHex($pwa['background_color'] ?? null, '#0f1117'),
            'theme_color' => $this->normalizeHex($pwa['theme_color'] ?? null, '#5176ff'),
            'icons' => $this->buildIcons($pwa),
        ];
    }

    private function buildIcons(array $pwa): array
    {
        $icon = trim((string) ($pwa['icon'] ?? ''));
        $src192 = $icon !== '' ? $icon : '/favicons/android-chrome-192x192.png';
        $src512 = $icon !== '' ? $icon : '/favicons/android-chrome-512x512.png';

        return [
            [
                'src' => $src192,
                'sizes' => '192x192',
                'type' => 'image/png',
                'purpose' => 'any',
            ],
            [
                'src' => $src512,
                'sizes' => '512x512',
                'type' => 'image/png',
                'purpose' => 'any',
            ],
            [
                'src' => $src512,
                'sizes' => '512x512',
                'type' => 'image/png',
                'purpose' => 'maskable',
            ],
        ];
    }

    private function normalizeHex(mixed $value, string $fallback): string
    {
        $hex = trim((string) $value);

        if ($hex === '') {
            return $fallback;
        }

        if (!str_starts_with($hex, '#')) {
            $hex = '#' . $hex;
        }

        if (!preg_match('/^#[0-9a-fA-F]{6}$/', $hex)) {
            return $fallback;
        }

        return strtolower($hex);
    }
}
