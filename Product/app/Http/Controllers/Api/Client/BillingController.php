<?php

namespace Pterodactyl\Http\Controllers\Api\Client;

use Throwable;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\ThemeSettings;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;

class BillingController extends ClientApiController
{
    public function show(Request $request, Server $server): JsonResponse
    {
        if ($request->user()->id !== $server->owner_id) {
            return response()->json(['error' => 'You do not have permission to view billing details for this server.'], 403);
        }

        $settings = ThemeSettings::getValue('advanced.billing_integration', []);
        $enabled = (bool) ($settings['enabled'] ?? false);
        $platform = ($settings['platform'] ?? 'whmcs') === 'paymenter' ? 'paymenter' : 'whmcs';
        $billingUrl = $this->normaliseBillingUrl((string) ($settings['billing_url'] ?? ''));
        $serviceId = trim((string) ($server->external_id ?? ''));

        if (!$enabled || $billingUrl === '' || $serviceId === '') {
            return response()->json([
                'enabled' => false,
                'configured' => $enabled && $billingUrl !== '',
                'platform' => $platform,
            ]);
        }

        $server->loadMissing('user');

        try {
            $cacheKey = sprintf('billing:%s:%s:%s', $platform, $server->id, sha1($serviceId . '|' . $billingUrl));
            $data = Cache::remember($cacheKey, now()->addMinutes(5), function () use ($platform, $settings, $billingUrl, $serviceId, $server) {
                return $platform === 'paymenter'
                    ? $this->getPaymenterBilling($settings, $billingUrl, $serviceId, $server)
                    : $this->getWhmcsBilling($settings, $billingUrl, $serviceId, $server);
            });

            return response()->json($data);
        } catch (Throwable $exception) {
            Log::warning('Failed to fetch billing details.', [
                'server_id' => $server->id,
                'platform' => $platform,
                'exception' => $exception->getMessage(),
            ]);

            return response()->json([
                'enabled' => true,
                'configured' => true,
                'platform' => $platform,
                'serviceId' => $serviceId,
                'error' => 'Billing details could not be loaded right now.',
            ], 502);
        }
    }

    private function getWhmcsBilling(array $settings, string $billingUrl, string $serviceId, Server $server): array
    {
        $identifier = trim((string) ($settings['api_identifier'] ?? ''));
        $secret = trim((string) ($settings['api_secret'] ?? ''));
        $accessKey = trim((string) ($settings['api_key'] ?? ''));

        if ($identifier === '' || $secret === '') {
            return $this->notConfigured('whmcs', $serviceId);
        }

        $productResponse = $this->whmcsRequest($billingUrl, [
            'identifier' => $identifier,
            'secret' => $secret,
            'accesskey' => $accessKey,
            'action' => 'GetClientsProducts',
            'serviceid' => $serviceId,
            'limitnum' => 1,
            'responsetype' => 'json',
        ]);

        $products = $productResponse['products']['product'] ?? [];
        $product = is_array($products) && array_is_list($products) ? ($products[0] ?? null) : $products;

        if (!is_array($product)) {
            return $this->emptyBilling('whmcs', $serviceId, $billingUrl);
        }

        $billingEmail = $server->user?->email;
        $clientId = $product['clientid'] ?? null;

        if ($clientId) {
            $clientResponse = $this->whmcsRequest($billingUrl, [
                'identifier' => $identifier,
                'secret' => $secret,
                'accesskey' => $accessKey,
                'action' => 'GetClientsDetails',
                'clientid' => $clientId,
                'responsetype' => 'json',
            ], false);

            if (($clientResponse['result'] ?? null) === 'success') {
                $billingEmail = $clientResponse['client']['email'] ?? $clientResponse['email'] ?? $billingEmail;
            }
        }

        $amount = $product['recurringamount'] ?? $product['amount'] ?? $product['firstpaymentamount'] ?? null;
        $productName = $product['name'] ?? $product['productname'] ?? $product['groupname'] ?? 'Billing service';

        return [
            'enabled' => true,
            'configured' => true,
            'platform' => 'whmcs',
            'serviceId' => (string) ($product['id'] ?? $serviceId),
            'productName' => $productName,
            'planName' => $product['billingcycle'] ?? null,
            'status' => $product['status'] ?? null,
            'amount' => $amount !== null ? (string) $amount : null,
            'billingCycle' => $product['billingcycle'] ?? null,
            'billingEmail' => $billingEmail,
            'nextDueDate' => $this->normaliseDate($product['nextduedate'] ?? null),
            'renewsAt' => $this->normaliseDate($product['nextduedate'] ?? null),
            'expiresAt' => null,
            'viewUrl' => $billingUrl . '/clientarea.php?action=productdetails&id=' . urlencode((string) ($product['id'] ?? $serviceId)),
        ];
    }

    private function getPaymenterBilling(array $settings, string $billingUrl, string $serviceId, Server $server): array
    {
        $apiKey = trim((string) ($settings['api_key'] ?? ''));

        if ($apiKey === '') {
            return $this->notConfigured('paymenter', $serviceId);
        }

        $response = Http::withToken($apiKey)
            ->acceptJson()
            ->timeout(15)
            ->get($billingUrl . '/api/v1/admin/services/' . urlencode($serviceId), [
                'include' => 'user,product,invoices,properties',
            ]);

        if (!$response->successful()) {
            throw new \RuntimeException('Paymenter returned HTTP ' . $response->status());
        }

        $payload = $response->json();
        $service = $payload['data'] ?? $payload;
        $attributes = is_array($service['attributes'] ?? null) ? $service['attributes'] : $service;
        $user = $this->includedRelationship($payload, $service, 'user');
        $product = $this->includedRelationship($payload, $service, 'product');
        $plan = $this->includedRelationship($payload, $service, 'plan');

        $planId = $attributes['plan_id'] ?? $service['relationships']['plan']['data']['id'] ?? null;
        if (!$plan && $planId) {
            $plan = $this->fetchPaymenterPlan($apiKey, $billingUrl, (string) $planId);
        }

        if (!$plan && $product) {
            $productId = $product['id'] ?? $product['attributes']['id'] ?? null;
            if ($productId) {
                $plan = $this->fetchPaymenterPlanFromProduct($apiKey, $billingUrl, (string) $productId, $planId ? (string) $planId : null);
            }
        }

        $productAttributes = is_array($product['attributes'] ?? null) ? $product['attributes'] : [];
        $planAttributes = is_array($plan['attributes'] ?? null) ? $plan['attributes'] : [];
        $userAttributes = is_array($user['attributes'] ?? null) ? $user['attributes'] : [];

        $currency = $attributes['currency_code'] ?? $attributes['currency'] ?? $planAttributes['currency_code'] ?? null;
        $price = $attributes['price'] ?? $attributes['amount'] ?? $planAttributes['price'] ?? null;
        $amount = $price !== null && $price !== '' ? trim((string) $price . ($currency ? ' ' . $currency : '')) : null;

        $billingCycle = $this->formatPaymenterBillingCycle($planAttributes);
        if ($billingCycle === null) {
            $billingCycle = $planAttributes['billing_cycle']
                ?? $planAttributes['period']
                ?? $attributes['billing_cycle']
                ?? null;
        }

        $nextDueDate = $attributes['expires_at']
            ?? $attributes['next_due_date']
            ?? $attributes['renews_at']
            ?? null;

        return [
            'enabled' => true,
            'configured' => true,
            'platform' => 'paymenter',
            'serviceId' => (string) ($attributes['id'] ?? $service['id'] ?? $serviceId),
            'productName' => $productAttributes['name'] ?? $attributes['product_name'] ?? 'Billing service',
            'planName' => $planAttributes['name'] ?? $attributes['plan_name'] ?? null,
            'status' => $attributes['status'] ?? null,
            'amount' => $amount,
            'billingCycle' => $billingCycle,
            'billingEmail' => $userAttributes['email'] ?? $server->user?->email,
            'nextDueDate' => $this->normaliseDate($nextDueDate),
            'renewsAt' => $this->normaliseDate($attributes['expires_at'] ?? $attributes['renews_at'] ?? $nextDueDate),
            'expiresAt' => $this->normaliseDate($attributes['expires_at'] ?? null),
            'viewUrl' => $billingUrl . '/services/' . urlencode((string) ($service['id'] ?? $serviceId)),
        ];
    }

    private function fetchPaymenterPlan(string $apiKey, string $billingUrl, string $planId): ?array
    {
        $response = Http::withToken($apiKey)
            ->acceptJson()
            ->timeout(15)
            ->get($billingUrl . '/api/v1/admin/plans/' . urlencode($planId));

        if (!$response->successful()) {
            return null;
        }

        $payload = $response->json();
        $plan = $payload['data'] ?? $payload;

        return is_array($plan) ? $plan : null;
    }

    private function fetchPaymenterPlanFromProduct(string $apiKey, string $billingUrl, string $productId, ?string $planId): ?array
    {
        $response = Http::withToken($apiKey)
            ->acceptJson()
            ->timeout(15)
            ->get($billingUrl . '/api/v1/admin/products/' . urlencode($productId), [
                'include' => 'plans',
            ]);

        if (!$response->successful()) {
            return null;
        }

        $payload = $response->json();
        $product = $payload['data'] ?? $payload;
        $relationshipData = $product['relationships']['plans']['data'] ?? [];

        if (!is_array($relationshipData)) {
            return null;
        }

        $plans = array_values(array_filter(
            $payload['included'] ?? [],
            fn ($included) => in_array($included['type'] ?? null, ['plans', 'plan'], true)
        ));

        if ($planId !== null) {
            foreach ($plans as $plan) {
                if ((string) ($plan['id'] ?? '') === $planId) {
                    return $plan;
                }
            }
        }

        return $plans[0] ?? null;
    }

    private function formatPaymenterBillingCycle(array $planAttributes): ?string
    {
        $period = (int) ($planAttributes['billing_period'] ?? 0);
        $unit = strtolower(trim((string) ($planAttributes['billing_unit'] ?? $planAttributes['time_interval'] ?? '')));

        if ($period > 0 && $unit !== '') {
            $unitLabel = match ($unit) {
                'day', 'days' => 'Day',
                'week', 'weeks' => 'Week',
                'month', 'months' => 'Month',
                'year', 'years' => 'Year',
                default => ucfirst(rtrim($unit, 's')) . ($period === 1 ? '' : 's'),
            };

            if ($period !== 1 && !str_ends_with($unitLabel, 's')) {
                $unitLabel .= 's';
            }

            return 'Every ' . $period . ' ' . $unitLabel;
        }

        $name = trim((string) ($planAttributes['name'] ?? ''));
        if ($name !== '') {
            return $name;
        }

        $type = strtolower(str_replace('_', '-', trim((string) ($planAttributes['type'] ?? ''))));
        if ($type === 'free') {
            return 'Free';
        }
        if ($type === 'one-time') {
            return 'One time';
        }

        return null;
    }

    private function whmcsRequest(string $billingUrl, array $data, bool $throwOnError = true): array
    {
        $response = Http::asForm()
            ->acceptJson()
            ->timeout(15)
            ->post($billingUrl . '/includes/api.php', array_filter($data, fn($value) => $value !== ''));

        if (!$response->successful()) {
            throw new \RuntimeException('WHMCS returned HTTP ' . $response->status());
        }

        $payload = $response->json();

        if (!is_array($payload)) {
            throw new \RuntimeException('WHMCS returned an invalid response.');
        }

        if ($throwOnError && ($payload['result'] ?? null) !== 'success') {
            throw new \RuntimeException((string) ($payload['message'] ?? 'WHMCS request failed.'));
        }

        return $payload;
    }

    private function includedRelationship(array $payload, array $resource, string $relationship): ?array
    {
        $relationshipData = $resource['relationships'][$relationship]['data'] ?? null;

        if (!$relationshipData || !isset($relationshipData['type'], $relationshipData['id'])) {
            return null;
        }

        foreach (($payload['included'] ?? []) as $included) {
            if (($included['type'] ?? null) === $relationshipData['type'] && (string) ($included['id'] ?? '') === (string) $relationshipData['id']) {
                return $included;
            }
        }

        return null;
    }

    private function normaliseBillingUrl(string $url): string
    {
        $url = trim($url);
        if ($url === '') {
            return '';
        }

        if (!preg_match('/^https?:\/\//i', $url)) {
            $url = 'https://' . $url;
        }

        return rtrim($url, '/');
    }

    private function normaliseDate(mixed $date): ?string
    {
        $date = trim((string) ($date ?? ''));

        if ($date === '' || $date === '0000-00-00' || $date === '0000-00-00 00:00:00') {
            return null;
        }

        return $date;
    }

    private function notConfigured(string $platform, string $serviceId): array
    {
        return [
            'enabled' => true,
            'configured' => false,
            'platform' => $platform,
            'serviceId' => $serviceId,
        ];
    }

    private function emptyBilling(string $platform, string $serviceId, string $billingUrl): array
    {
        return [
            'enabled' => true,
            'configured' => true,
            'platform' => $platform,
            'serviceId' => $serviceId,
            'productName' => 'Billing service not found',
            'status' => 'unknown',
            'viewUrl' => $platform === 'whmcs'
                ? $billingUrl . '/clientarea.php?action=productdetails&id=' . urlencode($serviceId)
                : $billingUrl . '/services/' . urlencode($serviceId),
        ];
    }
}
