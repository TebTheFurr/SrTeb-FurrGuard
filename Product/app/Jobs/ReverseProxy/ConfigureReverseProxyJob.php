<?php

namespace Pterodactyl\Jobs\ReverseProxy;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Pterodactyl\Models\ReverseProxy;
use Pterodactyl\Repositories\Wings\DaemonReverseProxyRepository;
use Pterodactyl\Services\ReverseProxy\ReverseProxyService;

class ConfigureReverseProxyJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;
    public $timeout = 300;

    public function __construct(
        private int $proxyId
    ) {}

    public function handle(): void
    {
        $proxy = ReverseProxy::with(['server', 'allocation'])->find($this->proxyId);

        if (!$proxy) {
            Log::error('Reverse proxy configure skipped: proxy not found', [
                'proxy_id' => $this->proxyId,
            ]);
            return;
        }

        try {
            if (!$proxy->dns_verified_at) {
                $proxy->update([
                    'status' => ReverseProxy::STATUS_PENDING,
                    'error_message' => 'Waiting for DNS confirmation.',
                ]);

                return;
            }

            $allocation = $proxy->allocation;

            if (!$allocation) {
                throw new \RuntimeException('The selected allocation for this reverse proxy could not be found.');
            }

            if ($proxy->ssl_enabled && $proxy->ssl_type === ReverseProxy::SSL_TYPE_CLOUDFLARE_ORIGIN) {
                throw new \RuntimeException('Cloudflare Origin SSL automation is not implemented. Switch SSL type to Certbot, or configure Cloudflare Origin certificates manually in nginx.');
            }

            if ($proxy->ssl_enabled && $proxy->ssl_type === ReverseProxy::SSL_TYPE_CERTBOT && ReverseProxyService::getCertbotEmail() === '') {
                throw new \RuntimeException('Certbot email is not configured. Set it in Theme Editor > Addons > Reverse Proxy Manager.');
            }

            $targetIp = ReverseProxyService::resolveTargetIp($allocation);
            $payload = [
                'domain' => $proxy->domain,
                'allocation_id' => $allocation->id,
                'target_ip' => $targetIp,
                'target_port' => $allocation->port,
                'proxy_type' => ReverseProxy::PROXY_TYPE_NGINX,
                'ssl_enabled' => $proxy->ssl_enabled,
                'ssl_type' => $proxy->ssl_type,
                'certbot_email' => ReverseProxyService::getCertbotEmail(),
                'nginx_config_path' => ReverseProxyService::getNginxConfigPath(),
                'nginx_enabled_path' => ReverseProxyService::getNginxEnabledPath(),
            ];

            Log::info('Configuring reverse proxy on Wings', [
                'proxy_id' => $proxy->id,
                'domain' => $proxy->domain,
                'server_id' => $proxy->server_id,
                'server_uuid' => $proxy->server?->uuid,
                'allocation_id' => $allocation->id,
                'target_ip' => $targetIp,
                'target_port' => $allocation->port,
                'ssl_enabled' => $proxy->ssl_enabled,
                'ssl_type' => $proxy->ssl_type,
                'attempt' => $this->attempts(),
            ]);

            $repository = $this->repository();
            $repository->setServer($proxy->server);

            $response = $repository->create($proxy, $payload);

            $proxy->update([
                'status' => ReverseProxy::STATUS_ACTIVE,
                'error_message' => null,
                'config_file_path' => $response['config_file_path'] ?? $proxy->config_file_path,
                'ssl_certificate_path' => $response['ssl_certificate_path'] ?? $proxy->ssl_certificate_path,
                'ssl_key_path' => $response['ssl_key_path'] ?? $proxy->ssl_key_path,
            ]);

            Log::info('Successfully configured reverse proxy', [
                'proxy_id' => $proxy->id,
                'domain' => $proxy->domain,
                'config_file_path' => $response['config_file_path'] ?? null,
            ]);
        } catch (\Throwable $e) {
            $message = $this->formatErrorMessage($e);

            Log::error('Failed to configure reverse proxy', [
                'proxy_id' => $proxy->id,
                'domain' => $proxy->domain,
                'server_id' => $proxy->server_id,
                'server_uuid' => $proxy->server?->uuid,
                'ssl_enabled' => $proxy->ssl_enabled,
                'ssl_type' => $proxy->ssl_type,
                'attempt' => $this->attempts(),
                'retryable' => $this->isRetryable($message),
                'error' => $message,
                'exception_class' => $e::class,
            ]);

            $proxy->update([
                'status' => ReverseProxy::STATUS_FAILED,
                'error_message' => $message,
            ]);

            if (!$this->isRetryable($message)) {
                return;
            }

            throw $e;
        }
    }

    private function repository(): DaemonReverseProxyRepository
    {
        return app(DaemonReverseProxyRepository::class);
    }

    private function formatErrorMessage(\Throwable $exception): string
    {
        $message = trim($exception->getMessage());
        if ($message === '') {
            $message = $exception::class;
        }

        if (strlen($message) > 1800) {
            return substr($message, 0, 1800) . '...';
        }

        return $message;
    }

    private function isRetryable(string $message): bool
    {
        $lower = strtolower($message);

        foreach ([
            'ratelimited',
            'rate limited',
            'too many failed authorizations',
            'too many certificates',
            'some challenges have failed',
            'authorizationerror',
            'certbot email is required',
            'certbot email is not configured',
            'invalid domain',
            'port does not belong',
            'unsupported proxy type',
            'cloudflare origin ssl',
            'nxdomain',
            'dns problem',
            'unauthorized',
            'invalid response from',
        ] as $needle) {
            if (str_contains($lower, $needle)) {
                return false;
            }
        }

        return true;
    }

    public function failed(\Throwable $exception): void
    {
        $message = $this->formatErrorMessage($exception);

        Log::error('ConfigureReverseProxyJob failed permanently', [
            'proxy_id' => $this->proxyId,
            'error' => $message,
            'exception_class' => $exception::class,
        ]);

        $proxy = ReverseProxy::find($this->proxyId);
        if ($proxy) {
            $proxy->update([
                'status' => ReverseProxy::STATUS_FAILED,
                'error_message' => 'Failed after multiple attempts: ' . $message,
            ]);
        }
    }
}
