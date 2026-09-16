<?php

return [
    /*
    |--------------------------------------------------------------------------
    | FurrGuard
    |--------------------------------------------------------------------------
    |
    | Origin of the FurrGuard installation (scheme and host only, e.g.
    | https://furrguard.example.com) and the HMAC key shared with it: generate
    | it with `openssl rand -hex 32` and put the very same string in
    | PTERODACTYL_PANEL_KEY of the FurrGuard .env.
    |
    | While either of them is empty the integration is disabled: the FurrGuard
    | button is hidden and its routes answer 404.
    |
    */

    'url' => env('FURRGUARD_URL', ''),

    'key' => env('FURRGUARD_PANEL_KEY', ''),

    /*
    | Seconds allowed for each request to FurrGuard. Its own calls to Discord
    | and Mojang happen inside this window, so keep it generous.
    */
    'timeout' => (int) env('FURRGUARD_TIMEOUT', 20),
];
