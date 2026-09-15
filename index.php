<?php
/**
 * FurrGuard - Landing Page (Vue 3 Entry Point)
 *
 * @author GrinchHorizon
 * @copyright SrTeb Limited
 * @website https://srteb.eu
 * @version 5.0.0
 */

require_once __DIR__ . '/config.php';

// CSP nonce from security.php
$nonce = getCspNonce();

// Serve built Vue app from public/dist/
$distHtml = @file_get_contents(__DIR__ . '/public/dist/index.html');
if ($distHtml === false) {
    http_response_code(503);
    echo '<!DOCTYPE html><html><body style="background:#0a0a0f;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:Inter,sans-serif"><div><h1>Error</h1><p>Ejecuta <code>npm run build</code> en el directorio public.</p></div></body></html>';
    exit;
}

// Inject font preloads and session data into <head>
$fontLinks = <<<'HTML'
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="icon" type="image/png" href="/icono-furguard.png">
<link rel="apple-touch-icon" href="/icono-furguard.png">
HTML;

$sessionScript = '<script nonce="' . $nonce . '">' . "\n"
    . 'window.__FURRGUARD_VERSION__ = ' . json_encode(FURRGUARD_VERSION) . ";\n"
    . '</script>';

// Insert fonts + session script before closing </head>
$distHtml = str_replace('</head>', $fontLinks . "\n" . $sessionScript . "\n</head>", $distHtml);

// Add nonce to all script tags
$distHtml = preg_replace('/<script(?![^>]*nonce=)/', '<script nonce="' . $nonce . '"', $distHtml);

echo $distHtml;
