<?php

use Illuminate\Database\Migrations\Migration;
use Pterodactyl\Helpers\DefaultFooter;
use Pterodactyl\Models\ThemeSettings;

/**
 * Applies the new HTML/CSS footer to installs that still carry the stock
 * single-line copyright string. Panels where an admin already customised the
 * footer are left untouched.
 */
return new class extends Migration
{
    public function up(): void
    {
        $settings = ThemeSettings::where('key', 'default')->first();

        if (!$settings) {
            return;
        }

        $config = $settings->config ?? [];

        if (!isset($config['general']) || !is_array($config['general'])) {
            $config['general'] = [];
        }

        $current = trim((string) ($config['general']['copyright_text'] ?? ''));

        if ($current === '' || $this->isStockCopyright($current)) {
            $config['general']['copyright_text'] = DefaultFooter::html();
        }

        if (trim((string) ($config['general']['footer_custom_css'] ?? '')) === '') {
            $config['general']['footer_custom_css'] = DefaultFooter::css();
        }

        $settings->config = $config;
        $settings->save();

        ThemeSettings::clearCache('default');
    }

    public function down(): void
    {
        $settings = ThemeSettings::where('key', 'default')->first();

        if (!$settings) {
            return;
        }

        $config = $settings->config ?? [];

        if (($config['general']['copyright_text'] ?? null) === DefaultFooter::html()) {
            $config['general']['copyright_text'] = 'Pterodactyl® © 2015 - ' . date('Y');
        }

        if (($config['general']['footer_custom_css'] ?? null) === DefaultFooter::css()) {
            $config['general']['footer_custom_css'] = '';
        }

        $settings->config = $config;
        $settings->save();

        ThemeSettings::clearCache('default');
    }

    /**
     * Matches the stock "Pterodactyl® © 2015 - 2026" string for any year.
     */
    private function isStockCopyright(string $value): bool
    {
        return (bool) preg_match('/^Pterodactyl(®|&reg;)?\s*(©|&copy;)\s*2015\s*-\s*\d{4}$/u', $value);
    }
};
