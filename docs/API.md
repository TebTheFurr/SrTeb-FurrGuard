# FurrGuard — contrato de la API (v2)

Fuente de verdad para el backend PHP, el plugin Velocity, los módulos FurrPerms y
FurrSecurity y las dos SPAs (panel y landing/verificación). Si cambias una forma de
respuesta, cámbiala aquí y en todos los clientes en el mismo commit.

## 0. Convenciones generales

- **Tiempo:** todo se guarda y se transmite en **UTC**. PHP corre con
  `date_default_timezone_set('UTC')` y la sesión MySQL con `time_zone = '+00:00'`.
  Las expiraciones se calculan en SQL (`NOW() + INTERVAL ? SECOND`) o con PHP en UTC.
  Formato en respuestas: `YYYY-MM-DD HH:MM:SS` (UTC, sin zona). Los clientes lo
  interpretan como UTC y lo muestran en `Europe/Madrid`.
- **Identidades normalizadas** (`includes/identity.php`):
  - UUID: minúsculas con guiones `8-4-4-4-12` (acepta también 32 hex).
  - IP: `inet_ntop(inet_pton())`; IPv4 mapeada (`::ffff:1.2.3.4`) → `1.2.3.4`.
  - `ip_range`: CIDR canónico (dirección de red). Prefijo mínimo /8 en IPv4 y /16 en IPv6.
  - `as`: `AS` + dígitos (acepta `AS1234`, `1234`, `AS1234 Nombre`).
  - Nick: `^[.*]?[A-Za-z0-9_]{1,16}$` y longitud total ≤ 16 (el prefijo `.`/`*` es de Floodgate).
- **Ámbito de IP** (`sameIpScope`): IPv4 igual exacta; IPv6 mismo `/64`.
- **Baneos automáticos de IPv6** se guardan como `ip_range` `/64` (una IPv6 suelta rota). Las IPs
  privadas o reservadas nunca se banean automáticamente.
- **Errores JSON:** HTTP con el código adecuado y cuerpo
  `{"success": false, "error": "<mensaje en español>", "code": "<slug>"}` en el panel, o
  `{"error": "<slug>", "message": "<texto>"}` en las APIs de plugin. Los errores de validación
  (422, slug/código `validation`) añaden `"field": "<campo>"`.
- **429:** cabecera `Retry-After: <segundos>` y campo `retry_after` en el cuerpo.

## 1. API de plugins — `POST /api/plugin.php?action=<acción>`

Cabecera `X-API-Key`, cuerpo `application/x-www-form-urlencoded`. Sin cookies ni sesión PHP.
Sin cabeceras CORS (es tráfico servidor a servidor).

### 1.1 Autenticación, límites y errores

1. Método distinto de POST → 405 `method_not_allowed` con cabecera `Allow: POST` (antes de autenticar).
2. La clave se guarda **hasheada** (`settings.api_key_hash` = SHA-256 hex). Si no hay clave
   configurada → 503 `api_key_not_configured` (la instalación nueva no acepta nada hasta que el
   founder genere una desde el panel).
3. Sin clave o clave inválida → 401 `invalid_api_key`. Los fallos cuentan en un cubo por IP
   (`30/min`); al pasarlo → 429 `rate_limited`.
4. Tráfico autenticado: un cubo **por clave**, `API_RATE_LIMIT_PER_MIN` (env, por defecto 6000).
   **No hay límite por IP** para tráfico autenticado: todo el tráfico de la red sale de la IP del proxy.
5. Acción inexistente (ya autenticado) → 404 `unknown_action`.

Errores que puede devolver cualquier acción (cuerpo `{"error", "message"}`):

| HTTP | `error` | Cuándo |
|---|---|---|
| 405 | `method_not_allowed` | No es POST |
| 401 | `invalid_api_key` | Falta la clave o no coincide |
| 404 | `unknown_action` | `action` desconocida |
| 409 | `duplicate` | Alta de algo que ya existe (whitelist) o baneo ya en vigor |
| 422 | `validation` | Campo ausente o inválido; añade `field` |
| 429 | `rate_limited` | Cubo agotado; `Retry-After` y `retry_after` |
| 503 | `api_key_not_configured` | Aún no se ha generado ninguna clave |
| 503 | `database_unavailable` | Sin conexión, bloqueo o interbloqueo de la BD (al empezar o a mitad de la petición). Siempre con `Retry-After: 5` y `retry_after: 5` |
| 500 | `internal_error` | Cualquier otro fallo (se registra en el log de PHP) |

### 1.2 Acciones

| Acción | Entrada | Salida (200) |
|---|---|---|
| `check_player` | `uuid?`, `nick`, `ip`, `game_version?` (≤ 64) | ver 1.3 |
| `recheck_players` | `players` = JSON `[{"uuid","nick","ip"}]` (máx. 500, los tres obligatorios) | `{"results":[{"uuid","allowed","reason","block_reason","block_type","expires_at","ban_id"}]}` |
| `lookup_player` | `nick` | `{"found":true,"uuid","nick","ip","is_online","first_seen","last_seen","allowed","reason","block_type","expires_at","ban_id","ip_data":{}}` o `{"found":false}` |
| `player_join` | `uuid`, `nick`, `ip` | `{"success":true}` |
| `player_quit` | `uuid` | `{"success":true}` |
| `get_messages` | — | objeto plano `{"clave":"valor"}` |
| `get_settings` | — | solo `notify_connections`, `notify_hispanic`, `server_name`, `discord_url`, `cache_version` (valores como texto) |
| `poll_changes` | `last_version?` (defecto -1), `wait?` (0–25 s, defecto 25 por compatibilidad) | `{"changed":bool,"cache_version":int,"recent_actions":[{"id","type","action","details"}]}` |
| `add_whitelist` | `type`, `value`, `reason?`, `added_by?` | `{"success":true}`; 409 `duplicate` si ya existe |
| `remove_whitelist` | `type`, `value`, `added_by?` | `{"success":true,"deleted":int}` (0 si no existía; nunca 404) |
| `add_blacklist` | `type`, `value`, `reason?`, `added_by?`, `duration?` (min, 0–5256000, 0 = permanente), `stain_ip?` (defecto **1**) | `{"success":true,"ban_id"}`; 409 `duplicate` si ya hay uno en vigor |
| `remove_blacklist` | `type`, `value`, `added_by?` | `{"success":true,"affected":int}` (desactiva padre **e hijas**; `affected` = filas que estaban activas, 0 si no existe) |
| `check_furr_perms_whitelist` | `nick`, `uuid`, `ip` (los tres obligatorios) | `{"allowed":bool,"reason":"not_whitelisted"\|"uuid_mismatch"\|"needs_furrsecurity"\|"ok"\|"module_disabled"}` |
| `log_furr_perms_command` | `player_uuid?`, `player_nick`, `command` (≤ 4096, se guarda recortado a 255), `server_name?` (≤ 100), `allowed` 0/1, `reason?` (≤ 255), `ip_address?` | `{"success":true}` |

- `added_by` por defecto es `Plugin`. `type` ∈ `uuid`, `nick`, `ip`, `ip_range`, `as`; `value` se
  valida y normaliza según §0 (422 si no es válido).
- `poll_changes`: con `last_version` = -1 nunca devuelve `changed:true` (sirve de línea base). Espera
  hasta `wait` segundos a que cambie `cache_version`.
- `recent_actions`: las 10 últimas acciones de tipo `whitelist` y `blacklist` (nunca inicios de
  sesión ni ajustes), en orden de `id` creciente. `details` empieza siempre por
  **`"tipo: valor"`** (p. ej. `"nick: Pepe"`): el servidor recorta la parte de auditoría que va detrás
  del separador ` · `. `action` ∈ `add`, `reactivate`, `edit`, `enable`, `disable`, `remove`, `add_ip`.
- Los clientes nuevos llaman a `poll_changes` con `wait=0` cada 5 s. Si cambia la versión:
  recargan `get_messages` y `get_settings` y hacen **un** `recheck_players` con todos los conectados
  (en lotes de 500).
- `check_furr_perms_whitelist`: `uuid_mismatch` si la entrada fija un UUID distinto del recibido;
  `needs_furrsecurity` si el nick es staff de FurrSecurity (con el módulo activo) y no tiene una
  sesión verificada en vigor desde esa IP (§2).
- `log_furr_perms_command` solo guarda la fila si `fur_perms_log_allowed` / `fur_perms_log_blocked`
  (según `allowed`) está a `1`.

### 1.3 `check_player`

Orden de evaluación (no cambiar sin actualizar este documento):

1. Validación y normalización (nick, IP, UUID).
2. Geolocalización (`includes/geo.php`, ver §6).
3. **Blacklist** (uuid → nick → as → ip → ip_range). Un baneo gana siempre, también a la whitelist.
   Además del UUID recibido cuenta el **UUID premium del nick** (Mojang, con caché): un baneo por UUID
   no se esquiva entrando en modo offline. Mojang solo se consulta cuando el UUID recibido es offline
   (versión 3): un UUID v4 ya es el premium autenticado por Velocity.
   Si el baneo es por uuid o nick, la IP desde la que entra pasa a ser hija del baneo (evasión) salvo
   que `auto_ban_evasion_ip = 0` o la IP sea de una red móvil (`mobile: true`, CGNAT compartido).
4. **Whitelist** (uuid, nick, as, ip, ip_range): exime de los pasos 5 y 6, **no** de la blacklist.
   Solo cuenta el UUID recibido (el premium resuelto por nick nunca exime).
5. Sin ningún dato de geolocalización: `ip_api_unavailable` si la IP es pública e
   `ip_api_fail_open = 0`; en otro caso se permite. **Una IP privada o reservada nunca tiene datos y
   se permite** (sin pasos 6 y 7).
6. Detección de cuenta comprometida (cambio drástico de país). El baneo automático de UUID, nick e IP
   dura `compromised_ban_hours` (24 h por defecto; 0 = permanente).
7. Reglas automáticas: proxy → vpn → hosting → mobile → proveedor bloqueado → país → continente.

Respuesta:

```json
{
  "allowed": false,
  "reason": "blacklisted",
  "block_reason": "texto del baneo",
  "block_type": "uuid",
  "expires_at": "2026-09-15 20:00:00",
  "ban_id": "AB12CD34EF56",
  "blocked_name": "NickOriginal",
  "degraded": false,
  "ip_data": { "country": "Spain", "countryCode": "ES", "continentCode": "EU", "isp": "…", "org": "…",
               "as": "AS3352 Telefonica", "asname": "…", "proxy": false, "hosting": false, "mobile": false }
}
```

- `ip_data` es **siempre un objeto** (`{}` si no hay datos), nunca un array. Incluye `source`.
- `geo_source`: método y proveedores usados para esa conexión (`proxycheck`, `ip-api+maxmind`,
  `cache:freeipapi+maxmind`, `maxmind` = solo espejo, `none`). Se guarda en
  `player_connections.geo_source` y el panel lo muestra en el detalle de la conexión.
- `reason` ∈ `allowed`, `whitelisted`, `blacklisted`, `compromised_account`, `proxy_detected`,
  `vpn_detected`, `hosting_detected`, `mobile_detected`, `blocked_provider`, `blocked_country`,
  `blocked_continent`, `ip_api_unavailable`.
- `block_reason`, `block_type`, `expires_at` y `ban_id` solo tienen valor con `blacklisted` y
  `compromised_account` (en el resto son `null`). `blocked_name` (solo `blacklisted`) es el nick del
  baneo raíz o el nombre actual de su UUID.
- **`compromised_account`** añade `historical_country` y `current_country` (ISO 3166-1 alfa-2). Los
  datos del baneo (`ban_id`, `block_type`…) son los del baneo raíz creado.
- `degraded: true` cuando ip-api no respondió y se usó solo el espejo MaxMind: se aplican país,
  continente, ASN y proveedores; proxy/hosting/mobile no se pueden evaluar.
- `ip_api_unavailable` solo si **no hay ningún dato** (ni caché, ni ip-api, ni MaxMind), la IP es
  pública y `ip_api_fail_open = 0`.
- Reglas del paso 7, cada una con su ajuste (§7):
  - `proxy_detected` (`block_proxy`): ip-api marca `proxy` o el ISP/org/AS coincide con un proveedor de tipo `proxy`.
  - `vpn_detected` (`block_vpn`): coincide con un proveedor de tipo `vpn` (ip-api no marca VPN).
  - `hosting_detected` (`block_hosting`): ip-api marca `hosting`.
  - `mobile_detected` (`block_mobile`): ip-api marca `mobile`.
  - `blocked_provider` (`block_hosting`): coincide con un proveedor de tipo `hosting`.
  - `blocked_country` / `blocked_continent`: país o continente activo en las tablas de bloqueo (el
    continente se deduce del país si ip-api no lo da).
  - Los proveedores coinciden por **palabras completas** ("aws" coincide con "Amazon AWS", no con "Lawson").
  - Solo `check_player` suma `block_count` al proveedor, país o continente que bloquea.
- **Cuenta comprometida:** el país actual no aparece en el historial y el país habitual supera
  `country_change_min_percentage` con al menos `country_change_min_connections` conexiones. El
  historial usa **solo conexiones permitidas** (los intentos bloqueados no cuentan) del UUID (del
  nick si no llega UUID). Con `country_change_continent_only = 1` solo cuenta un cambio de continente.
  Se crea un `upsertBan(auto)` del UUID (o del nick) con el nick y la IP como hijas.
- **Evasión:** si coincide un baneo por uuid o nick y la IP no tiene baneo, esa IP (IPv6 /64) pasa a
  ser hija del baneo raíz.
- `check_player` registra la conexión (permitida o bloqueada) y, si llega UUID, actualiza la ficha
  del jugador (nicks e IPs conocidas).
- Motivos que **justifican expulsar a un jugador ya conectado** (`recheck_players`): `blacklisted`,
  `blocked_country`, `blocked_continent`, `blocked_provider`, `proxy_detected`, `vpn_detected`,
  `hosting_detected`, `mobile_detected`. Nunca `ip_api_unavailable` ni errores.
- `recheck_players` no registra conexiones, no suma contadores, no llama a ip-api ni a Mojang (solo
  caché + MaxMind), no crea hijas por evasión y no ejecuta la detección de cuenta comprometida. Si
  **alguna** entrada de `players` no es válida responde 422 `validation` y no evalúa ninguna.
- `lookup_player` evalúa al jugador con su última IP sin escribir nada (sin registro, contadores,
  evasión ni cuenta comprometida), pero sí puede consultar ip-api y Mojang (con caché).

### 1.4 Semántica de baneos (`includes/bans.php`)

- `UNIQUE(type, value)`. "En vigor" = `active = 1` y sin caducar. `upsertBan()` en modo:
  - `manual`: si hay un baneo **en vigor** → 409 `duplicate`. Si existe inactivo o expirado → se
    **reactiva** con `ban_id` nuevo, motivo, autor, expiración, `parent_id` nuevos y
    **`created_at = NOW()`**. Si no existe → se inserta.
  - `auto` (cuenta comprometida, FurrSecurity, evasión): si hay uno en vigor → **no se toca** (conserva
    motivo, autor y expiración del admin). Si existe inactivo o expirado → se reactiva como baneo
    automático permanente. Si no existe → se inserta. Siempre deja traza en `activity_logs`
    (`type=security`, `action=auto_ban`).
- **Hijas:** cuelgan siempre de un padre raíz (un solo nivel: si una hija tenía hijas, pasan al
  padre). Al crearse o reactivarse **heredan siempre la expiración del padre** (su duración propia se
  ignora). Desactivar/activar un baneo aplica al padre **y a sus hijas**. Editar la expiración del
  padre la propaga a las hijas. Borrar un padre borra las hijas (FK en cascada).
- "IP manchada" (`stain_ip`, solo en baneos por uuid o nick): las IPs conocidas del jugador
  (`player_ips`) se banean como hijas (IPv6 como /64, nunca IPs privadas; las que ya tienen un baneo
  en vigor no se tocan). La IP de evasión también se crea como hija del baneo raíz.
- Los flags `players.is_whitelisted`/`is_blacklisted` desaparecen: el estado se calcula con `EXISTS`
  (por uuid o último nick; en blacklist solo baneos en vigor).
- Toda alta, baja o cambio de whitelist/blacklist incrementa `cache_version` y deja traza con
  `details` = `"tipo: valor · …"`.

## 2. API FurrSecurity — `POST /api/furrsecurity.php?action=<acción>`

Mismas reglas de autenticación, límites y errores que §1.1.

| Acción | Entrada | Salida |
|---|---|---|
| `check_status` | `uuid`, `nick`, `ip` | `{"needs_verification":bool,"reason":"module_disabled"\|"not_staff"\|"already_verified"\|"no_valid_session"\|"ip_changed","discord_id"?,"session"?:{"expires_at","time_remaining_seconds"}}` |
| `get_staff` | — | `{"staff":[{"nick":"Nombre"}]}` |
| `generate_token` | `uuid`, `nick`, `ip` | `{"success":true,"token","verify_url","existing":bool,"token_expires_in_seconds"}` o `{"success":false,"error":"not_in_whitelist"}` |
| `verify_token_status` | `token` (64 hex) | `{"status":"pending"\|"verified"\|"token_expired"\|"expired"\|"not_found","verified":bool,"token_expires_in_seconds"?,"expires_at"?,"time_remaining_seconds"?}` |
| `get_session` | `uuid`, `ip` | `{"has_session":bool,"session"?:{"id","nick","discord_id","verified_at","expires_at","time_remaining_seconds"}}` |
| `extend_session` | `uuid`, `ip`, `token?` (64 hex) | `{"success":true,"expires_at","time_remaining_seconds"}` o `{"success":false,"error":"no_active_session"\|"invalid_token"\|"ip_changed"}` |
| `player_disconnect` | `uuid`, `nick`, `locked?` 0/1 (defecto 0) | `{"success":true}` |
| `reset_session` | `uuid`, `nick` | `{"success":true,"sessions_expired":int}` |
| `record_failed_attempt` | `uuid`, `nick`, `ip` | `{"success":true,"failed_attempts":int,"blacklisted":bool}` |
| `get_settings` | — | todas las claves de ajustes `furrsecurity_*` (§7), valores como texto |
| `get_messages` | — | objeto plano con las claves de mensajes `furr_security_*` |

Reglas:

- **La sesión verificada está atada a la IP** (`sameIpScope`). La IP de la sesión es la que pidió el
  token. `check_status`:
  - `already_verified` (con `session`) si hay una sesión en vigor desde el mismo ámbito de IP;
  - `ip_changed` (con `discord_id`) si hay sesiones en vigor pero de otra IP (queda traza `ip_changed`);
  - `no_valid_session` (con `discord_id`) si no hay ninguna.
- `generate_token` reutiliza un token pendiente solo si es de la **misma IP** y no ha expirado
  (`existing:true`); si no, expira los pendientes y crea uno nuevo que dura
  `furrsecurity_token_expiration`. También funciona para staff con sesión válida: así el módulo
  ofrece la **re-verificación anticipada**. Al completarse, esa verificación renueva también las
  sesiones en vigor del mismo ámbito de IP (`expires_at = NOW() + furrsecurity_session_duration`).
- `verify_token_status` devuelve siempre `status` y `verified` juntos: `pending` con
  `token_expires_in_seconds`; `verified` con `expires_at` y `time_remaining_seconds`. Un enlace o una
  sesión caducados se marcan `token_expired` / `expired` al consultarlos.
- `extend_session` exige una sesión verificada, **no expirada** y de la misma IP. Errores (HTTP 200):
  `no_active_session` (sin `token`: el UUID no tiene ninguna sesión en vigor), `invalid_token` (con
  `token`: no hay sesión en vigor de ese UUID con ese token), `ip_changed` (las sesiones en vigor son
  de otra IP). Un `token` mal formado es 422.
- `player_disconnect` solo deja log si el jugador es staff o `locked=1`. Con `locked=1` y un token
  **pendiente y sin caducar** registra un intento fallido (con la IP que pidió el enlace).
- `record_failed_attempt` (el módulo lo envía al expulsar por enlace caducado) marca antes los
  tokens pendientes como `token_expired`: el `player_disconnect(locked=1)` que llega después ya no
  encuentra token pendiente y **no cuenta el mismo intento dos veces**.
- Los intentos fallidos cuentan dentro de `furrsecurity_failed_attempts_window` (segundos). Al
  llegar a `furrsecurity_max_failed_attempts` → `upsertBan(auto)` del UUID con el nick y la IP (IPv6
  /64) como hijas, se borra el contador, se expiran los enlaces pendientes y se incrementa
  `cache_version`. Un intento en la web con otra cuenta de Discord cuenta igual (con la IP del navegador).
- `reset_session` expira las sesiones verificadas en vigor del UUID.
- **Los clientes fallan en cerrado:** cualquier error HTTP, timeout o JSON inválido en
  `check_status` significa "bloquear y reintentar", nunca "dejar pasar".
- **Prefijos:** los *ajustes* de FurrSecurity usan `furrsecurity_` (tabla `settings`) y sus
  *mensajes* usan `furr_security_` (tabla `messages`; son las 25 claves que ya usan el módulo y el
  panel). Las antiguas claves de mensajes `furrsecurity_*` no llegaban nunca al módulo y se
  eliminan en la migración. En SQL, filtra con `LIKE 'furr\_security\_%'` (el `_` es comodín).
- **Mensajes del resto de piezas:** FurrGuard usa `prefix`, `kick_*`, `notify_*`, `command_*`,
  `player_*`, `whitelist_*`, `blacklist_*`… y FurrPerms `fur_perms_*`.

## 3. Verificación web — `/verify.php`

Página PHP que sirve `public/dist/index.html` e inyecta `window.__VERIFY_DATA__` (JSON con
`JSON_HEX_TAG|AMP|APOS|QUOT`, antes del script de módulo). Cabeceras `Cache-Control: no-store`,
`Referrer-Policy: no-referrer` y `X-Robots-Tag: noindex, nofollow`.

```ts
type VerifyData =
  | { state: 'confirm'; csrf: string; token: string; minecraft_nick: string; request_ip: string;
      request_country: string | null; request_country_code: string | null;
      requested_at: string; token_expires_at: string }
  | { state: 'success'; title: string; message: string }
  | { state: 'error'; title: string; message: string; code: string }
```

Flujo:

1. `GET /verify.php?token=<64 hex>` → si el token está `pending` y `token_expires_at > NOW()`,
   `state:"confirm"` con la IP, el país (caché + MaxMind, sin llamadas remotas) y la hora de la
   solicitud. El token queda guardado en la sesión.
2. El usuario confirma "soy yo quien está entrando desde esta IP" → formulario
   `POST /verify.php` con `action=confirm`, `token`, `csrf`. El servidor guarda el token en sesión y
   responde `303` a Discord OAuth (`state` aleatorio en sesión, `prompt=consent`).
3. `GET /verify.php?code=…&state=…` → valida `state`, que el token de la sesión siga `pending` y no
   expirado, y que el Discord ID coincida. Si coincide: `verified`, `verified_at = NOW()`,
   `expires_at = NOW() + furrsecurity_session_duration`. Si no: intento fallido.
4. La SPA limpia `code`/`state`/`token` de la URL con `history.replaceState`. Un `GET /verify.php`
   sin parámetros muestra la confirmación del token guardado en la sesión.

`redirect_uri` es `APP_URL/verify.php` (env), nunca la cabecera `Host`.

La página se sirve con el código HTTP del resultado. `code` de los errores:

| HTTP | `code` | Cuándo |
|---|---|---|
| 400 | `missing_token` | Sin `token` en la URL ni en la sesión |
| 400 | `invalid_token` | `token` que no son 64 hex |
| 400 | `invalid_request` | Formulario de confirmación inválido |
| 400 | `invalid_state` | La vuelta de Discord no coincide con el `state` de la sesión |
| 400 | `discord_denied` | El usuario canceló en Discord |
| 400 | `invalid_code` | `code` de Discord inválido |
| 403 | `session_expired` | CSRF inválido al confirmar (página caducada) |
| 403 | `discord_mismatch` | Cuenta de Discord distinta a la del staff (intento fallido, indica "n de máx.") |
| 403 | `auto_blacklisted` | Ese intento alcanzó el máximo y la cuenta quedó baneada |
| 404 | `token_not_found` | El token no existe |
| 410 | `token_expired` | El enlace ya no está pendiente o caducó |
| 503 | `discord_error` | Discord no respondió al canjear el código o al leer el usuario |
| 503 | `not_configured` | Falta `APP_URL` o `DISCORD_CLIENT_ID` |
| 503 | `service_unavailable` | BD caída o error interno |

Un token ya verificado con la sesión en vigor responde 200 `state:"success"` ("Ya verificado").

## 4. Panel — `/admin/`

### 4.1 Arranque

`admin/index.php` sirve `admin/dist/index.html` para cualquier ruta `/admin/*` e inyecta:

```ts
window.__FURRGUARD__ = {
  version: string,
  csrfToken: string,
  loginUrl: string,              // URL de Discord OAuth ('' con sesión o sin DISCORD_CLIENT_ID)
  loginError: string | null,     // invalid_code | invalid_state | discord_error | no_access |
                                 // session_expired | access_revoked | rate_limited
  user: null | { discord_id: string; username: string; avatar: string | null;
                 role: 'founder'|'owner'|'manager'|'sradmin'|'admin' },
  permissions: string[],         // secciones del rol actual (ver 4.3)
  canSeeIps: boolean,
}
```

`admin/callback.php` (vuelta de OAuth) siempre redirige a `/admin/`, con `?error=<código>` si falla:
`rate_limited` (más de 10 intentos en 5 min por IP), `invalid_state`, `discord_error` (también si
Discord devuelve error o la BD falla al iniciar sesión), `invalid_code`, `no_access`. El cierre de
sesión es la acción `logout` (POST con CSRF), nunca un GET.

### 4.2 Peticiones

- `POST /admin/api.php`, `Content-Type: application/json`, cabecera `X-CSRF-Token`, cuerpo
  `{"action": "...", ...parámetros}` (máx. 1 MB).
- El servidor exige método POST, JSON, token CSRF válido y, si llegan, `Origin` igual a `APP_URL` y
  `Sec-Fetch-Site: same-origin`. Si no → 403 `code:"csrf"`.
- Éxito: `{"success": true, "data": ...}`. Listas paginadas:
  `{"items": [...], "pagination": {"page", "per_page", "total", "total_pages"}}`.
  Parámetros `page` (≥1) y `per_page` (por defecto 25, máx. 100; en registros el defecto es 50).
  Las listas con IPs añaden `ip_hidden`.
- Límite: 300 peticiones/min por usuario del panel y 60/min por IP para peticiones rechazadas
  (CSRF o sin sesión).
- 401 → la SPA muestra el login; `code` ∈ `session_expired`, `access_revoked`, `unauthorized`.
  403 `code:"forbidden"` → aviso de permisos. 404 `unknown_action` o `not_found`. 409 `duplicate`.
  422 `validation`. 503 `database_unavailable`. 500 `internal_error`.

### 4.3 Roles y secciones

```
founder: overview players connections ips whitelist blacklist sanctions providers countries
         continents messages logs settings users furrperms furrsecurity
owner:   overview players connections ips whitelist blacklist sanctions countries continents
         messages logs furrperms furrsecurity
manager: overview players connections ips whitelist blacklist sanctions
sradmin: overview players whitelist blacklist sanctions
admin:   overview players whitelist blacklist sanctions
```

- La SPA usa **exactamente** estas secciones (ya no existe `modules`). Lo que no está en el mapa de
  acciones es 404 (falla en cerrado).
- Sin la sección `ips`, el servidor **oculta las IPs** en jugadores, conexiones, resumen y detalle
  (`last_ip: null`, `ips: []`, `ip: null`, `ip_hidden: true`) y no permite buscar por IP.

### 4.4 Acciones

| Acción | Sección | Parámetros | `data` |
|---|---|---|---|
| `logout` | — | — | `null` |
| `get_overview` | overview | — | `{online_players,total_players,connections_24h,blocked_24h,recent_connections[],recent_blocks[],counts:{whitelist,blacklist,providers,countries,continents},health:{api_key_configured,geo_mirror:"ok"\|"missing"\|"disabled",ip_api:"ok"\|"limited"\|"down"},ip_hidden}` |
| `get_players` | players | `page,per_page,filter(all\|online\|whitelisted\|blacklisted),search` | lista de `{id,uuid,last_nick,first_nick,last_ip,last_country,last_country_code,is_online,is_whitelisted,is_blacklisted,total_connections,first_seen,last_seen}` |
| `get_player_detail` | players | `uuid` | `{player,nicks[],ips[],recent_connections[],whitelist_entries[{id,type,value}],blacklist_entries[{id,ban_id,type,value,reason,active,expires_at}],premium:{status,uuid},ip_hidden}`; 404 `not_found` |
| `lookup_player` | players | `player_name` | `{status:"premium"\|"not_found"\|"unknown",uuid,name}` |
| `get_name_history` | players | `player_name` | `{uuid,history:[{name,changed_at}],complete,failed_sources:["mojang"\|"laby"\|"namemc"]}`; `failed_sources` son las fuentes que no se pudieron consultar (si Mojang no responde, Laby cuenta también: sin UUID no se consulta) y `complete` es false si hay alguna: el historial puede estar incompleto. Un nick sin cuenta de Mojang no consulta Laby y no cuenta como fallo |
| `get_connections` | connections | `page,per_page,filter(all\|allowed\|blocked\|proxy\|vpn\|hosting\|mobile),search` | lista |
| `get_connection_detail` | connections | `id` | `{connection}` |
| `get_ips` | ips | `page,per_page,search` | lista `{ip,country,country_code,isp,asn,first_seen,player_count,connection_count,is_whitelisted,is_blacklisted}` |
| `get_ip_detail` | ips | `ip` | `{ip:{ip,country,country_code,isp,asn,connection_count,is_whitelisted,is_blacklisted},players[{uuid,nick,last_used}]}` |
| `get_whitelist` | whitelist | `page,per_page,type,search` | lista `{id,type,value,reason,added_by,created_at,minecraft_name}` |
| `add_whitelist` | whitelist | `type,value,reason` | `{id}` |
| `edit_whitelist` | whitelist | `id,type,value,reason` | `null` |
| `remove_whitelist` | whitelist | `id` | `null` |
| `get_blacklist` | blacklist | `page,per_page,type,status(all\|active\|inactive\|expired),search` | lista de padres `{id,ban_id,type,value,reason,added_by,active,expires_at,created_at,minecraft_name,children[{id,parent_id,ban_id,type,value,active,expires_at}]}` |
| `add_blacklist` | blacklist | `type,value,reason,duration_minutes(0=permanente),stain_ip(defecto false)` | `{id,ban_id,reactivated}` |
| `add_blacklist_unified` | blacklist | `player_name,reason,duration_minutes,stain_ip` | `{id,ban_id,type,value,is_premium,player_name}` (el servidor ignora cualquier uuid del cliente; si Mojang no responde → 503 `mojang_unavailable` y no banea) |
| `edit_blacklist` | blacklist | `id,reason,duration_minutes(null=sin cambios)` | `null` |
| `set_blacklist_active` | blacklist | `id,active` | `null` |
| `remove_blacklist` | blacklist | `id` | `null` |
| `add_blacklist_ip` | blacklist | `parent_id,ip` | `{id}` (422 si `parent_id` es una hija) |
| `get_sanctions` | sanctions | `page,per_page,filter(all\|active\|expired\|inactive\|permanent\|temporary),search` | lista + `stats:{total,active,expired,inactive,permanent,temporary}` con los mismos criterios que los filtros |
| `get_providers` | providers | `page,per_page,type,search` | lista `{id,name,pattern,type,block_count,active,added_by,created_at}` + `stats:{hosting,vpn,proxy}` |
| `add_provider` | providers | `name,pattern(≥3 letras o números),type(hosting\|vpn\|proxy)` | `{id}` |
| `toggle_provider` / `delete_provider` | providers | `id,active` / `id` | `null` |
| `get_countries` / `get_continents` | countries / continents | `page,per_page,search` | lista `{id,country_code\|continent_code,country_name\|continent_name,kick_message,block_count,active,added_by,created_at}` + `stats:{total,active,total_blocks}` |
| `add_country` / `add_continent` | countries / continents | `country_code` (ISO 2 letras) o `continent_code` (AF, AN, AS, EU, NA, OC, SA), `country_name`/`continent_name`, `kick_message?` | `{id}` |
| `edit_country` / `edit_continent` | countries / continents | `id`, `country_name`/`continent_name`, `kick_message?` | `null` |
| `toggle_country` / `toggle_continent` | countries / continents | `id,active` | `null` |
| `delete_country` / `delete_continent` | countries / continents | `id` | `null` |
| `get_messages` | messages | — | `{messages:{clave:valor}}` |
| `save_messages` | messages | `messages` (solo claves existentes; una desconocida es 422; se guardan las que cambian) | `null` |
| `get_logs` | logs | `page,per_page,type,search` | lista `{id,type,action,details,ip_address,created_at}` |
| `get_settings` | settings | — | `{settings:{…sin secretos},api_key:{configured,prefix,created_at}}` |
| `save_settings` | settings | `settings` (solo claves cambiadas, validadas §7) | `null` |
| `regenerate_api_key` | settings | — | `{api_key,prefix,created_at}` (la clave solo se muestra aquí, una vez) |
| `export_data` | settings | — | `{exported_at,version,settings,messages,whitelist,blacklist,providers,countries,continents}`, sin `api_key*` ni secretos |
| `migrate_blacklist` / `migrate_players` | settings | `cursor?`(defecto 0), `batch_size?`(1–25, defecto 25) | `{processed,skipped,changed,details[],next_cursor\|null,total}` |
| `get_admin_users` | users | `page,per_page` | lista `{id,discord_id,role,created_by,created_at,discord_username,removable}` (`removable` false solo en la fila de `FOUNDER_DISCORD_ID`) |
| `add_admin_user` | users | `discord_id` (17–20 dígitos), `role(owner\|manager\|sradmin\|admin)` | `{id}` |
| `remove_admin_user` | users | `id` | `null` (revoca sus sesiones; las filas `founder` se pueden quitar salvo la de `FOUNDER_DISCORD_ID`, que da 403) |
| `get_furr_perms_whitelist` | furrperms | `page,per_page,search` | lista `{id,nick,uuid,reason,added_by,active,created_at}` |
| `add_furr_perms_whitelist` / `remove_furr_perms_whitelist` | furrperms | `nick,uuid?,reason?` / `id` | `{id}` / `null` |
| `get_furr_perms_logs` | furrperms | `page,per_page,filter(all\|allowed\|blocked),search` | lista + `stats:{total,allowed,blocked}` |
| `clear_furr_perms_logs` | furrperms | — | `{deleted_count}` (borra los registros de más de 30 días) |
| `furrsecurity_get_staff` | furrsecurity | `page,per_page,search` | lista `{id,discord_id,minecraft_nick,added_by,added_at}` |
| `furrsecurity_add_staff` / `furrsecurity_remove_staff` | furrsecurity | `discord_id` (17–20 dígitos), `minecraft_nick` / `id` | `{id}` / `null` |
| `furrsecurity_get_sessions` | furrsecurity | `page,per_page,status(active\|pending\|all),search` | lista |
| `furrsecurity_get_logs` | furrsecurity | `page,per_page,group(all\|verification\|failed\|blacklist\|session),search` | lista |
| `furrsecurity_revoke_session` / `furrsecurity_get_stats` | furrsecurity | `id` / — | `null` / `{total_staff,active_sessions,pending_verifications,verified_today}` |

- Altas duplicadas → 409 `duplicate`; `id` inexistente → 404 `not_found`.
- `activity_logs.type` ∈ `auth`, `whitelist`, `blacklist`, `providers`, `countries`, `continents`,
  `messages`, `settings`, `users`, `furrperms`, `furrsecurity`, `security`, `players`.
  Todo cambio de ajustes, mensajes, toggles o migraciones deja traza. Los cambios que afectan a los
  plugins (listas, filtros, mensajes, ajustes, FurrPerms) incrementan `cache_version`.

## 5. Sesión del panel

- Cookie `__Host-furrguard` (con `APP_URL` https; con http se llama `furrguard` y no es `Secure`,
  solo para desarrollo), `HttpOnly`, `SameSite=Lax`, `path=/`, `session.use_strict_mode=1`. Las
  sesiones PHP se guardan en `storage/sessions`.
- Tras el login: `session_regenerate_id(true)`, token CSRF nuevo, se **revocan las sesiones
  anteriores del mismo usuario** y se crea una fila en `admin_sessions` con `session_token_hash`
  (SHA-256). Cada petición valida esa fila (no revocada, no expirada) y el rol vigente en BD.
- Caducidad absoluta 8 h desde el login, inactividad 2 h, regeneración de ID cada 30 min.
- IP: se aprende una por familia (IPv4 exacta, IPv6 /64). Si llega otra IP de una familia ya
  aprendida → sesión inválida. Un cambio IPv4↔IPv6 no cierra la sesión.
- Quitar un usuario o cambiar su rol revoca sus filas de `admin_sessions`.

## 6. Geolocalización (`includes/geo.php`)

0. Una IP privada o reservada no se geolocaliza: sin datos.
1. `ip_cache` vigente con éxito → se usa.
2. **Espejo local MaxMind** (GeoLite2-Country + GeoLite2-ASN, `maxmind-db/reader`): país, continente,
   ASN y organización. Rutas en `GEOIP_COUNTRY_DB` y `GEOIP_ASN_DB`; si faltan, el espejo se
   desactiva sin errores.
3. **Proveedores remotos, balanceador de igual prioridad** (`GEO_PROVIDERS`, por defecto los cuatro),
   si no hay un fallo reciente en caché para esa IP. Cada consulta empieza por un proveedor al azar y,
   si está caído, en pausa o sin presupuesto, pasa al siguiente hasta agotar la cadena o un plazo
   total de 6,5 s. Presupuesto por proveedor contando **solo peticiones reales** (`ip_api_logs`,
   columna `provider`) y pausa por proveedor en `storage/ratelimit/<proveedor>-pause` ante un 429
   (`Retry-After`), `X-Rl: 0`/`X-Ttl` (ip-api) o un aviso de cuota agotada (proxycheck):

   | Proveedor | Presupuesto | Aporta |
   |---|---|---|
   | `ip-api` (http, gratuito) | 40/min | país, continente, ASN, ISP, proxy, hosting, mobile |
   | `proxycheck` (`PROXYCHECK_API_KEY` opcional) | 90/día sin clave, 950/día con clave | país, continente, ASN, proxy, **vpn**, hosting (`type: Hosting`), mobile (`type: Wireless`) |
   | `ipapi-is` (requiere `IPAPI_IS_API_KEY`) | 950/día | país, continente, ASN, proxy, **vpn**, hosting (`is_datacenter`), mobile |
   | `freeipapi` (sin clave) | 50/min | país, continente, ASN, proxy; **sin** vpn/hosting/mobile (resultado parcial) |

   Todo se normaliza al formato de ip-api más `vpn` y `source`; una bandera que el proveedor no
   aporta vale `null` (desconocida). `block_vpn` bloquea con `vpn: true` además de por proveedor.
4. Se combinan: el proveedor remoto manda; MaxMind rellena país, continente, ASN y organización
   cuando falten. Caché 24 h en éxito (1 h si el resultado es parcial), 5 min en fallo; un resultado
   solo de MaxMind no se cachea (`degraded: true`).
- `geoHealth()` devuelve `ip_api` como resumen de todos los proveedores (`ok` si alguno responde,
  `limited` si todos están en pausa o sin presupuesto, `down` si todos fallan) y `providers` con el
  estado de cada uno; `php bin/geoip-update.php --status` los muestra.
- `bin/geoip-update.php` descarga las bases con `MAXMIND_ACCOUNT_ID` + `MAXMIND_LICENSE_KEY`, verifica
  el SHA-256 y las sustituye de forma atómica (cron dos veces por semana).

## 7. Ajustes (`settings`)

| Clave | Tipo / rango | Por defecto |
|---|---|---|
| `block_proxy`, `block_vpn`, `block_hosting` | bool `0/1` | `1` |
| `block_mobile`, `ip_api_fail_open`, `notify_connections`, `notify_hispanic` | bool | `0` |
| `country_change_detection_enabled` | bool | `1` |
| `country_change_continent_only` | bool | `0` |
| `country_change_min_connections` | int 1–1000 | `10` |
| `compromised_ban_hours` | int 0–8760 (0 = permanente) | `24` |
| `auto_ban_evasion_ip` | bool | `1` |
| `country_change_min_percentage` | float 0–100 | `70` |
| `server_name` | texto ≤ 64 | `FurrGuard` |
| `discord_url` | URL https o vacío | `` |
| `fur_perms_enabled`, `fur_perms_log_allowed`, `fur_perms_log_blocked` | bool | `1` |
| `furrsecurity_enabled`, `furrsecurity_notify_admins` | bool | `1` |
| `furrsecurity_lock_movement`, `_lock_commands`, `_lock_inventory`, `_lock_server_switch` | bool | `1` |
| `furrsecurity_session_duration` | int 300–604800 (s) | `28800` |
| `furrsecurity_token_expiration` | int 60–3600 (s) | `180` |
| `furrsecurity_max_failed_attempts` | int 1–20 | `3` |
| `furrsecurity_failed_attempts_window` | int 300–2592000 (s) | `86400` |
| `furrsecurity_early_verify_time` | int 0–86400 (s) | `300` |
| `furrsecurity_alert_times` | lista CSV de 1–50 enteros ≥ 0 | `3600,1800,300,240,180,120,60,30` |
| `furrsecurity_verify_url` | URL https | `APP_URL/verify.php` |
| `furrsecurity_admin_permission` | nodo de permiso `[a-z0-9._*-]+` | `furrsecurity.notify` |
| `retention_connections_days`, `retention_logs_days` | int 0–3650 (0 = conservar siempre) | `0` |
| `cache_version` | int (solo sistema) | `0` |
| `api_key_hash`, `api_key_prefix`, `api_key_created_at` | solo sistema, nunca se devuelven | — |

Eliminadas: `api_key` (texto plano), `webhook_url`, `notify_blocks`.

## 8. Variables de entorno (`.env`)

`APP_ENV` (`production`/`development`), `APP_URL`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`,
`DB_PASSWORD`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`,
`FOUNDER_DISCORD_ID`, `TRUSTED_PROXIES`, `API_RATE_LIMIT_PER_MIN`, `GEOIP_COUNTRY_DB`,
`GEOIP_ASN_DB`, `MAXMIND_ACCOUNT_ID`, `MAXMIND_LICENSE_KEY`, `GEO_PROVIDERS`, `PROXYCHECK_API_KEY`,
`IPAPI_IS_API_KEY`.

Una variable del entorno real (PHP-FPM, systemd) tiene prioridad sobre `.env`.
`CORS_ALLOWED_ORIGIN` ya no existe: las APIs de plugin no envían cabeceras CORS.
