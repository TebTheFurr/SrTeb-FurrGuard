<?php

namespace Pterodactyl\Services\MassEggImporter;

use Pterodactyl\Models\ThemeSettings;

class MassEggImporterService
{
    public static function getSetting(string $key, mixed $default = null): mixed
    {
        return ThemeSettings::getValue("addons.mass_egg_importer.settings.{$key}", $default);
    }

    public static function getCategoriesApiUrl(): string
    {
        return (string) self::getSetting('categories_api_url', 'https://eggs.pterodactyl.io/api/categories.json');
    }

    public static function getEggsApiUrl(): string
    {
        return (string) self::getSetting('eggs_api_url', 'https://eggs.pterodactyl.io/api/eggs.json');
    }

    public static function getRequestTimeout(): int
    {
        return (int) self::getSetting('request_timeout', 20);
    }
}
