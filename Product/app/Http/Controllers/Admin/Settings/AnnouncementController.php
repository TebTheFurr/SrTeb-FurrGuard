<?php

namespace Pterodactyl\Http\Controllers\Admin\Settings;

use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Models\Announcement;

class AnnouncementController extends Controller
{
    public function index(): JsonResponse
    {
        $announcements = Announcement::orderBy('order')->orderBy('created_at', 'desc')->get();

        return response()->json($announcements);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validateAnnouncement($request, true);
        $announcement = Announcement::create($validated);

        return response()->json($announcement, 201);
    }

    public function show(Announcement $announcement): JsonResponse
    {
        return response()->json($announcement);
    }

    public function update(Request $request, Announcement $announcement): JsonResponse
    {
        $validated = $this->validateAnnouncement($request, false);
        $announcement->update($validated);

        return response()->json($announcement);
    }

    public function destroy(Announcement $announcement): JsonResponse
    {
        $announcement->delete();

        return response()->json(['message' => 'Announcement deleted successfully']);
    }

    private function validateAnnouncement(Request $request, bool $creating): array
    {
        $payload = $request->all();

        if (array_key_exists('egg_ids', $payload) && is_array($payload['egg_ids']) && count($payload['egg_ids']) === 0) {
            $payload['egg_ids'] = null;
        }

        if (array_key_exists('node_ids', $payload) && is_array($payload['node_ids']) && count($payload['node_ids']) === 0) {
            $payload['node_ids'] = null;
        }

        if (($payload['is_permanent'] ?? false) === true) {
            $payload['expires_at'] = null;
        } elseif (!empty($payload['expires_at']) && is_string($payload['expires_at'])) {
            $payload['expires_at'] = str_replace('T', ' ', $payload['expires_at']);
        }

        $request->merge($payload);

        $rules = [
            'enabled' => 'boolean',
            'variation' => ($creating ? 'required' : 'sometimes') . '|string|in:split,solid,outline',
            'placement' => ($creating ? 'required' : 'sometimes') . '|string|in:above-content,topbar',
            'type' => ($creating ? 'required' : 'sometimes') . '|string|in:info,success,warning,error',
            'icon' => ($creating ? 'required' : 'sometimes') . '|string',
            'title' => 'nullable|string|max:255',
            'text' => 'nullable|string',
            'button_label' => 'nullable|string|max:255',
            'button_link' => 'nullable|string|max:500',
            'egg_ids' => 'nullable|array',
            'egg_ids.*' => 'integer|exists:eggs,id',
            'node_ids' => 'nullable|array',
            'node_ids.*' => 'integer|exists:nodes,id',
            'is_permanent' => 'boolean',
            'expires_at' => 'nullable|date',
            'order' => 'nullable|integer',
        ];

        $validated = $request->validate($rules);

        if (!empty($validated['expires_at'])) {
            $validated['expires_at'] = Carbon::parse($validated['expires_at']);
        }

        return $validated;
    }
}
