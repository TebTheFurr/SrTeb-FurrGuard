<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('reverse_proxies') || Schema::hasColumn('reverse_proxies', 'dns_verified_at')) {
            return;
        }

        Schema::table('reverse_proxies', function (Blueprint $table) {
            $table->timestamp('dns_verified_at')->nullable()->after('error_message');
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('reverse_proxies') || !Schema::hasColumn('reverse_proxies', 'dns_verified_at')) {
            return;
        }

        Schema::table('reverse_proxies', function (Blueprint $table) {
            $table->dropColumn('dns_verified_at');
        });
    }
};
