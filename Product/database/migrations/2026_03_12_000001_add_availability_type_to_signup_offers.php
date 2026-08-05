<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AddAvailabilityTypeToSignupOffers extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('signup_offers') && !Schema::hasColumn('signup_offers', 'availability_type')) {
            Schema::table('signup_offers', function (Blueprint $table) {
                $table->string('availability_type')->default('register')->after('start_on_completion');
            });
        }

        if (Schema::hasTable('signup_offers') && Schema::hasColumn('signup_offers', 'availability_type')) {
            DB::table('signup_offers')
                ->whereNull('availability_type')
                ->update([
                    'availability_type' => 'register',
                ]);
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('signup_offers') && Schema::hasColumn('signup_offers', 'availability_type')) {
            Schema::table('signup_offers', function (Blueprint $table) {
                $table->dropColumn('availability_type');
            });
        }
    }
};
