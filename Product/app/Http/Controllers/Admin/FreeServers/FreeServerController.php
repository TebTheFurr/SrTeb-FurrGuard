<?php

namespace Pterodactyl\Http\Controllers\Admin\FreeServers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Schema;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Models\Egg;
use Pterodactyl\Models\User;
use Pterodactyl\Models\SignupOffer;
use Pterodactyl\Models\SignupOfferClaim;
use Pterodactyl\Services\FreeServers\FreeServerService;
use Carbon\Carbon;

class FreeServerController extends Controller
{
    protected function supportsAvailabilityType(): bool
    {
        return Schema::hasColumn('signup_offers', 'availability_type');
    }

    protected function normalisePayload(array $validated): array
    {
        $validated['location_ids'] = array_values(array_map('intval', $validated['location_ids'] ?? []));
        $validated['target_users'] = array_values(array_map('intval', $validated['target_users'] ?? []));
        $validated['dedicated_ip'] = (bool) ($validated['dedicated_ip'] ?? false);
        $validated['oom_disabled'] = (bool) ($validated['oom_disabled'] ?? false);
        $validated['start_on_completion'] = (bool) ($validated['start_on_completion'] ?? false);
        $validated['enabled'] = (bool) ($validated['enabled'] ?? false);
        $validated['target_type'] = ($validated['target_type'] ?? 'all') === 'specific' ? 'specific' : 'all';

        if ($this->supportsAvailabilityType()) {
            $validated['availability_type'] = ($validated['availability_type'] ?? 'register') === 'all_users'
                ? 'all_users'
                : 'register';
        }

        return $validated;
    }

    public function index(): JsonResponse
    {
        if (!FreeServerService::isInstalled()) {
            return response()->json(['error' => 'Addon not installed'], 404);
        }

        $offers = SignupOffer::with(['egg', 'nest'])
            ->withCount('claims')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($offer) {
                return [
                    'id' => $offer->id,
                    'name' => $offer->name,
                    'description' => $offer->description,
                    'server_name_template' => $offer->server_name_template,
                    'server_description' => $offer->server_description,
                    'egg_id' => $offer->egg_id,
                    'egg_name' => $offer->egg?->name ?? 'Unknown',
                    'nest_id' => $offer->nest_id,
                    'nest_name' => $offer->nest?->name ?? 'Unknown',
                    'location_ids' => array_map('intval', $offer->location_ids ?? []),
                    'dedicated_ip' => $offer->dedicated_ip,
                    'memory' => $offer->memory,
                    'swap' => $offer->swap,
                    'disk' => $offer->disk,
                    'io' => $offer->io,
                    'cpu' => $offer->cpu,
                    'threads' => $offer->threads,
                    'oom_disabled' => $offer->oom_disabled,
                    'database_limit' => $offer->database_limit,
                    'allocation_limit' => $offer->allocation_limit,
                    'backup_limit' => $offer->backup_limit,
                    'startup' => $offer->startup,
                    'image' => $offer->image,
                    'environment' => $offer->environment ?? [],
                    'start_on_completion' => $offer->start_on_completion,
                    'availability_type' => $this->supportsAvailabilityType()
                        ? ($offer->availability_type ?: 'register')
                        : 'register',
                    'target_type' => $offer->target_type,
                    'target_users' => $offer->target_users ?? [],
                    'claim_expiry_days' => $offer->claim_expiry_days,
                    'server_expiry_days' => $offer->server_expiry_days,
                    'enabled' => $offer->enabled,
                    'claims_count' => $offer->claims_count,
                    'created_at' => $offer->created_at?->toDateTimeString(),
                ];
            });

        return response()->json(['offers' => $offers]);
    }

    public function store(Request $request): JsonResponse
    {
        if (!FreeServerService::isInstalled()) {
            return response()->json(['error' => 'Addon not installed'], 404);
        }

        $rules = [
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'server_name_template' => 'nullable|string|max:255',
            'server_description' => 'nullable|string',
            'egg_id' => 'required|exists:eggs,id',
            'nest_id' => 'required|exists:nests,id',
            'location_ids' => 'required|array|min:1',
            'location_ids.*' => 'exists:locations,id',
            'dedicated_ip' => 'sometimes|boolean',
            'memory' => 'required|integer|min:0',
            'swap' => 'required|integer|min:-1',
            'disk' => 'required|integer|min:0',
            'io' => 'required|integer|min:10|max:1000',
            'cpu' => 'required|integer|min:0',
            'threads' => 'nullable|string',
            'oom_disabled' => 'sometimes|boolean',
            'database_limit' => 'required|integer|min:0',
            'allocation_limit' => 'required|integer|min:0',
            'backup_limit' => 'required|integer|min:0',
            'startup' => 'nullable|string',
            'image' => 'nullable|string',
            'environment' => 'nullable|array',
            'start_on_completion' => 'sometimes|boolean',
            'target_type' => 'required|in:all,specific',
            'target_users' => 'nullable|array',
            'target_users.*' => 'exists:users,id',
            'claim_expiry_days' => 'nullable|integer|min:1',
            'server_expiry_days' => 'nullable|integer|min:1',
            'enabled' => 'sometimes|boolean',
        ];
        if ($this->supportsAvailabilityType()) {
            $rules['availability_type'] = 'required|in:register,all_users';
        }

        $validated = $this->normalisePayload($request->validate($rules));

        $offer = new SignupOffer();
        $offer->fill($validated);
        $offer->save();

        return response()->json(['success' => true, 'offer' => $offer]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if (!FreeServerService::isInstalled()) {
            return response()->json(['error' => 'Addon not installed'], 404);
        }

        $offer = SignupOffer::findOrFail($id);

        $rules = [
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'server_name_template' => 'nullable|string|max:255',
            'server_description' => 'nullable|string',
            'egg_id' => 'required|exists:eggs,id',
            'nest_id' => 'required|exists:nests,id',
            'location_ids' => 'required|array|min:1',
            'location_ids.*' => 'exists:locations,id',
            'dedicated_ip' => 'sometimes|boolean',
            'memory' => 'required|integer|min:0',
            'swap' => 'required|integer|min:-1',
            'disk' => 'required|integer|min:0',
            'io' => 'required|integer|min:10|max:1000',
            'cpu' => 'required|integer|min:0',
            'threads' => 'nullable|string',
            'oom_disabled' => 'sometimes|boolean',
            'database_limit' => 'required|integer|min:0',
            'allocation_limit' => 'required|integer|min:0',
            'backup_limit' => 'required|integer|min:0',
            'startup' => 'nullable|string',
            'image' => 'nullable|string',
            'environment' => 'nullable|array',
            'start_on_completion' => 'sometimes|boolean',
            'target_type' => 'required|in:all,specific',
            'target_users' => 'nullable|array',
            'target_users.*' => 'exists:users,id',
            'claim_expiry_days' => 'nullable|integer|min:1',
            'server_expiry_days' => 'nullable|integer|min:1',
            'enabled' => 'sometimes|boolean',
        ];
        if ($this->supportsAvailabilityType()) {
            $rules['availability_type'] = 'required|in:register,all_users';
        }

        $validated = $this->normalisePayload($request->validate($rules));

        $offer->update($validated);

        return response()->json(['success' => true, 'offer' => $offer]);
    }

    public function delete(int $id): JsonResponse
    {
        if (!FreeServerService::isInstalled()) {
            return response()->json(['error' => 'Addon not installed'], 404);
        }

        $offer = SignupOffer::findOrFail($id);
        $offer->delete();

        return response()->json(['success' => true]);
    }

    public function eggVariables(int $eggId): JsonResponse
    {
        $egg = Egg::with('variables')->findOrFail($eggId);

        $variables = $egg->variables->map(function ($var) {
            return [
                'id' => $var->id,
                'name' => $var->name,
                'description' => $var->description,
                'env_variable' => $var->env_variable,
                'default_value' => $var->default_value,
                'rules' => $var->rules,
                'required' => $var->required,
            ];
        });

        $defaultImage = '';
        if (!empty($egg->docker_images)) {
            $images = array_values($egg->docker_images);
            $defaultImage = $images[0] ?? '';
        }

        return response()->json([
            'variables' => $variables,
            'startup' => $egg->startup,
            'docker_images' => $egg->docker_images ?? [],
            'default_image' => $defaultImage,
        ]);
    }

    public function issue(Request $request): JsonResponse
    {
        if (!FreeServerService::isInstalled()) {
            return response()->json(['error' => 'Addon not installed'], 404);
        }

        $validated = $request->validate([
            'offer_id' => 'required|exists:signup_offers,id',
            'user_ids' => 'required|array|min:1',
            'user_ids.*' => 'exists:users,id',
            'server_expiry_days' => 'nullable|integer|min:1',
            'claim_expiry_days' => 'nullable|integer|min:1',
        ]);

        $offer = SignupOffer::findOrFail($validated['offer_id']);
        $issued = 0;
        $skipped = 0;

        foreach ($validated['user_ids'] as $userId) {
            $existing = SignupOfferClaim::where('offer_id', $offer->id)
                ->where('user_id', $userId)
                ->first();

            if ($existing) {
                $skipped++;
                continue;
            }

            $claimExpiresAt = null;
            if (!empty($validated['claim_expiry_days'])) {
                $claimExpiresAt = Carbon::now()->addDays($validated['claim_expiry_days']);
            } elseif ($offer->claim_expiry_days) {
                $claimExpiresAt = Carbon::now()->addDays($offer->claim_expiry_days);
            }

            SignupOfferClaim::create([
                'offer_id' => $offer->id,
                'user_id' => $userId,
                'status' => SignupOfferClaim::STATUS_PENDING,
                'claim_expires_at' => $claimExpiresAt,
                'server_expiry_days_override' => $validated['server_expiry_days'] ?? null,
            ]);

            $issued++;
        }

        return response()->json([
            'success' => true,
            'issued' => $issued,
            'skipped' => $skipped,
        ]);
    }

    public function claims(): JsonResponse
    {
        if (!FreeServerService::isInstalled()) {
            return response()->json(['error' => 'Addon not installed'], 404);
        }

        $claims = SignupOfferClaim::with(['offer', 'user', 'server'])
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($claim) {
                $serverExpiresAt = $claim->server_expires_at;
                $claimExpiresAt = $claim->claim_expires_at;
                $now = Carbon::now();

                $serverCountdown = null;
                if ($serverExpiresAt && $claim->status === SignupOfferClaim::STATUS_CLAIMED) {
                    $diff = $now->diff($serverExpiresAt);
                    if ($serverExpiresAt->isFuture()) {
                        $serverCountdown = $this->formatCountdown($diff);
                    } else {
                        $serverCountdown = 'Expired';
                    }
                }

                $claimCountdown = null;
                if ($claimExpiresAt && $claim->status === SignupOfferClaim::STATUS_PENDING) {
                    $diff = $now->diff($claimExpiresAt);
                    if ($claimExpiresAt->isFuture()) {
                        $claimCountdown = $this->formatCountdown($diff);
                    } else {
                        $claimCountdown = 'Expired';
                    }
                }

                return [
                    'id' => $claim->id,
                    'offer_name' => $claim->offer?->name ?? 'Deleted Offer',
                    'user_id' => $claim->user_id,
                    'username' => $claim->user?->username ?? 'Unknown',
                    'email' => $claim->user?->email ?? '',
                    'server_name' => $claim->server?->name ?? null,
                    'server_id' => $claim->server_id,
                    'status' => $claim->status,
                    'claimed_at' => $claim->claimed_at?->toDateTimeString(),
                    'claim_expires_at' => $claimExpiresAt?->toDateTimeString(),
                    'claim_countdown' => $claimCountdown,
                    'server_expires_at' => $serverExpiresAt?->toDateTimeString(),
                    'server_countdown' => $serverCountdown,
                    'created_at' => $claim->created_at?->toDateTimeString(),
                ];
            });

        return response()->json(['claims' => $claims]);
    }

    private function formatCountdown(\DateInterval $diff): string
    {
        if ($diff->days > 0) {
            return $diff->days . 'd ' . $diff->h . 'h';
        }
        if ($diff->h > 0) {
            return $diff->h . 'h ' . $diff->i . 'm';
        }
        return $diff->i . 'm';
    }

    public function searchUsers(Request $request): JsonResponse
    {
        $query = $request->input('q', '');
        if (strlen($query) < 2) {
            return response()->json([]);
        }

        $users = User::where('username', 'like', "%{$query}%")
            ->orWhere('email', 'like', "%{$query}%")
            ->limit(10)
            ->get(['id', 'username', 'email']);

        return response()->json($users);
    }
}
