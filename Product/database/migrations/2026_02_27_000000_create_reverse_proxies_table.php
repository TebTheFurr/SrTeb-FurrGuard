<?php
    
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reverse_proxies', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('server_id');
            $table->unsignedInteger('allocation_id');
            $table->string('domain');
            $table->enum('proxy_type', ['nginx', 'traefik'])->default('nginx');
            $table->boolean('ssl_enabled')->default(false);
            $table->enum('ssl_type', ['none', 'certbot', 'cloudflare_origin'])->default('none');
            $table->string('ssl_certificate_path')->nullable();
            $table->string('ssl_key_path')->nullable();
            $table->string('config_file_path')->nullable();
            $table->string('cloudflare_record_id')->nullable();
            $table->enum('status', ['pending', 'active', 'failed', 'deleting'])->default('pending');
            $table->text('error_message')->nullable();
            $table->timestamp('dns_verified_at')->nullable();
            $table->unsignedInteger('created_by');
            $table->timestamps();

            $table->foreign('server_id')->references('id')->on('servers')->onDelete('cascade');
            $table->foreign('allocation_id')->references('id')->on('allocations')->onDelete('cascade');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');

            $table->unique('domain');
            $table->index('server_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reverse_proxies');
    }
};
