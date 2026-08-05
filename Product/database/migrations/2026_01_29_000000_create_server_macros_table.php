<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('server_macros', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('server_id');
            $table->string('shortcut', 100);
            $table->text('output');
            $table->json('arguments')->nullable();
            $table->timestamps();

            $table->foreign('server_id')->references('id')->on('servers')->onDelete('cascade');
            $table->unique(['server_id', 'shortcut']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('server_macros');
    }
};
