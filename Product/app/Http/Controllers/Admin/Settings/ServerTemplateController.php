<?php

namespace Pterodactyl\Http\Controllers\Admin\Settings;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\ServerTemplate;
use Pterodactyl\Http\Controllers\Controller;

class ServerTemplateController extends Controller
{
    public function index(): JsonResponse
    {
        $templates = ServerTemplate::query()
            ->orderBy('order')
            ->orderBy('id')
            ->get()
            ->map(fn (ServerTemplate $template) => $template->toArray());

        return new JsonResponse([
            'data' => $templates,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $template = ServerTemplate::query()->create($this->validateTemplate($request));

        return new JsonResponse([
            'data' => $template->toArray(),
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $template = ServerTemplate::query()->findOrFail($id);
        $template->update($this->validateTemplate($request));

        return new JsonResponse([
            'data' => $template->toArray(),
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $template = ServerTemplate::query()->findOrFail($id);
        $template->delete();

        return new JsonResponse([], 204);
    }

    public function reorder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'templates' => ['required', 'array'],
            'templates.*.id' => ['required', 'integer', 'exists:server_templates,id'],
            'templates.*.order' => ['required', 'integer', 'min:0'],
        ]);

        foreach ($validated['templates'] as $item) {
            ServerTemplate::query()->where('id', $item['id'])->update([
                'order' => $item['order'],
            ]);
        }

        $templates = ServerTemplate::query()
            ->orderBy('order')
            ->orderBy('id')
            ->get()
            ->map(fn (ServerTemplate $template) => $template->toArray());

        return new JsonResponse([
            'data' => $templates,
        ]);
    }

    private function validateTemplate(Request $request): array
    {
        return $request->validate(ServerTemplate::$validationRules);
    }
}
