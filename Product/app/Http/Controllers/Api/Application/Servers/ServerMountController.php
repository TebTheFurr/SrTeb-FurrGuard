<?php
namespace Pterodactyl\Http\Controllers\Api\Application\Servers;
use Pterodactyl\Models\Mount;
use Pterodactyl\Models\Server;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Pterodactyl\Http\Controllers\Api\Application\ApplicationApiController;
class ServerMountController extends ApplicationApiController
{
    public function attach(Request $request, int $server, int $mount): JsonResponse
    {
        $s = Server::findOrFail($server);
        $m = Mount::findOrFail($mount);
        DB::table('mount_server')->insertOrIgnore(['mount_id' => $m->id, 'server_id' => $s->id]);
        return new JsonResponse([], 204);
    }
    public function detach(Request $request, int $server, int $mount): JsonResponse
    {
        $s = Server::findOrFail($server);
        $m = Mount::findOrFail($mount);
        DB::table('mount_server')->where('mount_id', $m->id)->where('server_id', $s->id)->delete();
        return new JsonResponse([], 204);
    }
}
