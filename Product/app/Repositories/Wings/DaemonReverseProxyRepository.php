<?php

namespace Pterodactyl\Repositories\Wings;

use GuzzleHttp\Exception\GuzzleException;
use Illuminate\Support\Facades\Log;
use Pterodactyl\Models\ReverseProxy;
use Webmozart\Assert\Assert;
use Pterodactyl\Models\Server;
use Pterodactyl\Exceptions\Http\Connection\DaemonConnectionException;
use Pterodactyl\Exceptions\DisplayException;

class DaemonReverseProxyRepository extends DaemonRepository
{
    public function create(ReverseProxy $proxy, array $data): array
    {
        Assert::isInstanceOf($this->server, Server::class);

        try {
            $response = $this->getHttpClient()->post(
                sprintf('/api/servers/%s/reverse-proxy', $this->server->uuid),
                ['json' => $data]
            );
        } catch (GuzzleException $exception) {
            throw $this->toReverseProxyException($exception, 'create', $proxy, $data);
        }

        return json_decode($response->getBody()->__toString(), true) ?: [];
    }

    public function delete(ReverseProxy $proxy, array $data = []): void
    {
        Assert::isInstanceOf($this->server, Server::class);

        $query = array_filter([
            'nginx_config_path' => $data['nginx_config_path'] ?? null,
            'nginx_enabled_path' => $data['nginx_enabled_path'] ?? null,
            'config_file_path' => $data['config_file_path'] ?? null,
        ], fn ($value) => is_string($value) && $value !== '');

        try {
            $this->getHttpClient()->delete(
                sprintf('/api/servers/%s/reverse-proxy/%s', $this->server->uuid, rawurlencode((string) $proxy->getAttribute('domain'))),
                ['query' => $query]
            );
        } catch (GuzzleException $exception) {
            throw $this->toReverseProxyException($exception, 'delete', $proxy, $query);
        }
    }

    private function toReverseProxyException(GuzzleException $exception, string $action, ReverseProxy $proxy, array $context = []): \Throwable
    {
        $response = method_exists($exception, 'getResponse') ? $exception->getResponse() : null;
        $status = $response?->getStatusCode();
        $requestId = $response?->getHeaderLine('X-Request-Id') ?: null;
        $body = null;
        $remoteError = null;

        if ($response) {
            $rawBody = (string) $response->getBody();
            $body = json_decode($rawBody, true);
            if (is_array($body) && !empty($body['error']) && is_string($body['error'])) {
                $remoteError = trim($body['error']);
            } elseif ($rawBody !== '') {
                $remoteError = trim($rawBody);
            }
        }

        Log::error('Reverse proxy Wings request failed', [
            'action' => $action,
            'proxy_id' => $proxy->id,
            'domain' => $proxy->domain,
            'server_id' => $this->server?->id,
            'server_uuid' => $this->server?->uuid,
            'node_id' => $this->node?->id,
            'http_status' => $status,
            'request_id' => $requestId,
            'remote_error' => $remoteError,
            'context' => $context,
            'exception' => $exception->getMessage(),
        ]);

        if ($remoteError) {
            $message = $remoteError;
            if ($requestId) {
                $message .= " (request id: {$requestId})";
            }

            return new DisplayException($message);
        }

        return new DaemonConnectionException($exception);
    }
}
