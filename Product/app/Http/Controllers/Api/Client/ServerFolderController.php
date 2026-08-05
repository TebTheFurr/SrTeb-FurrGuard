<?php

namespace Pterodactyl\Http\Controllers\Api\Client;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;
use Pterodactyl\Models\ServerFolder;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\ThemeSettings;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ServerFolderController extends ClientApiController
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $serverFilter = $this->accessibleServersFilter($user);

        $allFolders = ServerFolder::where('user_id', $user->id)
            ->orderBy('sort_order')
            ->with(['servers' => $serverFilter])
            ->get();

        $folders = $this->buildFolderTree($allFolders);

        $folderServersQuery = DB::table('server_folder_servers')
            ->join('server_folders', 'server_folders.id', '=', 'server_folder_servers.folder_id')
            ->where('server_folders.user_id', $user->id);

        if (!$user->root_admin) {
            $accessibleServerIds = $user->accessibleServers()->pluck('servers.id');
            $folderServersQuery->whereIn('server_folder_servers.server_id', $accessibleServerIds);
        }

        $serverIdsInFolders = $folderServersQuery->pluck('server_id')->toArray();

        return new JsonResponse([
            'data' => $folders->map(fn ($folder) => $this->transformFolder($folder)),
            'server_ids_in_folders' => $serverIdsInFolders,
        ]);
    }

    public function show(Request $request, int $folder): JsonResponse
    {
        $user = $request->user();
        $serverFilter = $this->accessibleServersFilter($user);

        $folderModel = ServerFolder::where('user_id', $user->id)
            ->where('id', $folder)
            ->with(['servers' => $serverFilter])
            ->firstOrFail();

        $allFolders = ServerFolder::where('user_id', $user->id)
            ->orderBy('sort_order')
            ->with(['servers' => $serverFilter])
            ->get();

        $children = $this->buildFolderTree($allFolders, $folderModel->id);
        $folderModel->setRelation('children', $children);

        return new JsonResponse([
            'data' => $this->transformFolder($folderModel),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'slug' => 'nullable|string|max:100|regex:/^[a-z0-9-]+$/|unique:server_folders,slug,NULL,id,user_id,' . $request->user()->id,
            'color' => 'required|string|max:7|regex:/^#[0-9A-Fa-f]{6}$/',
            'parent_id' => 'nullable|integer',
        ]);

        $user = $request->user();

        $maxFolders = (int) ThemeSettings::getValue('advanced.max_server_folders', 10);
        $folderCount = ServerFolder::where('user_id', $user->id)->count();
        if ($folderCount >= $maxFolders) {
            return new JsonResponse(['error' => "You have reached the maximum limit of {$maxFolders} folders"], Response::HTTP_FORBIDDEN);
        }

        if (!empty($validated['parent_id'])) {
            $parentExists = ServerFolder::where('id', $validated['parent_id'])
                ->where('user_id', $user->id)
                ->exists();
            
            if (!$parentExists) {
                return new JsonResponse(['error' => 'Parent folder not found'], Response::HTTP_NOT_FOUND);
            }
        }

        $maxOrder = ServerFolder::where('user_id', $user->id)
            ->where('parent_id', $validated['parent_id'] ?? null)
            ->max('sort_order') ?? -1;

        $slug = array_key_exists('slug', $validated)
            ? ($validated['slug'] !== null ? Str::slug($validated['slug']) : null)
            : null;

        $folder = ServerFolder::create([
            'user_id' => $user->id,
            'parent_id' => $validated['parent_id'] ?? null,
            'name' => $validated['name'],
            'slug' => $slug,
            'color' => $validated['color'],
            'sort_order' => $maxOrder + 1,
        ]);

        return new JsonResponse([
            'data' => $this->transformFolder($folder),
        ], Response::HTTP_CREATED);
    }

    public function update(Request $request, int $folder): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:100',
            'slug' => 'sometimes|nullable|string|max:100|regex:/^[a-z0-9-]+$/',
            'color' => 'sometimes|required|string|max:7|regex:/^#[0-9A-Fa-f]{6}$/',
            'parent_id' => 'sometimes|nullable|integer',
            'sort_order' => 'sometimes|integer|min:0',
        ]);

        $user = $request->user();

        $folderModel = ServerFolder::where('id', $folder)
            ->where('user_id', $user->id)
            ->firstOrFail();

        if (array_key_exists('slug', $validated) && $validated['slug'] !== null) {
            $validated['slug'] = Str::slug($validated['slug']);
        }

        if (array_key_exists('slug', $validated)) {
            $slugExists = ServerFolder::where('user_id', $user->id)
                ->where('slug', $validated['slug'])
                ->where('id', '!=', $folderModel->id)
                ->exists();

            if ($slugExists) {
                return new JsonResponse(['error' => 'Slug already in use'], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
        }

        if (isset($validated['parent_id']) && $validated['parent_id'] !== null) {
            if ($validated['parent_id'] == $folder) {
                return new JsonResponse(['error' => 'Cannot move folder into itself'], Response::HTTP_BAD_REQUEST);
            }

            $descendantIds = $this->getAllDescendantIds($folderModel);
            if (in_array($validated['parent_id'], $descendantIds)) {
                return new JsonResponse(['error' => 'Cannot move folder into its descendant'], Response::HTTP_BAD_REQUEST);
            }

            $parentExists = ServerFolder::where('id', $validated['parent_id'])
                ->where('user_id', $user->id)
                ->exists();
            
            if (!$parentExists) {
                return new JsonResponse(['error' => 'Parent folder not found'], Response::HTTP_NOT_FOUND);
            }
        }

        $folderModel->update($validated);

        return new JsonResponse([
            'data' => $this->transformFolder($folderModel->fresh()),
        ]);
    }

    public function destroy(Request $request, int $folder): JsonResponse
    {
        $user = $request->user();

        $folderModel = ServerFolder::where('id', $folder)
            ->where('user_id', $user->id)
            ->firstOrFail();

        $folderModel->delete();

        return new JsonResponse([], Response::HTTP_NO_CONTENT);
    }

    public function addServer(Request $request, int $folder): JsonResponse
    {
        $validated = $request->validate([
            'server_id' => 'required|integer',
        ]);

        $user = $request->user();

        ServerFolder::where('id', $folder)
            ->where('user_id', $user->id)
            ->firstOrFail();

        if ($user->root_admin) {
            $server = Server::where('id', $validated['server_id'])->firstOrFail();
        } else {
            $server = $user->accessibleServers()
                ->where('servers.id', $validated['server_id'])
                ->firstOrFail();
        }

        DB::table('server_folder_servers')
            ->whereIn('folder_id', function ($query) use ($user) {
                $query->select('id')
                    ->from('server_folders')
                    ->where('user_id', $user->id);
            })
            ->where('server_id', $server->id)
            ->delete();

        $maxOrder = DB::table('server_folder_servers')
            ->where('folder_id', $folder)
            ->max('sort_order') ?? -1;

        DB::table('server_folder_servers')->insert([
            'folder_id' => $folder,
            'server_id' => $server->id,
            'sort_order' => $maxOrder + 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return new JsonResponse(['success' => true]);
    }

    public function removeServer(Request $request, int $folder, int $serverId): JsonResponse
    {
        $user = $request->user();

        $folderModel = ServerFolder::where('id', $folder)
            ->where('user_id', $user->id)
            ->firstOrFail();

        DB::table('server_folder_servers')
            ->where('folder_id', $folder)
            ->where('server_id', $serverId)
            ->delete();

        return new JsonResponse([], Response::HTTP_NO_CONTENT);
    }

    public function reorder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'folders' => 'required|array',
            'folders.*.id' => 'required|integer',
            'folders.*.sort_order' => 'required|integer|min:0',
        ]);

        $user = $request->user();

        foreach ($validated['folders'] as $item) {
            ServerFolder::where('id', $item['id'])
                ->where('user_id', $user->id)
                ->update(['sort_order' => $item['sort_order']]);
        }

        return new JsonResponse(['success' => true]);
    }

    private function accessibleServersFilter($user): \Closure
    {
        return function ($query) use ($user) {
            if ($user->root_admin) {
                return;
            }

            $query->where(function ($accessQuery) use ($user) {
                $accessQuery->where('servers.owner_id', $user->id)
                    ->orWhereIn('servers.id', function ($subQuery) use ($user) {
                        $subQuery->select('server_id')
                            ->from('subusers')
                            ->where('user_id', $user->id);
                    });
            });
        };
    }

    private function buildFolderTree(Collection $allFolders, $parentId = null): Collection
    {
        return $allFolders
            ->where('parent_id', $parentId)
            ->values()
            ->map(function (ServerFolder $folder) use ($allFolders) {
                $folder->setRelation('children', $this->buildFolderTree($allFolders, $folder->id));

                return $folder;
            });
    }

    private function transformFolder(ServerFolder $folder): array
    {
        return [
            'id' => $folder->id,
            'parent_id' => $folder->parent_id,
            'name' => $folder->name,
            'slug' => $folder->slug,
            'color' => $folder->color,
            'sort_order' => $folder->sort_order,
            'children' => $folder->relationLoaded('children') 
                ? $folder->children->map(fn ($child) => $this->transformFolder($child))->toArray()
                : [],
            'servers' => $folder->relationLoaded('servers')
                ? $folder->servers->map(fn ($server) => [
                    'id' => $server->id,
                    'uuid' => $server->uuid,
                    'name' => $server->name,
                    'sort_order' => $server->pivot->sort_order ?? 0,
                ])->toArray()
                : [],
            'server_count' => $folder->relationLoaded('servers') ? $folder->servers->count() : 0,
            'created_at' => $folder->created_at?->toIso8601String(),
            'updated_at' => $folder->updated_at?->toIso8601String(),
        ];
    }

    private function getAllDescendantIds(ServerFolder $folder): array
    {
        $ids = [];
        $folder->load('children');
        
        foreach ($folder->children as $child) {
            $ids[] = $child->id;
            $ids = array_merge($ids, $this->getAllDescendantIds($child));
        }
        
        return $ids;
    }
}
