<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subdomains', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('server_id');
            $table->unsignedInteger('allocation_id');
            $table->string('subdomain');
            $table->string('domain');
            $table->string('full_domain')->unique();
            $table->string('cloudflare_record_id')->nullable();
            $table->string('cloudflare_a_record_id')->nullable();
            $table->boolean('proxied')->default(false);
            $table->unsignedInteger('created_by');
            $table->timestamps();

            $table->foreign('server_id')->references('id')->on('servers')->onDelete('cascade');
            $table->foreign('allocation_id')->references('id')->on('allocations')->onDelete('cascade');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');

            $table->index(['server_id', 'allocation_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subdomains');
    }
};
