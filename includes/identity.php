<?php

declare(strict_types=1);

/**
 * FurrGuard - normalización de identidades (docs/API.md §0).
 *
 * Todas las funciones son puras: devuelven null si la entrada no es válida.
 */

const IPV4_MIN_PREFIX = 8;
const IPV6_MIN_PREFIX = 16;

/**
 * UUID en minúsculas con guiones (8-4-4-4-12). Acepta 32 hex o el formato canónico.
 */
function normalizeUuid(?string $uuid): ?string
{
    if ($uuid === null) {
        return null;
    }
    $uuid = strtolower(trim($uuid));
    if (preg_match('/^[0-9a-f]{32}\z/', $uuid)) {
        return substr($uuid, 0, 8) . '-' . substr($uuid, 8, 4) . '-' . substr($uuid, 12, 4) . '-'
            . substr($uuid, 16, 4) . '-' . substr($uuid, 20);
    }
    return preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/', $uuid) ? $uuid : null;
}

/**
 * IP canónica (`inet_ntop(inet_pton())`), sin zona (`%eth0`) y con las IPv4 mapeadas
 * (`::ffff:1.2.3.4`) convertidas a IPv4.
 */
function normalizeIp(?string $ip): ?string
{
    $binary = ipToBinary($ip);
    return $binary === null ? null : binaryToIp($binary);
}

/**
 * Dirección en binario (4 o 16 bytes) ya desmapeada, o null si no es una IP.
 */
function ipToBinary(?string $ip): ?string
{
    if ($ip === null) {
        return null;
    }
    $ip = trim($ip);
    $zone = strpos($ip, '%');
    if ($zone !== false && str_contains($ip, ':')) {
        $ip = substr($ip, 0, $zone);
    }
    if ($ip === '' || filter_var($ip, FILTER_VALIDATE_IP) === false) {
        return null;
    }
    $binary = inet_pton($ip);
    if ($binary === false) {
        return null;
    }
    if (strlen($binary) === 16 && str_starts_with($binary, str_repeat("\0", 10) . "\xff\xff")) {
        return substr($binary, 12);
    }
    return $binary;
}

function binaryToIp(string $binary): string
{
    $ip = inet_ntop($binary);
    if ($ip === false) {
        throw new InvalidArgumentException('Dirección binaria inválida');
    }
    return $ip;
}

/**
 * 'ipv4' | 'ipv6' | null.
 */
function ipFamily(?string $ip): ?string
{
    $binary = ipToBinary($ip);
    if ($binary === null) {
        return null;
    }
    return strlen($binary) === 4 ? 'ipv4' : 'ipv6';
}

/**
 * CIDR canónico (dirección de red + prefijo). Prefijo mínimo /8 en IPv4 y /16 en IPv6.
 * Un rango IPv4 escrito como IPv6 mapeada (`::ffff:10.0.0.0/104`) se convierte a IPv4.
 */
function normalizeCidr(?string $cidr): ?string
{
    if ($cidr === null) {
        return null;
    }
    $parts = explode('/', trim($cidr));
    if (count($parts) !== 2 || !preg_match('/^\d{1,3}\z/', $parts[1])) {
        return null;
    }
    $address = trim($parts[0]);
    $prefix = (int) $parts[1];
    $binary = ipToBinary($address);
    if ($binary === null) {
        return null;
    }
    // ipToBinary desmapea: si la entrada era IPv6 y ahora son 4 bytes, el prefijo venía en base 128.
    if (strlen($binary) === 4 && str_contains($address, ':')) {
        $prefix -= 96;
    }
    $maxBits = strlen($binary) * 8;
    $minBits = strlen($binary) === 4 ? IPV4_MIN_PREFIX : IPV6_MIN_PREFIX;
    if ($prefix < $minBits || $prefix > $maxBits) {
        return null;
    }
    return binaryToIp(applyPrefixMask($binary, $prefix)) . '/' . $prefix;
}

/**
 * Pone a cero los bits de host.
 */
function applyPrefixMask(string $binary, int $prefix): string
{
    $out = '';
    $length = strlen($binary);
    for ($i = 0; $i < $length; $i++) {
        $bits = max(0, min(8, $prefix - $i * 8));
        $mask = $bits === 0 ? 0 : (0xff << (8 - $bits)) & 0xff;
        $out .= chr(ord($binary[$i]) & $mask);
    }
    return $out;
}

/**
 * `AS` + número. Acepta `AS1234`, `as1234`, `1234`, `AS 1234` y `AS1234 Nombre del operador`.
 */
function normalizeAsn(?string $asn): ?string
{
    if ($asn === null || !preg_match('/^\s*(?:AS\s*)?(\d{1,10})(?:\s.*)?\z/is', $asn, $m)) {
        return null;
    }
    $number = (int) $m[1];
    return $number >= 1 && $number <= 4294967295 ? 'AS' . $number : null;
}

/**
 * Nick de Minecraft: `^[.*]?[A-Za-z0-9_]{1,16}$` y como mucho 16 caracteres en total
 * (el prefijo `.` o `*` lo añade Floodgate a los jugadores de Bedrock).
 */
function isValidNick(string $nick): bool
{
    return strlen($nick) <= 16 && preg_match('/^[.*]?[A-Za-z0-9_]{1,16}\z/', $nick) === 1;
}

/**
 * ¿Está la IP dentro del CIDR? Un CIDR sin prefijo se compara como IP exacta.
 * Familias distintas o entradas inválidas → false.
 */
function ipInCidr(string $ip, string $cidr): bool
{
    $ipBinary = ipToBinary($ip);
    if ($ipBinary === null) {
        return false;
    }
    if (!str_contains($cidr, '/')) {
        return $ipBinary === ipToBinary($cidr);
    }
    [$address, $bits] = explode('/', trim($cidr), 2);
    if (!preg_match('/^\d{1,3}\z/', $bits)) {
        return false;
    }
    $prefix = (int) $bits;
    $rangeBinary = ipToBinary($address);
    if ($rangeBinary === null) {
        return false;
    }
    if (strlen($rangeBinary) === 4 && str_contains($address, ':')) {
        $prefix -= 96;
    }
    if (strlen($ipBinary) !== strlen($rangeBinary) || $prefix < 0 || $prefix > strlen($ipBinary) * 8) {
        return false;
    }
    return applyPrefixMask($ipBinary, $prefix) === applyPrefixMask($rangeBinary, $prefix);
}

/**
 * Red /64 de una IPv6 (`2001:db8:1:2::/64`), o null si no es IPv6.
 */
function ipv6Prefix64Cidr(string $ip): ?string
{
    $binary = ipToBinary($ip);
    if ($binary === null || strlen($binary) !== 16) {
        return null;
    }
    return binaryToIp(applyPrefixMask($binary, 64)) . '/64';
}

/**
 * Clave del ámbito de una IP: la IPv4 exacta o la red /64 de una IPv6.
 */
function ipScopeKey(string $ip): ?string
{
    $family = ipFamily($ip);
    if ($family === null) {
        return null;
    }
    return $family === 'ipv4' ? normalizeIp($ip) : ipv6Prefix64Cidr($ip);
}

/**
 * Misma IPv4, o misma red /64 si son IPv6. Entradas inválidas → false.
 */
function sameIpScope(?string $a, ?string $b): bool
{
    if ($a === null || $b === null) {
        return false;
    }
    $keyA = ipScopeKey($a);
    return $keyA !== null && $keyA === ipScopeKey($b);
}
