<?php

use Illuminate\Database\Migrations\Migration;
use Pterodactyl\Helpers\DefaultFooter;
use Pterodactyl\Models\ThemeSettings;

/**
 * Back-fills the "Status" pill into footers that were saved before the button
 * existed. The button is inserted directly after the X pill, so any other
 * customisation the admin made to the footer is preserved.
 *
 * No-ops when the footer already links to the status page, or when the admin
 * replaced the shipped markup entirely (no `btn-x` pill to anchor to).
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
        $html = (string) ($config['general']['copyright_text'] ?? '');

        if (trim($html) === '' || str_contains($html, DefaultFooter::STATUS_URL)) {
            return;
        }

        $button = DefaultFooter::statusButton();
        $updated = preg_replace_callback(
            '#<a\s+class="btn-x"[^>]*>.*?</a>#s',
            fn (array $matches): string => $matches[0] . "\n" . $button,
            $html,
            1,
            $count
        );

        if ($updated === null || $count === 0) {
            return;
        }

        $config['general']['copyright_text'] = $updated;

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
        $html = (string) ($config['general']['copyright_text'] ?? '');

        if (!str_contains($html, DefaultFooter::STATUS_URL)) {
            return;
        }

        $updated = preg_replace('#\s*<a\s+class="btn-x btn-status"[^>]*>.*?</a>#s', '', $html, 1);

        if ($updated === null) {
            return;
        }

        $config['general']['copyright_text'] = $updated;

        $settings->config = $config;
        $settings->save();

        ThemeSettings::clearCache('default');
    }
};
