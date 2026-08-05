<?php

namespace Pterodactyl\Http\Controllers\Api\Client;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Models\Announcement;

class AnnouncementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $nodeId = $request->query('node_id');
        $eggIds = $request->query('egg_ids', []);

        if (is_string($eggIds)) {
            $eggIds = explode(',', $eggIds);
            $eggIds = array_map('intval', $eggIds);
        }

        $query = Announcement::active()->orderBy('order')->orderBy('created_at', 'desc');

        if ($nodeId) {
            $query->forNode((int) $nodeId);
        }

        if (!empty($eggIds)) {
            $query->forEggs($eggIds);
        }

        $announcements = $query->get();

        return response()->json($announcements);
    }
}
