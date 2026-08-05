<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subdomains', function (Blueprint $table) {
            $table->unsignedInteger('reverse_proxy_id')->nullable()->after('allocation_id');
            $table->foreign('reverse_proxy_id')->references('id')->on('reverse_proxies')->nullOnDelete();
            $table->index('reverse_proxy_id');
        });
    }

    public function down(): void
    {
        Schema::table('subdomains', function (Blueprint $table) {
            $table->dropForeign(['reverse_proxy_id']);
            $table->dropIndex(['reverse_proxy_id']);
            $table->dropColumn('reverse_proxy_id');
        });
    }
};
