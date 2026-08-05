<?php

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('server_folders', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('user_id');
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->string('name');
            $table->string('color', 7)->default('#4a5568'); 
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('parent_id')->references('id')->on('server_folders')->onDelete('cascade');
            
            $table->index(['user_id', 'parent_id']);
        });

        Schema::create('server_folder_servers', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('folder_id');
            $table->unsignedInteger('server_id');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('folder_id')->references('id')->on('server_folders')->onDelete('cascade');
            $table->foreign('server_id')->references('id')->on('servers')->onDelete('cascade');
            
            $table->unique(['folder_id', 'server_id']);
            $table->index('folder_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('server_folder_servers');
        Schema::dropIfExists('server_folders');
    }
};
