<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE servers MODIFY subdomain_limit INT NULL');
        DB::statement('ALTER TABLE servers MODIFY reverse_proxy_limit INT NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE servers MODIFY subdomain_limit INT UNSIGNED NULL');
        DB::statement('ALTER TABLE servers MODIFY reverse_proxy_limit INT UNSIGNED NULL');
    }
};
