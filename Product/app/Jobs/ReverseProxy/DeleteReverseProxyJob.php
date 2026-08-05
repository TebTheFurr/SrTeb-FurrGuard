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

class DeleteReverseProxyJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $tries = 3;
    public $timeout = 120;

    public function __construct(
        private int $proxyId
    ) {}

    public function handle(): void
    {
        $proxy = ReverseProxy::with(['server'])->find($this->proxyId);

        if (!$proxy) {
            Log::warning('Reverse proxy delete skipped: proxy not found', [
                'proxy_id' => $this->proxyId,
            ]);
            return;
        }

        try {
            Log::info('Deleting reverse proxy on Wings', [
                'proxy_id' => $proxy->id,
                'domain' => $proxy->domain,
                'server_id' => $proxy->server_id,
                'server_uuid' => $proxy->server?->uuid,
                'attempt' => $this->attempts(),
            ]);

            $repository = $this->repository();
            $repository->setServer($proxy->server);
            $repository->delete($proxy, [
                'nginx_config_path' => ReverseProxyService::getNginxConfigPath(),
                'nginx_enabled_path' => ReverseProxyService::getNginxEnabledPath(),
                'config_file_path' => $proxy->config_file_path,
            ]);

            $domain = $proxy->domain;
            $proxy->delete();

            Log::info('Successfully deleted reverse proxy', [
                'proxy_id' => $this->proxyId,
                'domain' => $domain,
            ]);
        } catch (\Throwable $e) {
            $message = trim($e->getMessage()) ?: $e::class;
            if (strlen($message) > 1800) {
                $message = substr($message, 0, 1800) . '...';
            }

            Log::error('Failed to delete reverse proxy', [
                'proxy_id' => $proxy->id,
                'domain' => $proxy->domain,
                'server_id' => $proxy->server_id,
                'server_uuid' => $proxy->server?->uuid,
                'attempt' => $this->attempts(),
                'error' => $message,
                'exception_class' => $e::class,
            ]);

            $proxy->update([
                'status' => ReverseProxy::STATUS_FAILED,
                'error_message' => $message,
            ]);

            throw $e;
        }
    }

    private function repository(): DaemonReverseProxyRepository
    {
        return app(DaemonReverseProxyRepository::class);
    }

    public function failed(\Throwable $exception): void
    {
        $message = trim($exception->getMessage()) ?: $exception::class;

        Log::error('DeleteReverseProxyJob failed permanently', [
            'proxy_id' => $this->proxyId,
            'error' => $message,
            'exception_class' => $exception::class,
        ]);

        $proxy = ReverseProxy::find($this->proxyId);
        if ($proxy) {
            $proxy->update([
                'status' => ReverseProxy::STATUS_FAILED,
                'error_message' => 'Delete failed after multiple attempts: ' . $message,
            ]);
        }
    }
}
