<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\CommandHistory;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;

class CommandHistoryController extends ClientApiController
{
    public function index(Request $request, Server $server): JsonResponse
    {
        $user = $request->user();

        $history = CommandHistory::where('user_id', $user->id)
            ->where('server_id', $server->id)
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get();

        return new JsonResponse([
            'data' => $history->map(fn ($item) => [
                'id' => $item->id,
                'command' => $item->command,
                'created_at' => $item->created_at->toIso8601String(),
            ]),
        ]);
    }

    public function store(Request $request, Server $server): JsonResponse
    {
        $validated = $request->validate([
            'command' => 'required|string|max:1000',
        ]);

        $user = $request->user();

        $history = CommandHistory::create([
            'user_id' => $user->id,
            'server_id' => $server->id,
            'command' => $validated['command'],
        ]);

        return new JsonResponse([
            'data' => [
                'id' => $history->id,
                'command' => $history->command,
                'created_at' => $history->created_at->toIso8601String(),
            ],
        ], 201);
    }

    public function destroy(Request $request, Server $server, int $historyId): JsonResponse
    {
        $user = $request->user();

        CommandHistory::where('id', $historyId)
            ->where('user_id', $user->id)
            ->where('server_id', $server->id)
            ->delete();

        return new JsonResponse([], 204);
    }

    public function clear(Request $request, Server $server): JsonResponse
    {
        $user = $request->user();

        CommandHistory::where('user_id', $user->id)
            ->where('server_id', $server->id)
            ->delete();

        return new JsonResponse([], 204);
    }
}
