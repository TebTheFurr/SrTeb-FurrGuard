<?php

if (!function_exists('is_digit')) {
    /**
     * Deal with normal (and irritating) PHP behavior to determine if
     * a value is a non-float positive integer.
     */
    function is_digit(mixed $value): bool
    {
        return !is_bool($value) && ctype_digit(strval($value));
    }
}

if (!function_exists('object_get_strict')) {
    function object_get_strict(object $object, ?string $key, $default = null): mixed
    {
        if (is_null($key) || trim($key) == '') {
            return $object;
        }

        foreach (explode('.', $key) as $segment) {
            if (!is_object($object) || !property_exists($object, $segment)) {
                return value($default);
            }

            $object = $object->{$segment};
        }

        return $object;
    }
}

if (!function_exists('theme')) {
    function theme(string $path, mixed $default = null): mixed
    {
        return \Pterodactyl\Models\ThemeSettings::getValue($path, $default);
    }
}

if (!function_exists('theme_color')) {
    function theme_color(string $key): string
    {
        return \Pterodactyl\Helpers\ThemeHelper::color($key);
    }
}

if (!function_exists('theme_css_vars')) {
    function theme_css_vars(): string
    {
        return \Pterodactyl\Helpers\ThemeHelper::getCssVariables();
    }
}

if (!function_exists('theme_egg_image')) {
    function theme_egg_image(int $eggId): ?string
    {
        return \Pterodactyl\Helpers\ThemeHelper::eggImage($eggId);
    }
}
