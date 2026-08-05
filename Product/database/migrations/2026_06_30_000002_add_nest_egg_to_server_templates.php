<?php

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('server_templates', function (Blueprint $table) {
            $table->unsignedInteger('nest_id')->nullable()->after('description');
            $table->unsignedInteger('egg_id')->nullable()->after('nest_id');
        });
    }

    public function down(): void
    {
        Schema::table('server_templates', function (Blueprint $table) {
            $table->dropColumn(['nest_id', 'egg_id']);
        });
    }
};
