<?php

declare(strict_types=1);

/**
 * FurrGuard - entrada y salida HTTP: cuerpo JSON, accesores tipados, respuestas JSON (formato
 * panel y formato plugin), paginación y un cliente GET mínimo con timeouts.
 */

const JSON_BODY_MAX_BYTES = 1048576;
const JSON_FLAGS = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE;
const PAGINATION_DEFAULT_PER_PAGE = 25;
const PAGINATION_MAX_PER_PAGE = 100;
const DATABASE_RETRY_AFTER_SECONDS = 5;

/**
 * Error con código HTTP y slug. Los endpoints lo convierten en respuesta con respondHttpError().
 */
class HttpError extends RuntimeException
{
    public function __construct(public readonly int $status, public readonly string $slug, string $message)
    {
        parent::__construct($message);
    }
}

/**
 * Dato de entrada inválido (422). `field` es el campo afectado.
 */
final class ValidationError extends HttpError
{
    public function __construct(string $message, public readonly ?string $field = null)
    {
        parent::__construct(422, 'validation', $message);
    }
}

// ─── Cuerpo ─────────────────────────────────────────────────────────────────

/**
 * Lee `php://input` como objeto JSON (máx. 1 MB).
 *
 * @return array<string, mixed>
 * @throws HttpError 400 si es demasiado grande o no es un objeto JSON.
 */
function readJsonBody(int $maxBytes = JSON_BODY_MAX_BYTES): array
{
    $raw = file_get_contents('php://input', false, null, 0, $maxBytes + 1);
    if ($raw === false) {
        throw new HttpError(400, 'invalid_body', 'No se pudo leer la solicitud.');
    }
    if (strlen($raw) > $maxBytes) {
        throw new HttpError(400, 'body_too_large', 'La solicitud es demasiado grande.');
    }
    return parseJsonObject($raw);
}

/**
 * @return array<string, mixed>
 * @throws HttpError 400 si no es un objeto JSON.
 */
function parseJsonObject(string $raw): array
{
    $trimmed = ltrim($raw);
    if ($trimmed === '' || $trimmed[0] !== '{') {
        throw new HttpError(400, 'invalid_json', 'El cuerpo debe ser un objeto JSON.');
    }
    try {
        $data = json_decode($trimmed, true, 64, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        throw new HttpError(400, 'invalid_json', 'El cuerpo debe ser un objeto JSON válido.');
    }
    if (!is_array($data)) {
        throw new HttpError(400, 'invalid_json', 'El cuerpo debe ser un objeto JSON.');
    }
    /** @var array<string, mixed> $data */
    return $data;
}

// ─── Accesores tipados (JSON o $_POST) ──────────────────────────────────────

/**
 * Texto obligatorio (recortado). Si falta o queda vacío y hay `$default`, devuelve el defecto.
 *
 * @param array<array-key, mixed> $in
 */
function inputString(array $in, string $key, int $maxLength = 255, int $minLength = 1, ?string $default = null): string
{
    $value = inputOptionalString($in, $key, $maxLength);
    if ($value === null) {
        if ($default !== null) {
            return $default;
        }
        throw new ValidationError("El campo {$key} es obligatorio.", $key);
    }
    if (mb_strlen($value) < $minLength) {
        throw new ValidationError("El campo {$key} debe tener al menos {$minLength} caracteres.", $key);
    }
    return $value;
}

/**
 * Texto opcional: ausente, null o vacío (tras recortar) → null.
 *
 * @param array<array-key, mixed> $in
 */
function inputOptionalString(array $in, string $key, int $maxLength = 255): ?string
{
    $value = $in[$key] ?? null;
    if ($value === null) {
        return null;
    }
    if (is_int($value)) {
        $value = (string) $value;
    }
    if (!is_string($value)) {
        throw new ValidationError("El campo {$key} debe ser texto.", $key);
    }
    if (!mb_check_encoding($value, 'UTF-8')) {
        throw new ValidationError("El campo {$key} contiene caracteres no válidos.", $key);
    }
    $value = trim($value);
    if ($value === '') {
        return null;
    }
    if (mb_strlen($value) > $maxLength) {
        throw new ValidationError("El campo {$key} no puede superar {$maxLength} caracteres.", $key);
    }
    return $value;
}

/**
 * Entero en [min, max]. Acepta int o texto decimal. Si falta y hay `$default`, devuelve el defecto.
 *
 * @param array<array-key, mixed> $in
 */
function inputInt(array $in, string $key, int $min = PHP_INT_MIN, int $max = PHP_INT_MAX, ?int $default = null): int
{
    $value = inputOptionalInt($in, $key, $min, $max);
    if ($value === null) {
        if ($default !== null) {
            return $default;
        }
        throw new ValidationError("El campo {$key} es obligatorio.", $key);
    }
    return $value;
}

/**
 * @param array<array-key, mixed> $in
 */
function inputOptionalInt(array $in, string $key, int $min = PHP_INT_MIN, int $max = PHP_INT_MAX): ?int
{
    $value = $in[$key] ?? null;
    if ($value === null || $value === '') {
        return null;
    }
    if (is_string($value) && preg_match('/^\s*-?\d{1,18}\s*\z/', $value)) {
        $value = (int) trim($value);
    }
    if (!is_int($value)) {
        throw new ValidationError("El campo {$key} debe ser un número entero.", $key);
    }
    if ($value < $min || $value > $max) {
        throw new ValidationError("El campo {$key} debe estar entre {$min} y {$max}.", $key);
    }
    return $value;
}

/**
 * Booleano: true/false, 1/0, "1"/"0", "true"/"false". Si falta y hay `$default`, devuelve el defecto.
 *
 * @param array<array-key, mixed> $in
 */
function inputBool(array $in, string $key, ?bool $default = null): bool
{
    $value = $in[$key] ?? null;
    if ($value === null || $value === '') {
        if ($default !== null) {
            return $default;
        }
        throw new ValidationError("El campo {$key} es obligatorio.", $key);
    }
    $parsed = parseBool($value);
    if ($parsed === null) {
        throw new ValidationError("El campo {$key} debe ser verdadero o falso.", $key);
    }
    return $parsed;
}

function parseBool(mixed $value): ?bool
{
    if (is_bool($value)) {
        return $value;
    }
    if ($value === 1 || $value === 0) {
        return $value === 1;
    }
    if (is_string($value)) {
        return match (strtolower(trim($value))) {
            '1', 'true' => true,
            '0', 'false' => false,
            default => null,
        };
    }
    return null;
}

/**
 * Uno de los valores permitidos (comparación exacta).
 *
 * @param array<array-key, mixed> $in
 * @param list<string> $allowed
 */
function inputEnum(array $in, string $key, array $allowed, ?string $default = null): string
{
    $value = inputOptionalString($in, $key, 64);
    if ($value === null) {
        if ($default !== null) {
            return $default;
        }
        throw new ValidationError("El campo {$key} es obligatorio.", $key);
    }
    if (!in_array($value, $allowed, true)) {
        throw new ValidationError("El campo {$key} debe ser uno de: " . implode(', ', $allowed) . '.', $key);
    }
    return $value;
}

/**
 * Array (lista u objeto). En formularios acepta también un texto JSON (p. ej. `players` del plugin).
 *
 * @param array<array-key, mixed> $in
 * @param array<array-key, mixed>|null $default
 * @return array<array-key, mixed>
 */
function inputArray(array $in, string $key, int $maxItems = 1000, ?array $default = null): array
{
    $value = $in[$key] ?? null;
    if (is_string($value) && strlen($value) <= JSON_BODY_MAX_BYTES) {
        $value = json_decode($value, true, 64);
        if (!is_array($value)) {
            throw new ValidationError("El campo {$key} debe ser una lista JSON válida.", $key);
        }
    }
    if ($value === null) {
        if ($default !== null) {
            return $default;
        }
        throw new ValidationError("El campo {$key} es obligatorio.", $key);
    }
    if (!is_array($value)) {
        throw new ValidationError("El campo {$key} debe ser una lista.", $key);
    }
    if (count($value) > $maxItems) {
        throw new ValidationError("El campo {$key} admite como mucho {$maxItems} elementos.", $key);
    }
    return $value;
}

// ─── Paginación ─────────────────────────────────────────────────────────────

/**
 * @param array<array-key, mixed> $in
 * @return array{page: int, per_page: int, offset: int}
 */
function paginationParams(array $in, int $defaultPerPage = PAGINATION_DEFAULT_PER_PAGE, int $maxPerPage = PAGINATION_MAX_PER_PAGE): array
{
    $page = inputInt($in, 'page', 1, 1000000, 1);
    $perPage = inputInt($in, 'per_page', 1, $maxPerPage, $defaultPerPage);
    return ['page' => $page, 'per_page' => $perPage, 'offset' => ($page - 1) * $perPage];
}

/**
 * @param list<mixed> $items
 * @param array{page: int, per_page: int, offset?: int} $params
 * @return array{items: list<mixed>, pagination: array{page: int, per_page: int, total: int, total_pages: int}}
 */
function paginatedResult(array $items, int $total, array $params): array
{
    return [
        'items' => $items,
        'pagination' => [
            'page' => $params['page'],
            'per_page' => $params['per_page'],
            'total' => $total,
            'total_pages' => max(1, (int) ceil($total / max(1, $params['per_page']))),
        ],
    ];
}

// ─── Respuestas ─────────────────────────────────────────────────────────────

/**
 * @return array{success: true, data: mixed}
 */
function panelOkBody(mixed $data = null): array
{
    return ['success' => true, 'data' => $data];
}

/**
 * @param array<string, mixed> $extra
 * @return array<string, mixed>
 */
function panelErrorBody(string $message, string $code, array $extra = []): array
{
    return ['success' => false, 'error' => $message, 'code' => $code] + $extra;
}

/**
 * @param array<string, mixed> $extra
 * @return array<string, mixed>
 */
function pluginErrorBody(string $slug, string $message, array $extra = []): array
{
    return ['error' => $slug, 'message' => $message] + $extra;
}

/**
 * 503 `database_unavailable` de las APIs de plugins (docs/API.md §1.1): siempre con `Retry-After` y
 * `retry_after`, tanto si la BD no conecta al empezar como si cae a mitad de la petición.
 *
 * @return array{body: array<string, mixed>, headers: array<string, string>}
 */
function pluginDatabaseUnavailableResponse(): array
{
    return [
        'body' => pluginErrorBody('database_unavailable', 'Base de datos no disponible.', ['retry_after' => DATABASE_RETRY_AFTER_SECONDS]),
        'headers' => ['Retry-After' => (string) DATABASE_RETRY_AFTER_SECONDS],
    ];
}

function respondPluginDatabaseUnavailable(): never
{
    $response = pluginDatabaseUnavailableResponse();
    sendJson(503, $response['body'], $response['headers']);
}

/**
 * Envía JSON y termina la petición.
 *
 * @param array<array-key, mixed>|object $body
 * @param array<string, string> $headers
 */
function sendJson(int $status, array|object $body, array $headers = []): never
{
    if (!headers_sent()) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: no-store');
        foreach ($headers as $name => $value) {
            header($name . ': ' . $value);
        }
    }
    echo json_encode($body, JSON_FLAGS);
    exit;
}

function respondPanelOk(mixed $data = null, int $status = 200): never
{
    sendJson($status, panelOkBody($data));
}

/**
 * @param array<string, mixed> $extra
 */
function respondPanelError(int $status, string $message, string $code, array $extra = []): never
{
    sendJson($status, panelErrorBody($message, $code, $extra));
}

/**
 * @param array<array-key, mixed>|object $body
 */
function respondPluginOk(array|object $body, int $status = 200): never
{
    sendJson($status, $body);
}

/**
 * @param array<string, mixed> $extra
 */
function respondPluginError(int $status, string $slug, string $message, array $extra = []): never
{
    sendJson($status, pluginErrorBody($slug, $message, $extra));
}

/**
 * 429 con cabecera `Retry-After` y campo `retry_after`. `$format`: 'panel' | 'plugin'.
 */
function respondTooManyRequests(int $retryAfter, string $format): never
{
    $retryAfter = max(1, $retryAfter);
    $message = 'Demasiadas solicitudes. Inténtalo de nuevo en unos segundos.';
    $body = $format === 'plugin'
        ? pluginErrorBody('rate_limited', $message, ['retry_after' => $retryAfter])
        : panelErrorBody($message, 'rate_limited', ['retry_after' => $retryAfter]);
    sendJson(429, $body, ['Retry-After' => (string) $retryAfter]);
}

/**
 * Convierte un HttpError (incluido ValidationError) en respuesta. `$format`: 'panel' | 'plugin'.
 */
function respondHttpError(HttpError $error, string $format): never
{
    $extra = $error instanceof ValidationError && $error->field !== null ? ['field' => $error->field] : [];
    if ($format === 'plugin') {
        respondPluginError($error->status, $error->slug, $error->getMessage(), $extra);
    }
    respondPanelError($error->status, $error->getMessage(), $error->slug, $extra);
}

// ─── Cliente HTTP ───────────────────────────────────────────────────────────

/**
 * GET con timeouts. Nunca lanza: los fallos de red devuelven status 0.
 * Las redirecciones solo se siguen si se pide, como mucho 3 y solo a https.
 *
 * @param list<string> $headers
 * @return array{status: int, headers: array<string, string>, body: ?string}
 */
function httpGet(string $url, int $connectTimeout, int $timeout, array $headers = [], bool $followRedirects = false): array
{
    $responseHeaders = [];
    $ch = curl_init($url);
    if ($ch === false) {
        return ['status' => 0, 'headers' => [], 'body' => null];
    }
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => $connectTimeout,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_FOLLOWLOCATION => $followRedirects,
        CURLOPT_MAXREDIRS => 3,
        CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_USERAGENT => 'FurrGuard/' . FURRGUARD_VERSION,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_ENCODING => '',
        CURLOPT_HEADERFUNCTION => static function ($handle, string $line) use (&$responseHeaders): int {
            $parts = explode(':', $line, 2);
            if (count($parts) === 2) {
                $responseHeaders[strtolower(trim($parts[0]))] = trim($parts[1]);
            }
            return strlen($line);
        },
    ]);
    $body = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    return [
        'status' => is_string($body) ? $status : 0,
        'headers' => $responseHeaders,
        'body' => is_string($body) ? $body : null,
    ];
}
