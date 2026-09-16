<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Tebby Vault
    |--------------------------------------------------------------------------
    |
    | Origin of the vault (scheme and host only, e.g. https://vault.tebby.lgbt)
    | and the HMAC key shared with it (generate it with `openssl rand -hex 32`
    | and give the vault the very same string).
    |
    | While either of them is empty the integration is disabled: the Vault
    | features are hidden from users, native backups keep working and the
    | vault:* commands exit without doing anything.
    |
    */

    'url' => env('VAULT_URL', ''),

    'key' => env('VAULT_PANEL_KEY', ''),

    /*
    | Seconds allowed for each control request to the vault. Downloads are
    | streamed and only bounded by an inactivity timeout on the stream.
    */
    'timeout' => (int) env('VAULT_TIMEOUT', 20),
];
