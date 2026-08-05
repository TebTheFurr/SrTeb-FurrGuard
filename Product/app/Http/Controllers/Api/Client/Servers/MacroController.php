<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\ServerMacro;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;

class MacroController extends ClientApiController
{
    public function index(Request $request, Server $server): JsonResponse
    {
        $macros = ServerMacro::where('server_id', $server->id)
            ->orderBy('shortcut', 'asc')
            ->get();

        return new JsonResponse([
            'data' => $macros->map(fn ($macro) => [
                'id' => $macro->id,
                'shortcut' => $macro->shortcut,
                'output' => $macro->output,
                'arguments' => $macro->arguments ?? [],
                'created_at' => $macro->created_at->toIso8601String(),
                'updated_at' => $macro->updated_at->toIso8601String(),
            ]),
        ]);
    }

    public function store(Request $request, Server $server): JsonResponse
    {
        $validated = $request->validate([
            'shortcut' => 'required|string|max:100',
            'output' => 'required|string|max:5000',
            'arguments' => 'nullable|array',
            'arguments.*.name' => 'required|string|max:50',
        ]);

        $existing = ServerMacro::where('server_id', $server->id)
            ->where('shortcut', $validated['shortcut'])
            ->first();

        if ($existing) {
            return new JsonResponse([
                'error' => 'A macro with this shortcut already exists.',
            ], 422);
        }

        $macro = ServerMacro::create([
            'server_id' => $server->id,
            'shortcut' => $validated['shortcut'],
            'output' => $validated['output'],
            'arguments' => $validated['arguments'] ?? [],
        ]);

        return new JsonResponse([
            'data' => [
                'id' => $macro->id,
                'shortcut' => $macro->shortcut,
                'output' => $macro->output,
                'arguments' => $macro->arguments ?? [],
                'created_at' => $macro->created_at->toIso8601String(),
                'updated_at' => $macro->updated_at->toIso8601String(),
            ],
        ], 201);
    }

    public function update(Request $request, Server $server, int $macroId): JsonResponse
    {
        $macro = ServerMacro::where('id', $macroId)
            ->where('server_id', $server->id)
            ->firstOrFail();

        $validated = $request->validate([
            'shortcut' => 'required|string|max:100',
            'output' => 'required|string|max:5000',
            'arguments' => 'nullable|array',
            'arguments.*.name' => 'required|string|max:50',
        ]);

        $existing = ServerMacro::where('server_id', $server->id)
            ->where('shortcut', $validated['shortcut'])
            ->where('id', '!=', $macroId)
            ->first();

        if ($existing) {
            return new JsonResponse([
                'error' => 'A macro with this shortcut already exists.',
            ], 422);
        }

        $macro->update([
            'shortcut' => $validated['shortcut'],
            'output' => $validated['output'],
            'arguments' => $validated['arguments'] ?? [],
        ]);

        return new JsonResponse([
            'data' => [
                'id' => $macro->id,
                'shortcut' => $macro->shortcut,
                'output' => $macro->output,
                'arguments' => $macro->arguments ?? [],
                'created_at' => $macro->created_at->toIso8601String(),
                'updated_at' => $macro->updated_at->toIso8601String(),
            ],
        ]);
    }

    public function destroy(Request $request, Server $server, int $macroId): JsonResponse
    {
        ServerMacro::where('id', $macroId)
            ->where('server_id', $server->id)
            ->delete();

        return new JsonResponse([], 204);
    }
}
