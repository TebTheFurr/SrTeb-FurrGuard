<?php

declare(strict_types=1);

/**
 * FurrGuard - entrega de los SPA compilados (landing/verificación y panel) con el nonce de la CSP.
 */

const SPA_JSON_FLAGS = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
    | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE;

/**
 * Responde con el index.html de un build de Vite (ver spaHtml). Sin build → 503.
 */
function serveSpa(string $indexFile, ?string $bootScript = null, int $status = 200): never
{
    header('Content-Type: text/html; charset=utf-8');
    $html = is_file($indexFile) ? file_get_contents($indexFile) : false;
    if ($html === false) {
        http_response_code(503);
        echo '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>FurrGuard</title></head>'
            . '<body><p>Servicio no disponible: falta compilar la interfaz.</p></body></html>';
        exit;
    }
    http_response_code($status);
    echo spaHtml($html, getCspNonce(), $bootScript);
    exit;
}

/**
 * Nonce en todos los <script> y, si hay `$bootScript`, un script en línea justo antes del primer
 * script de módulo (o antes de </head>).
 */
function spaHtml(string $html, string $nonce, ?string $bootScript): string
{
    if ($bootScript !== null) {
        $tag = '<script nonce="' . $nonce . '">' . $bootScript . "</script>\n  ";
        $position = preg_match('/<script\b[^>]*\btype=["\']?module\b/i', $html, $match, PREG_OFFSET_CAPTURE) === 1
            ? $match[0][1]
            : stripos($html, '</head>');
        $html = $position === false ? $tag . $html : substr_replace($html, $tag, $position, 0);
    }
    return (string) preg_replace('/<script\b(?![^>]*\bnonce=)/i', '<script nonce="' . $nonce . '"', $html);
}

/**
 * JSON seguro dentro de un <script> en línea (`<`, `>`, `&` y comillas escapados).
 */
function spaJson(mixed $value): string
{
    return (string) json_encode($value, SPA_JSON_FLAGS);
}
