<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('signup_offers')) {
            Schema::create('signup_offers', function (Blueprint $table) {
                $table->increments('id');
                $table->string('name');
                $table->text('description')->nullable();
                $table->string('server_name_template')->default('{username} Server');
                $table->string('server_description')->nullable();
                $table->unsignedInteger('egg_id');
                $table->unsignedInteger('nest_id');
                $table->json('location_ids')->nullable();
                $table->boolean('dedicated_ip')->default(false);
                $table->unsignedInteger('memory');
                $table->integer('swap')->default(0);
                $table->unsignedInteger('disk');
                $table->unsignedInteger('io')->default(500);
                $table->unsignedInteger('cpu')->default(0);
                $table->string('threads')->nullable();
                $table->boolean('oom_disabled')->default(true);
                $table->unsignedInteger('database_limit')->default(0);
                $table->unsignedInteger('allocation_limit')->default(0);
                $table->unsignedInteger('backup_limit')->default(0);
                $table->text('startup')->nullable();
                $table->string('image')->nullable();
                $table->json('environment')->nullable();
                $table->boolean('start_on_completion')->default(true);
                $table->string('availability_type')->default('register');
                $table->string('target_type')->default('all');
                $table->json('target_users')->nullable();
                $table->unsignedInteger('claim_expiry_days')->nullable();
                $table->unsignedInteger('server_expiry_days')->nullable();
                $table->boolean('enabled')->default(true);
                $table->timestamps();

                $table->foreign('egg_id')->references('id')->on('eggs')->onDelete('cascade');
                $table->foreign('nest_id')->references('id')->on('nests')->onDelete('cascade');
            });
        }

        if (!Schema::hasTable('signup_offer_claims')) {
            Schema::create('signup_offer_claims', function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('offer_id');
                $table->unsignedInteger('user_id');
                $table->unsignedInteger('server_id')->nullable();
                $table->string('status')->default('pending');
                $table->timestamp('claimed_at')->nullable();
                $table->timestamp('claim_expires_at')->nullable();
                $table->timestamp('server_expires_at')->nullable();
                $table->unsignedInteger('server_expiry_days_override')->nullable();
                $table->timestamps();

                $table->foreign('offer_id')->references('id')->on('signup_offers')->onDelete('cascade');
                $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
                $table->foreign('server_id')->references('id')->on('servers')->onDelete('set null');

                $table->index(['user_id', 'status']);
                $table->index(['status', 'claim_expires_at']);
                $table->index(['status', 'server_expires_at']);
            });
        }

        if (!Schema::hasColumn('users', 'email_verified_at')) {
            Schema::table('users', function (Blueprint $table) {
                $table->timestamp('email_verified_at')->nullable()->after('email');
            });

            DB::table('users')->update(['email_verified_at' => now()]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('signup_offer_claims');
        Schema::dropIfExists('signup_offers');

        if (Schema::hasColumn('users', 'email_verified_at')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('email_verified_at');
            });
        }
    }
};
