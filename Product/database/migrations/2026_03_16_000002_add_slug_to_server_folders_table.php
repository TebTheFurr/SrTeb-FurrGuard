<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('server_folders', function (Blueprint $table) {
            $table->string('slug')->nullable()->after('name');
            $table->unique(['user_id', 'slug']);
        });

        $folders = DB::table('server_folders')
            ->select(['id', 'user_id', 'name'])
            ->orderBy('id')
            ->get();

        $usedSlugsByUser = [];

        foreach ($folders as $folder) {
            $userId = (int) $folder->user_id;
            $baseSlug = Str::slug((string) $folder->name);
            if ($baseSlug === '') {
                $baseSlug = 'folder';
            }

            if (!isset($usedSlugsByUser[$userId])) {
                $usedSlugsByUser[$userId] = [];
            }

            $slug = $baseSlug;
            $suffix = 2;

            while (isset($usedSlugsByUser[$userId][$slug])) {
                $slug = $baseSlug . '-' . $suffix;
                $suffix++;
            }

            $usedSlugsByUser[$userId][$slug] = true;

            DB::table('server_folders')
                ->where('id', $folder->id)
                ->update(['slug' => $slug]);
        }
    }

    public function down(): void
    {
        Schema::table('server_folders', function (Blueprint $table) {
            $table->dropUnique('server_folders_user_id_slug_unique');
            $table->dropColumn('slug');
        });
    }
};
