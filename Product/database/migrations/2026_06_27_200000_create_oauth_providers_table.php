<?php

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('oauth_providers', function (Blueprint $table) {
            $table->increments('id');
            $table->string('provider_key')->unique();
            $table->string('provider_type')->unique();
            $table->text('client_id');
            $table->text('client_secret')->nullable();
            $table->string('redirect_uri', 2048)->nullable();
            $table->boolean('enabled')->default(true);
            $table->unsignedInteger('order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('oauth_providers');
    }
};
