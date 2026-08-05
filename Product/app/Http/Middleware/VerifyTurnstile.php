<?php

namespace Pterodactyl\Http\Middleware;

use GuzzleHttp\Client;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Pterodactyl\Events\Auth\FailedCaptcha;
use Illuminate\Contracts\Events\Dispatcher;
use Pterodactyl\Models\ThemeSettings;
use Symfony\Component\HttpKernel\Exception\HttpException;

class VerifyTurnstile
{
    private const PROVIDERS = [
        'cloudflare_turnstile' => [
            'endpoint' => 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        ],
        'google_recaptcha' => [
            'endpoint' => 'https://www.google.com/recaptcha/api/siteverify',
        ],
        'hcaptcha' => [
            'endpoint' => 'https://hcaptcha.com/siteverify',
        ],
    ];

    public function __construct(private Dispatcher $dispatcher)
    {
    }

    public function handle(Request $request, \Closure $next): mixed
    {
        $provider = $this->getProvider();

        if ($provider === 'none') {
            return $next($request);
        }

        $token = $request->input('captcha-response');
        $result = null;

        if (!empty($token) && is_string($token) && strlen($token) <= 2048) {
            try {
                $client = new Client();
                $res = $client->post(self::PROVIDERS[$provider]['endpoint'], [
                    'form_params' => [
                        'secret' => $this->getSecretKey($provider),
                        'response' => $token,
                        'remoteip' => $request->ip(),
                    ],
                    'timeout' => 10,
                ]);

                if ($res->getStatusCode() === 200) {
                    $body = $res->getBody()->getContents();
                    $result = json_decode($body, false);

                    if ($result && isset($result->success) && $result->success === true) {
                        return $next($request);
                    }
                }
            } catch (\Exception $e) {
                $result = null;
            }
        }

        $this->dispatcher->dispatch(
            new FailedCaptcha(
                $request->ip(),
                $result && isset($result->hostname) ? $result->hostname : null
            )
        );

        throw new HttpException(Response::HTTP_BAD_REQUEST, 'Failed to validate captcha verification.');
    }

    private function getProvider(): string
    {
        $provider = (string) ThemeSettings::getValue('advanced.captcha.provider', 'none');

        if ($provider === 'none' && ThemeSettings::getValue('advanced.turnstile_enabled', false)) {
            return 'cloudflare_turnstile';
        }

        return array_key_exists($provider, self::PROVIDERS) ? $provider : 'none';
    }

    private function getSecretKey(string $provider): string
    {
        $secretKey = (string) ThemeSettings::getValue("advanced.captcha.providers.{$provider}.secret_key", '');

        if ($provider === 'cloudflare_turnstile' && $secretKey === '') {
            return (string) ThemeSettings::getValue('advanced.turnstile_secret_key', '');
        }

        return $secretKey;
    }
}
