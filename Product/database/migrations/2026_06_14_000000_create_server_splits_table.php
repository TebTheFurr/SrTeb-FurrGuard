<?php

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('server_splits', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('parent_server_id');
            $table->unsignedInteger('split_server_id');
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('memory')->default(0);
            $table->unsignedInteger('cpu')->default(0);
            $table->unsignedInteger('disk')->default(0);
            $table->unsignedInteger('allocations')->default(1);
            $table->unsignedInteger('database_limit')->default(0);
            $table->unsignedInteger('backup_limit')->default(0);
            $table->unsignedInteger('allocation_limit')->default(0);
            $table->timestamps();

            $table->foreign('parent_server_id')->references('id')->on('servers')->onDelete('cascade');
            $table->foreign('split_server_id')->references('id')->on('servers')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');

            $table->unique('split_server_id');
            $table->index(['parent_server_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('server_splits');
    }
};
