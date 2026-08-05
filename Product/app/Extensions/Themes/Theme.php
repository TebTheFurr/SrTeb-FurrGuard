<?php

namespace Pterodactyl\Extensions\Themes;

class Theme
{
    /**
     * Placeholder the Blade templates embed in asset query strings.
     */
    private const CACHE_VERSION_TOKEN = '{cache-version}';

    /**
     * @var array<string, string> Per-request memo so a page with many assets
     *                            does not stat the same file repeatedly.
     */
    private array $versionCache = [];

    public function js($path): string
    {
        return sprintf('<script src="%s"></script>' . PHP_EOL, $this->getUrl($path));
    }

    public function css($path): string
    {
        return sprintf('<link media="all" type="text/css" rel="stylesheet" href="%s"/>' . PHP_EOL, $this->getUrl($path));
    }

    protected function getUrl($path): string
    {
        return '/themes/pterodactyl/' . $this->applyCacheVersion(ltrim($path, '/'));
    }

    /**
     * Replaces the literal {cache-version} placeholder with the asset's
     * modification time.
     *
     * Without this the placeholder is emitted verbatim, so every asset URL is
     * byte-identical across releases and browsers keep serving stale CSS/JS
     * long after the panel has been updated.
     */
    private function applyCacheVersion(string $path): string
    {
        if (!str_contains($path, self::CACHE_VERSION_TOKEN)) {
            return $path;
        }

        $file = explode('?', $path, 2)[0];

        if (!array_key_exists($file, $this->versionCache)) {
            $absolute = public_path('themes/pterodactyl/' . $file);
            $mtime = is_file($absolute) ? @filemtime($absolute) : false;

            $this->versionCache[$file] = $mtime !== false
                ? (string) $mtime
                : substr(md5((string) config('app.version', 'luna')), 0, 8);
        }

        return str_replace(self::CACHE_VERSION_TOKEN, $this->versionCache[$file], $path);
    }
}
