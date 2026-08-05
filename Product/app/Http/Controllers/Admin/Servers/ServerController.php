<?php

namespace Pterodactyl\Http\Controllers\Admin\Servers;

use Illuminate\View\View;
use Illuminate\Http\Request;
use Pterodactyl\Models\Server;
use Spatie\QueryBuilder\QueryBuilder;
use Spatie\QueryBuilder\AllowedFilter;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Models\Filters\AdminServerFilter;
use Illuminate\Http\RedirectResponse;
use Prologue\Alerts\AlertsMessageBag;
use Pterodactyl\Services\Servers\ServerCloningService;

class ServerController extends Controller
{
    public function __construct(
        private AlertsMessageBag $alert,
        private ServerCloningService $cloningService,
    ) {
    }

    /**
     * Returns all the servers that exist on the system using a paginated result set. If
     * a query is passed along in the request it is also passed to the repository function.
     */
    public function index(Request $request): View
    {
        $servers = QueryBuilder::for(Server::query()->with('node', 'user', 'allocation'))
            ->allowedFilters([
                AllowedFilter::exact('owner_id'),
                AllowedFilter::custom('*', new AdminServerFilter()),
            ])
            ->paginate(config()->get('pterodactyl.paginate.admin.servers'));

        return view('admin.servers.index', ['servers' => $servers]);
    }

    public function clone(Server $server): RedirectResponse
    {
        try {
            $clonedServer = $this->cloningService->handle($server);

            $this->alert->success('Server has been cloned successfully.')->flash();

            return redirect()->route('admin.servers.view', $clonedServer->id);
        } catch (\Exception $exception) {
            $this->alert->danger('Failed to clone server: ' . $exception->getMessage())->flash();

            return redirect()->route('admin.servers');
        }
    }
}
