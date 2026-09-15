<?php

declare(strict_types=1);

/**
 * FurrGuard - carga de variables de entorno desde `.env`.
 *
 * Formato admitido: `CLAVE=valor`, `export CLAVE=valor`, comentarios con `#` (línea completa o
 * tras un espacio), valores entre comillas dobles (con escapes \n \t \" \\) o simples (literales).
 * Nunca pisa una variable que ya exista en el entorno real (PHP-FPM, systemd, CLI).
 */

/**
 * @return array<string, string> Pares clave => valor, sin aplicar al entorno.
 */
function parseEnvFile(string $contents): array
{
    $vars = [];
    foreach (preg_split('/\R/', $contents) ?: [] as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') {
            continue;
        }
        if (!preg_match('/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\z/', $line, $m)) {
            continue;
        }
        $vars[$m[1]] = parseEnvValue($m[2]);
    }
    return $vars;
}

function parseEnvValue(string $raw): string
{
    if ($raw === '') {
        return '';
    }
    $quote = $raw[0];
    if ($quote === '"' || $quote === "'") {
        $end = $quote === '"' ? findClosingDoubleQuote($raw) : strpos($raw, "'", 1);
        if ($end !== false) {
            $inner = substr($raw, 1, $end - 1);
            return $quote === "'"
                ? $inner
                : strtr($inner, ['\\n' => "\n", '\\t' => "\t", '\\"' => '"', '\\\\' => '\\']);
        }
    }
    // Sin comillas: un " #" inicia comentario.
    $value = preg_replace('/\s+#.*\z/', '', $raw) ?? $raw;
    return trim($value);
}

function findClosingDoubleQuote(string $raw): int|false
{
    $len = strlen($raw);
    for ($i = 1; $i < $len; $i++) {
        if ($raw[$i] === '\\') {
            $i++;
        } elseif ($raw[$i] === '"') {
            return $i;
        }
    }
    return false;
}

function loadEnv(string $path): void
{
    if (!is_file($path) || !is_readable($path)) {
        return;
    }
    $contents = file_get_contents($path);
    if ($contents === false) {
        return;
    }
    foreach (parseEnvFile($contents) as $key => $value) {
        if (getenv($key) !== false || array_key_exists($key, $_ENV) || array_key_exists($key, $_SERVER)) {
            continue;
        }
        putenv($key . '=' . $value);
        $_ENV[$key] = $value;
    }
}

/**
 * Lee una variable de entorno (entorno real o `.env`).
 */
function env(string $key, string $default = ''): string
{
    $value = $_ENV[$key] ?? getenv($key);
    if (!is_string($value)) {
        $value = $_SERVER[$key] ?? null;
    }
    return is_string($value) ? $value : $default;
}
