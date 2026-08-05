<?php

namespace Pterodactyl\Helpers;

use Pterodactyl\Models\ThemeSettings;

class ThemeHelper
{
    public static function get(string $path, mixed $default = null): mixed
    {
        return ThemeSettings::getValue($path, $default);
    }

    public static function color(string $key): string
    {
        return ThemeSettings::getValue("theme.colors.{$key}", '');
    }

    public static function general(string $key): mixed
    {
        return ThemeSettings::getValue("general.{$key}", '');
    }

    public static function seo(string $key): mixed
    {
        return ThemeSettings::getValue("seo.{$key}", '');
    }

    public static function eggImage(int $eggId): ?string
    {
        return ThemeSettings::getValue("eggs.{$eggId}");
    }

    public static function getCssVariables(): string
    {
        $colors = ThemeSettings::getValue('theme.colors', []);
        $borderRadius = ThemeSettings::getValue('theme.border_radius', '8');

        $vars = [];

        foreach ($colors as $key => $value) {
            $cssKey = str_replace('_', '-', $key);
            $vars[] = "--color-{$cssKey}: {$value};";
        }

        $vars[] = "--border-radius: {$borderRadius}px;";

        return implode("\n    ", $vars);
    }

    public static function getFontFamily(): string
    {
        return ThemeSettings::getValue('theme.font_family', 'Onest');
    }

    public static function getGoogleFontsUrl(): string
    {
        $font = self::getFontFamily();
        
        if (empty($font)) {
            return '';
        }

        $fontParam = str_replace(' ', '+', $font) . ':wght@400;500;600;700';

        return "https://fonts.googleapis.com/css2?family={$fontParam}&display=swap";
    }
}
