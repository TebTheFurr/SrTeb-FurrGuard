<?php

declare(strict_types=1);

namespace Pterodactyl\Http\Controllers\Base;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\RedirectResponse;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Services\FurrGuard\FurrGuardClient;
use Pterodactyl\Exceptions\FurrGuard\FurrGuardException;
use Pterodactyl\Services\FurrGuard\FurrGuardSessionStore;

/**
 * Browser-facing routes of FurrGuard: the Discord login bridge (FurrGuard
 * docs/API.md §9.2). FurrGuard owns the Discord application; the panel only
 * carries the browser to Discord and the code back to FurrGuard.
 */
class FurrGuardAuthController extends Controller
{
    private const DISCORD_HOSTS = ['discord.com', 'discordapp.com', 'ptb.discord.com', 'canary.discord.com'];

    private const CODE_REGEX = '/^[A-Za-z0-9._~-]{1,200}$/';

    public function __construct(private FurrGuardClient $client, private FurrGuardSessionStore $sessions)
    {
    }

    /**
     * GET /furrguard/login: asks FurrGuard for the Discord URL and sends the browser there.
     */
    public function login(Request $request): RedirectResponse
    {
        try {
            $data = $this->client->call('oauth_start', [], null, $request);
        } catch (FurrGuardException $exception) {
            return $this->toPage(['error' => $this->errorCode($exception)]);
        }

        $url = is_array($data) && is_string($data['url'] ?? null) ? $data['url'] : '';
        $state = is_array($data) && is_string($data['state'] ?? null) ? $data['state'] : '';

        if (!$this->isDiscordUrl($url) || !$this->sessions->putOauth($request, $state)) {
            Log::warning('FurrGuard returned an unusable OAuth start response.');

            return $this->toPage(['error' => 'discord']);
        }

        return redirect()->away($url);
    }

    /**
     * GET /furrguard/callback: Discord comes back here; the code is exchanged by
     * FurrGuard and the resulting session is kept in the panel session.
     */
    public function callback(Request $request): RedirectResponse
    {
        $oauth = $this->sessions->pullOauth($request);
        if (is_null($oauth)) {
            return $this->toPage();
        }

        $state = $request->query('state');
        if ($oauth['expired'] || !is_string($state) || !hash_equals($oauth['state'], $state)) {
            return $this->toPage(['error' => 'discord']);
        }

        // Discord redirects with ?error=access_denied when the user cancels.
        if (!is_null($request->query('error'))) {
            return $this->toPage(['error' => 'cancelled']);
        }

        $code = $request->query('code');
        if (!is_string($code) || preg_match(self::CODE_REGEX, $code) !== 1) {
            return $this->toPage(['error' => 'discord']);
        }

        try {
            $data = $this->client->call('oauth_exchange', ['state' => $oauth['state'], 'code' => $code], null, $request);
        } catch (FurrGuardException $exception) {
            // The identity just chosen is the one that matters: drop any older one.
            $this->sessions->forget($request);

            if ($exception->is(FurrGuardException::NO_ACCESS)) {
                return $this->toPage(['error' => 'no_access']);
            }

            return $this->toPage(['error' => $this->errorCode($exception)]);
        }

        if (!is_array($data) || !$this->sessions->put($request, $data)) {
            Log::warning('FurrGuard returned an unusable OAuth exchange response.');

            return $this->toPage(['error' => 'discord']);
        }

        return $this->toPage();
    }

    /**
     * Error code the page shows for a failed call to FurrGuard. Each one points at a
     * different place to look: the network, the shared key/clock/IP, the bridge itself
     * (nginx, .env, a proxy answering HTML) or Discord.
     */
    private function errorCode(FurrGuardException $exception): string
    {
        if ($exception->is(FurrGuardException::UNREACHABLE) || $exception->is(FurrGuardException::NOT_CONFIGURED)) {
            return 'unreachable';
        }

        if ($exception->is('database_unavailable')) {
            return 'unavailable';
        }

        if (in_array($exception->getSlug(), ['panel_signature', 'panel_ip'], true)) {
            return 'rejected';
        }

        if (in_array($exception->getSlug(), ['not_found', 'invalid_response', 'discord_unconfigured'], true)) {
            return 'bridge';
        }

        return $exception->getStatusCode() === 429 ? 'rate_limited' : 'discord';
    }

    private function isDiscordUrl(string $url): bool
    {
        $parts = parse_url($url);
        if (!is_array($parts) || !isset($parts['scheme'], $parts['host'])) {
            return false;
        }

        return strtolower($parts['scheme']) === 'https' && in_array(strtolower($parts['host']), self::DISCORD_HOSTS, true);
    }

    /**
     * Redirects to the FurrGuard page, optionally with ?error=... for the page to explain what happened.
     */
    private function toPage(array $query = []): RedirectResponse
    {
        return redirect()->to('/furrguard' . ($query === [] ? '' : '?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986)));
    }
}
