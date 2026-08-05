<?php

namespace Pterodactyl\Http\Controllers\Admin;

use Ramsey\Uuid\Uuid;
use Illuminate\View\View;
use Illuminate\Http\Request;
use Pterodactyl\Models\Nest;
use Illuminate\Http\Response;
use Pterodactyl\Models\Mount;
use Pterodactyl\Models\Location;
use Illuminate\Http\RedirectResponse;
use Prologue\Alerts\AlertsMessageBag;
use Illuminate\View\Factory as ViewFactory;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Http\Requests\Admin\MountFormRequest;
use Pterodactyl\Repositories\Eloquent\MountRepository;
use Pterodactyl\Contracts\Repository\NestRepositoryInterface;
use Pterodactyl\Contracts\Repository\LocationRepositoryInterface;

class MountController extends Controller
{
    /**
     * MountController constructor.
     */
    public function __construct(
        protected AlertsMessageBag $alert,
        protected NestRepositoryInterface $nestRepository,
        protected LocationRepositoryInterface $locationRepository,
        protected MountRepository $repository,
        protected ViewFactory $view,
    ) {
        $this->middleware(function ($request, $next) {
            if (filter_var(env('IS_DEMO', false), FILTER_VALIDATE_BOOLEAN)) {
                abort(403, 'This section is disabled on the demo site.');
            }
            return $next($request);
        });
    }

    /**
     * Return the mount overview page.
     */
    public function index(): View
    {
        return view('admin.mounts.index', [
            'mounts' => $this->repository->getAllWithDetails(),
        ]);
    }

    /**
     * Return the mount view page.
     *
     * @throws \Pterodactyl\Exceptions\Repository\RecordNotFoundException
     */
    public function view(string $id): View
    {
        $nests = Nest::query()->with('eggs')->get();
        $locations = Location::query()->with('nodes')->get();

        return view('admin.mounts.view', [
            'mount' => $this->repository->getWithRelations($id),
            'nests' => $nests,
            'locations' => $locations,
        ]);
    }

    /**
     * Handle request to create new mount.
     *
     * @throws \Throwable
     */
    public function create(MountFormRequest $request): RedirectResponse
    {
        if (filter_var(env('IS_DEMO', false), FILTER_VALIDATE_BOOLEAN)) {
            $this->alert->danger('This action is disabled on the demo site.')->flash();
            return redirect()->route('admin.mounts');
        }

        $model = (new Mount())->fill($request->validated());
        $model->forceFill(['uuid' => Uuid::uuid4()->toString()]);

        $model->saveOrFail();
        $mount = $model->fresh();

        $this->alert->success('Mount was created successfully.')->flash();

        return redirect()->route('admin.mounts.view', $mount->id);
    }

    /**
     * Handle request to update or delete location.
     *
     * @throws \Throwable
     */
    public function update(MountFormRequest $request, Mount $mount): RedirectResponse
    {
        if (filter_var(env('IS_DEMO', false), FILTER_VALIDATE_BOOLEAN)) {
            $this->alert->danger('This action is disabled on the demo site.')->flash();
            return redirect()->route('admin.mounts.view', $mount->id);
        }

        if ($request->input('action') === 'delete') {
            return $this->delete($request, $mount);
        }

        $mount->forceFill($request->validated())->save();

        $this->alert->success('Mount was updated successfully.')->flash();

        return redirect()->route('admin.mounts.view', $mount->id);
    }

    /**
     * Delete a location from the system.
     *
     * @throws \Exception
     */
    public function delete(MountFormRequest $request, Mount $mount): RedirectResponse
    {
        if (filter_var(env('IS_DEMO', false), FILTER_VALIDATE_BOOLEAN)) {
            $this->alert->danger('This action is disabled on the demo site.')->flash();
            return redirect()->route('admin.mounts.view', $mount->id);
        }

        $mount->delete();

        return redirect()->route('admin.mounts');
    }

    /**
     * Adds eggs to the mount's many-to-many relation.
     */
    public function addEggs(Request $request, Mount $mount): RedirectResponse
    {
        if (filter_var(env('IS_DEMO', false), FILTER_VALIDATE_BOOLEAN)) {
            $this->alert->danger('This action is disabled on the demo site.')->flash();
            return redirect()->route('admin.mounts.view', $mount->id);
        }

        $validatedData = $request->validate([
            'eggs' => 'required|exists:eggs,id',
        ]);

        $eggs = $validatedData['eggs'] ?? [];
        if (count($eggs) > 0) {
            $mount->eggs()->attach($eggs);
        }

        $this->alert->success('Mount was updated successfully.')->flash();

        return redirect()->route('admin.mounts.view', $mount->id);
    }

    /**
     * Adds nodes to the mount's many-to-many relation.
     */
    public function addNodes(Request $request, Mount $mount): RedirectResponse
    {
        if (filter_var(env('IS_DEMO', false), FILTER_VALIDATE_BOOLEAN)) {
            $this->alert->danger('This action is disabled on the demo site.')->flash();
            return redirect()->route('admin.mounts.view', $mount->id);
        }

        $data = $request->validate(['nodes' => 'required|exists:nodes,id']);

        $nodes = $data['nodes'] ?? [];
        if (count($nodes) > 0) {
            $mount->nodes()->attach($nodes);
        }

        $this->alert->success('Mount was updated successfully.')->flash();

        return redirect()->route('admin.mounts.view', $mount->id);
    }

    /**
     * Deletes an egg from the mount's many-to-many relation.
     */
    public function deleteEgg(Request $request, Mount $mount, int $egg_id): Response
    {
        if (filter_var(env('IS_DEMO', false), FILTER_VALIDATE_BOOLEAN)) {
            return response('', 403);
        }

        $mount->eggs()->detach($egg_id);

        return response('', 204);
    }

    /**
     * Deletes a node from the mount's many-to-many relation.
     */
    public function deleteNode(Request $request, Mount $mount, int $node_id): Response
    {
        if (filter_var(env('IS_DEMO', false), FILTER_VALIDATE_BOOLEAN)) {
            return response('', 403);
        }

        $mount->nodes()->detach($node_id);

        return response('', 204);
    }
}
