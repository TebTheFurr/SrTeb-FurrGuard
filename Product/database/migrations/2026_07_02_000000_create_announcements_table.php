<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('announcements', function (Blueprint $table) {
            $table->id();
            $table->boolean('enabled')->default(true);
            $table->string('variation')->default('split');
            $table->string('placement')->default('above-content');
            $table->string('type')->default('info');
            $table->string('icon')->default('bullhorn');
            $table->string('title')->nullable();
            $table->text('text')->nullable();
            $table->string('button_label')->nullable();
            $table->string('button_link')->nullable();
            $table->json('egg_ids')->nullable();
            $table->json('node_ids')->nullable();
            $table->boolean('is_permanent')->default(true);
            $table->timestamp('expires_at')->nullable();
            $table->integer('order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('announcements');
    }
};
