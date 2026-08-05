<?php

namespace Pterodactyl\Http\Controllers\Api\Client;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\SignupOfferClaim;
use Pterodactyl\Services\FreeServers\FreeServerService;

class FreeServerClaimController extends ClientApiController
{
    public function index(Request $request): JsonResponse
    {
        if (!class_exists(FreeServerService::class)) {
            return new JsonResponse(['claims' => []]);
        }

        $claims = FreeServerService::getPendingClaims($request->user());

        $formatted = collect($claims)->map(function ($claim) {
            $serverExpiryDays = $claim['server_expiry_days_override']
                ?? $claim['offer']['server_expiry_days']
                ?? null;

            return [
                'id' => $claim['id'],
                'offer_name' => $claim['offer']['name'] ?? 'Unknown',
                'offer_description' => $claim['offer']['description'] ?? '',
                'memory' => $claim['offer']['memory'] ?? 0,
                'disk' => $claim['offer']['disk'] ?? 0,
                'cpu' => $claim['offer']['cpu'] ?? 0,
                'claim_expires_at' => $claim['claim_expires_at'] ?? null,
                'server_expiry_days' => $serverExpiryDays,
            ];
        });

        return new JsonResponse(['claims' => $formatted]);
    }

    public function claim(Request $request, int $claimId): JsonResponse
    {
        if (!class_exists(FreeServerService::class)) {
            return new JsonResponse(['error' => 'FreeServers addon is not installed.'], 404);
        }

        $user = $request->user();

        $requireEmailVerified = (bool) FreeServerService::getSetting('require_email_verified', false);
        $require2fa = (bool) FreeServerService::getSetting('require_2fa', false);

        if ($requireEmailVerified && !$user->email_verified_at) {
            return new JsonResponse([
                'error' => 'You must verify your email address before claiming offers. Check your inbox for a verification link.',
            ], 403);
        }

        if ($require2fa && !$user->use_totp) {
            return new JsonResponse([
                'error' => 'You must enable two-factor authentication on your account before claiming offers.',
            ], 403);
        }

        $claim = SignupOfferClaim::where('id', $claimId)
            ->where('user_id', $user->id)
            ->firstOrFail();

        $result = FreeServerService::claimOffer($claim);

        if (!$result['success']) {
            return new JsonResponse(['error' => $result['error']], 422);
        }

        return new JsonResponse([
            'success' => true,
            'server_id' => $result['server_id'],
            'redirect_url' => $result['redirect_url'],
        ]);
    }
}
