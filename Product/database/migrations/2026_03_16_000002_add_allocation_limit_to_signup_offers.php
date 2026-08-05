<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AddAllocationLimitToSignupOffers extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('signup_offers', 'allocation_limit')) {
            Schema::table('signup_offers', function (Blueprint $table) {
                $table->unsignedInteger('allocation_limit')->default(0)->after('database_limit');
            });
        }

        if (Schema::hasColumn('signup_offers', 'allocation_limit')) {
            DB::table('signup_offers')->whereNull('allocation_limit')->update([
                'allocation_limit' => 0,
            ]);
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('signup_offers', 'allocation_limit')) {
            Schema::table('signup_offers', function (Blueprint $table) {
                $table->dropColumn('allocation_limit');
            });
        }
    }
};
