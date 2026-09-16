<?php

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

/**
 * Which servers have the Tebby Vault enabled.
 *
 * This table is the source of truth for the activation only: access lists,
 * quota and exclusions live in the vault itself.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vault_servers', function (Blueprint $table) {
            $table->unsignedInteger('server_id')->primary();
            $table->boolean('enabled')->default(false);
            $table->timestamp('enabled_at')->nullable();
            $table->timestamps();

            $table->foreign('server_id')->references('id')->on('servers')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vault_servers');
    }
};
