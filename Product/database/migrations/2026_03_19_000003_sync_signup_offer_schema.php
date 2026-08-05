<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class SyncSignupOfferSchema extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('signup_offers')) {
            return;
        }

        Schema::table('signup_offers', function (Blueprint $table) {
            if (!Schema::hasColumn('signup_offers', 'allocation_limit')) {
                $table->unsignedInteger('allocation_limit')->default(0)->after('database_limit');
            }

            if (!Schema::hasColumn('signup_offers', 'availability_type')) {
                $table->string('availability_type')->default('register')->after('start_on_completion');
            }
        });

        if (Schema::hasColumn('signup_offers', 'allocation_limit')) {
            DB::table('signup_offers')
                ->whereNull('allocation_limit')
                ->update(['allocation_limit' => 0]);
        }

        if (Schema::hasColumn('signup_offers', 'availability_type')) {
            DB::table('signup_offers')
                ->whereNull('availability_type')
                ->update(['availability_type' => 'register']);
        }
    }

    public function down(): void
    {
    }
}
