<?php

use Illuminate\Database\Migrations\Migration;
use Pterodactyl\Models\ThemeSettings;

return new class extends Migration
{
    public function up(): void
    {
        $settings = ThemeSettings::where('key', 'default')->first();
        
        if ($settings) {
            $config = $settings->config ?? [];
            
            if (!isset($config['layout'])) {
                $config['layout'] = [];
            }
            
            if (!isset($config['layout']['account_custom_links'])) {
                $config['layout']['account_custom_links'] = [
                    ['label' => 'Profile', 'icon' => 'user', 'url' => '/account'],
                    ['label' => 'Security', 'icon' => 'shield-alt', 'url' => '/account#security'],
                    ['label' => 'API Keys', 'icon' => 'lock', 'url' => '/account#api'],
                    ['label' => 'SSH Keys', 'icon' => 'key', 'url' => '/account#ssh'],
                    ['label' => 'Activity', 'icon' => 'history', 'url' => '/account#activity'],
                ];
            }
            
            $settings->config = $config;
            $settings->save();
            
            ThemeSettings::clearCache('default');
        }
    }

    public function down(): void
    {
        $settings = ThemeSettings::where('key', 'default')->first();
        
        if ($settings) {
            $config = $settings->config ?? [];
            
            if (isset($config['layout']['account_custom_links'])) {
                $config['layout']['account_custom_links'] = [];
            }
            
            $settings->config = $config;
            $settings->save();
            
            ThemeSettings::clearCache('default');
        }
    }
};
