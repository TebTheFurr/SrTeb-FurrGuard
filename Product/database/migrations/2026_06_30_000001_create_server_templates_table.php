<?php

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('server_templates', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name');
            $table->text('description')->nullable();
            $table->unsignedInteger('cpu')->default(0);
            $table->string('threads')->nullable();
            $table->unsignedInteger('memory')->default(0);
            $table->integer('swap')->default(0);
            $table->unsignedInteger('disk')->default(0);
            $table->unsignedInteger('io')->default(500);
            $table->boolean('oom_disabled')->default(true);
            $table->integer('database_limit')->default(0);
            $table->integer('allocation_limit')->default(0);
            $table->integer('backup_limit')->default(0);
            $table->unsignedInteger('order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('server_templates');
    }
};
