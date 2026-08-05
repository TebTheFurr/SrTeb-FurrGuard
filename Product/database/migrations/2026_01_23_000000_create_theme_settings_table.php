<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('theme_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->json('config');
            $table->timestamps();
        });

        DB::table('theme_settings')->insert([
            'key' => 'default',
            'config' => json_encode($this->getDefaultConfig()),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('theme_settings');
    }

    private function getDefaultConfig(): array
    {
        return [
            'general' => [
                'site_name' => 'Pterodactyl',
                'logo_url' => '',
                'logo_url_dark' => '',
                'logo_url_light' => '',
                'copyright_text' => 'Pterodactyl® © 2015 - ' . date('Y'),
                'discord_invite_link' => '',
                'show_discord_navbar' => false,
                'privacy_blur_server_ip' => false,
            ],
            'theme' => [
                'colors' => [
                    'primary' => 'hsl(229, 100%, 64%)',
                    'secondary' => 'hsl(229, 96%, 59%)',
                    'neutral' => 'hsl(0, 0%, 15%)',
                    'base' => 'hsl(0, 0%, 100%)',
                    'muted' => 'hsl(220, 16%, 45%)',
                    'inverted' => 'hsl(220, 14%, 60%)',
                    'background' => 'hsl(240, 3%, 6%)',
                    'background_secondary' => 'hsl(240, 2%, 8%)',
                ],
                'border_radius' => '8',
                'font_family' => 'Onest',
            ],
            'layout' => [],
            'components' => [],
            'announcements' => [
                'enabled' => false,
                'icon' => 'bullhorn',
                'title' => '',
                'text' => '',
                'type' => 'info',
                'style' => 'split',
                'location' => 'above-content',
                'button' => [
                    'label' => '',
                    'link' => '',
                    'colour' => 'var(--color-primary)',
                ],
            ],
            'seo' => [
                'meta_title' => '',
                'meta_description' => '',
                'meta_image' => '',
                'meta_keywords' => '',
                'favicon' => '',
            ],
            'eggs' => [],
            'advanced' => [],
        ];
    }
};
