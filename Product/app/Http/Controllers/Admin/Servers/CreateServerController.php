<?php

namespace Pterodactyl\Http\Controllers\Admin\Servers;

use Illuminate\View\View;
use Pterodactyl\Models\Nest;
use Pterodactyl\Models\Node;
use Pterodactyl\Models\Location;
use Pterodactyl\Models\ThemeSettings;
use Pterodactyl\Models\ServerTemplate;
use Illuminate\Http\RedirectResponse;
use Prologue\Alerts\AlertsMessageBag;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Repositories\Eloquent\NestRepository;
use Pterodactyl\Repositories\Eloquent\NodeRepository;
use Pterodactyl\Http\Requests\Admin\ServerFormRequest;
use Pterodactyl\Services\Servers\ServerCreationService;

class CreateServerController extends Controller
{
    /**
     * CreateServerController constructor.
     */
    public function __construct(
        private AlertsMessageBag $alert,
        private NestRepository $nestRepository,
        private NodeRepository $nodeRepository,
        private ServerCreationService $creationService,
    ) {
    }

    /**
     * Displays the create server page.
     *
     * @throws \Pterodactyl\Exceptions\Repository\RecordNotFoundException
     */
    public function index(): View|RedirectResponse
    {
        $nodes = Node::all();
        if (count($nodes) < 1) {
            $this->alert->warning(trans('admin/server.alerts.node_required'))->flash();

            return redirect()->route('admin.nodes');
        }

        $nests = $this->nestRepository->getWithEggs();

        \JavaScript::put([
            'nodeData' => $this->nodeRepository->getNodesForServerCreation(),
            'nests' => $nests->map(function (Nest $item) {
                return array_merge($item->toArray(), [
                    'eggs' => $item->eggs->keyBy('id')->toArray(),
                ]);
            })->keyBy('id'),
        ]);

        $serverTemplates = collect();

        try {
            $serverTemplates = ServerTemplate::query()->orderBy('order')->orderBy('id')->get();
        } catch (\Throwable) {
        }

        return view('admin.servers.new', [
            'locations' => Location::all(),
            'nests' => $nests,
            'serverTemplates' => $serverTemplates,
            'subdomainsEnabled' => class_exists(\Pterodactyl\Services\Subdomains\SubdomainService::class)
                && (bool) ThemeSettings::getValue('addons.subdomains_manager.enabled', true),
            'reverseProxiesEnabled' => file_exists(base_path('app/Services/ReverseProxy/ReverseProxyService.php'))
                && (bool) ThemeSettings::getValue('addons.reverse_proxy_manager.enabled', true),
            'serverSplitterEnabled' => file_exists(base_path('app/Services/ServerSplitter/ServerSplitterService.php'))
                && (bool) ThemeSettings::getValue('addons.server_splitter.enabled', true),
        ]);
    }

    /**
     * Create a new server on the remote system.
     *
     * @throws \Illuminate\Validation\ValidationException
     * @throws \Pterodactyl\Exceptions\DisplayException
     * @throws \Pterodactyl\Exceptions\Service\Deployment\NoViableAllocationException
     * @throws \Pterodactyl\Exceptions\Service\Deployment\NoViableNodeException
     * @throws \Throwable
     */
    public function store(ServerFormRequest $request): RedirectResponse
    {
        $data = $request->except(['_token']);
        if (!empty($data['custom_image'])) {
            $data['image'] = $data['custom_image'];
            unset($data['custom_image']);
        }

        if (!empty($data['template_id'])) {
            $template = ServerTemplate::query()->find($data['template_id']);
            if ($template) {
                $data = $template->applyToServerData($data);
            }
        }
        unset($data['template_id']);

        $server = $this->creationService->handle($data);

        $this->alert->success(trans('admin/server.alerts.server_created'))->flash();

        return new RedirectResponse('/admin/servers/view/' . $server->id);
    }
}
