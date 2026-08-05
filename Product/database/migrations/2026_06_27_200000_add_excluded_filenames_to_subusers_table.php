<?php

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class AddExcludedFilenamesToSubusersTable extends Migration
{
    public function up(): void
    {
        Schema::table('subusers', function (Blueprint $table) {
            $table->text('excluded_filenames')->nullable()->after('permissions');
        });
    }

    public function down(): void
    {
        Schema::table('subusers', function (Blueprint $table) {
            $table->dropColumn('excluded_filenames');
        });
    }
}
