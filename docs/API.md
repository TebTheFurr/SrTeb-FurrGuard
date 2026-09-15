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
  - UUID: minúsculas con guiones `8-4-4-4-12`.
  - IP: `inet_ntop(inet_pton())`; IPv4 mapeada (`::ffff:1.2.3.4`) → `1.2.3.4`.
  - `ip_range`: CIDR canónico (dirección de red). Prefijo mínimo /8 en IPv4 y /16 en IPv6.
  - `as`: `AS` + dígitos (acepta `AS1234`, `1234`, `AS1234 Nombre`).
  - Nick: `^[.*]?[A-Za-z0-9_]{1,16}$` y longitud total ≤ 16 (el prefijo `.`/`*` es de Floodgate).
- **Ámbito de IP** (`sameIpScope`): IPv4 igual exacta; IPv6 mismo `/64`.
- **Baneos automáticos de IPv6** se guardan como `ip_range` `/64` (una IPv6 suelta rota).
- **Errores JSON:** HTTP con el código adecuado (400, 401, 403, 404, 409, 422, 429, 500, 503) y
  cuerpo `{"success": false, "error": "<mensaje en español>", "code": "<slug>"}`.
  En las APIs de plugin el cuerpo es `{"error": "<slug>", "message": "<texto>"}`.
- **429:** cabecera `Retry-After: <segundos>` y campo `retry_after` en el cuerpo.

## 1. API de plugins — `POST /api/plugin.php?action=<acción>`

Cabecera `X-API-Key`, cuerpo `application/x-www-form-urlencoded`. Sin cookies ni sesión PHP.
Sin cabeceras CORS (es tráfico servidor a servidor).

### 1.1 Autenticación y límites

1. Sin clave o clave inválida → 401 `invalid_api_key`. Los fallos cuentan en un cubo por IP
   (`30/min`); al pasarlo → 429.
2. La clave se guarda **hasheada** (`settings.api_key_hash` = SHA-256 hex). Si no hay clave
   configurada → 503 `api_key_not_configured` (la instalación nueva no acepta nada hasta que el
   founder genere una desde el panel).
3. Tráfico autenticado: un cubo **por clave**, `API_RATE_LIMIT_PER_MIN` (env, por defecto 6000).
   **No hay límite por IP** para tráfico autenticado: todo el tráfico de la red sale de la IP del proxy.

### 1.2 Acciones

| Acción | Entrada | Salida (200) |
|---|---|---|
| `check_player` | `uuid?`, `nick`, `ip`, `game_version?` | ver 1.3 |
| `recheck_players` | `players` = JSON `[{"uuid","nick","ip"}]` (máx. 500) | `{"results":[{"uuid","allowed","reason","block_reason","block_type","expires_at","ban_id"}]}` |
| `lookup_player` | `nick` | `{"found":true,"uuid","nick","ip","is_online","first_seen","last_seen","allowed","reason","block_type","expires_at","ban_id","ip_data":{}}` o `{"found":false}` |
| `player_join` | `uuid`, `nick`, `ip` | `{"success":true}` |
| `player_quit` | `uuid` | `{"success":true}` |
| `get_messages` | — | objeto plano `{"clave":"valor"}` |
| `get_settings` | — | solo `notify_connections`, `notify_hispanic`, `server_name`, `discord_url`, `cache_version` |
| `poll_changes` | `last_version`, `wait?` (0–25, por defecto 25 por compatibilidad) | `{"changed":bool,"cache_version":int,"recent_actions":[{"id","type","action","details"}]}` |
| `add_whitelist` / `remove_whitelist` | `type`, `value`, `reason?`, `added_by?` | `{"success":true}` |
| `add_blacklist` | `type`, `value`, `reason?`, `added_by?`, `duration?` (min), `stain_ip?` | `{"success":true,"ban_id"}` |
| `remove_blacklist` | `type`, `value` | `{"success":true,"affected":int}` (desactiva padre **e hijas**) |
| `check_furr_perms_whitelist` | `nick`, `uuid`, `ip` | `{"allowed":bool,"reason":"not_whitelisted"\|"uuid_mismatch"\|"needs_furrsecurity"\|"ok"\|"module_disabled"}` |
| `log_furr_perms_command` | `player_uuid`, `player_nick`, `command` (≤255), `server_name`, `allowed` 0/1, `reason?`, `ip_address?` | `{"success":true}` |

- `recent_actions` solo incluye tipos `whitelist` y `blacklist` (nunca inicios de sesión ni ajustes).
- Los clientes nuevos llaman a `poll_changes` con `wait=0` cada 5 s. Si cambia la versión:
  recargan `get_messages` y `get_settings` y hacen **un** `recheck_players` con todos los conectados.

### 1.3 `check_player`

Orden de evaluación (no cambiar sin actualizar este documento):

1. Validación y normalización (nick, IP, UUID).
2. Geolocalización (`includes/geo.php`, ver §6).
3. **Blacklist** (uuid → nick → as → ip → ip_range). Un baneo gana siempre, también a la whitelist.
4. **Whitelist** (uuid, nick, ip, ip_range, as): exime de los pasos 5 y 6, **no** de la blacklist.
5. Detección de cuenta comprometida (cambio drástico de país).
6. Reglas automáticas: proxy → vpn → hosting → mobile → proveedor bloqueado → país → continente.

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

- `ip_data` es **siempre un objeto** (`{}` si no hay datos), nunca un array.
- `reason` ∈ `allowed`, `whitelisted`, `blacklisted`, `compromised_account`, `proxy_detected`,
  `vpn_detected`, `hosting_detected`, `mobile_detected`, `blocked_provider`, `blocked_country`,
  `blocked_continent`, `ip_api_unavailable`.
- `degraded: true` cuando ip-api no respondió y se usó solo el espejo MaxMind: se aplican país,
  continente, ASN y proveedores; proxy/hosting/mobile no se pueden evaluar.
- `ip_api_unavailable` solo si **no hay ningún dato** (ni caché, ni ip-api, ni MaxMind) y
  `ip_api_fail_open = 0`.
- Motivos que **justifican expulsar a un jugador ya conectado** (`recheck_players`): `blacklisted`,
  `blocked_country`, `blocked_continent`, `blocked_provider`, `proxy_detected`, `vpn_detected`,
  `hosting_detected`, `mobile_detected`. Nunca `ip_api_unavailable` ni errores.
- `recheck_players` no registra conexiones, no suma contadores, no llama a ip-api ni a Mojang (solo
  caché + MaxMind) y no ejecuta la detección de cuenta comprometida.

### 1.4 Semántica de baneos (`includes/bans.php`)

- `UNIQUE(type, value)`. `upsertBan()` en modo:
  - `manual`: si hay un baneo **activo y no expirado** → conflicto (409 en el panel). Si existe
    inactivo o expirado → se **reactiva** con `ban_id` nuevo, motivo, autor, expiración y
    `parent_id` nuevos. Si no existe → se inserta.
  - `auto` (cuenta comprometida, FurrSecurity, evasión): si hay uno activo y no expirado → **no se
    toca** (conserva motivo, autor y expiración del admin). Si existe inactivo o expirado → se
    reactiva como baneo automático permanente. Si no existe → se inserta. Siempre deja traza en
    `activity_logs` (`type=security`).
- Desactivar/activar un baneo aplica al padre **y a sus hijas**. Editar la expiración del padre
  la propaga a las hijas. Borrar un padre borra las hijas (FK en cascada).
- "IP manchada" y la IP de evasión se crean como **hijas** (`parent_id`) del baneo que las origina.
- Los flags `players.is_whitelisted`/`is_blacklisted` desaparecen: el estado se calcula con `EXISTS`.

## 2. API FurrSecurity — `POST /api/furrsecurity.php?action=<acción>`

Mismas reglas de autenticación y límites que §1.1.

| Acción | Entrada | Salida |
|---|---|---|
| `check_status` | `uuid`, `nick`, `ip` | `{"needs_verification":bool,"reason":"module_disabled"\|"not_staff"\|"already_verified"\|"no_valid_session"\|"ip_changed","discord_id"?,"session"?:{"expires_at","time_remaining_seconds"}}` |
| `get_staff` | — | `{"staff":[{"nick":"Nombre"}]}` |
| `generate_token` | `uuid`, `nick`, `ip` | `{"success":true,"token","verify_url","existing":bool,"token_expires_in_seconds"}` o `{"success":false,"error":"not_in_whitelist"}` |
| `verify_token_status` | `token` | `{"status":"pending"\|"verified"\|"token_expired"\|"expired"\|"not_found","verified":bool,"token_expires_in_seconds"?,"expires_at"?,"time_remaining_seconds"?}` |
| `get_session` | `uuid`, `ip` | `{"has_session":bool,"session"?:{"id","nick","discord_id","verified_at","expires_at","time_remaining_seconds"}}` |
| `extend_session` | `uuid`, `ip`, `token?` | `{"success":bool,"expires_at"?,"time_remaining_seconds"?,"error"?}` |
| `player_disconnect` | `uuid`, `nick`, `locked` 0/1 | `{"success":true}` |
| `reset_session` | `uuid`, `nick` | `{"success":true,"sessions_expired":int}` |
| `record_failed_attempt` | `uuid`, `nick`, `ip` | `{"success":true,"failed_attempts":int,"blacklisted":bool}` |
| `get_settings` | — | todas las claves `furrsecurity_*` (§7) |
| `get_messages` | — | objeto plano con claves `furrsecurity_*` |

Reglas:

- **La sesión verificada está atada a la IP** (`sameIpScope`). `check_status` desde otra IP →
  `needs_verification:true`, `reason:"ip_changed"`. La IP de la sesión es la que pidió el token.
- `generate_token` reutiliza un token pendiente solo si es de la **misma IP** y no ha expirado;
  si no, expira el anterior y crea uno nuevo. El enlace dura `furrsecurity_token_expiration`.
- `extend_session` exige una sesión verificada, **no expirada** y de la misma IP.
- `player_disconnect` solo deja log si el jugador es staff o `locked=1`. Con `locked=1` y un token
  pendiente registra un intento fallido.
- Los intentos fallidos cuentan dentro de `furrsecurity_failed_attempts_window` (segundos).
  Al llegar a `furrsecurity_max_failed_attempts` → `upsertBan(auto)` de uuid + nick + IP, con el
  nick y la IP como hijas del baneo por UUID.
- **Los clientes fallan en cerrado:** cualquier error HTTP, timeout o JSON inválido en
  `check_status` significa "bloquear y reintentar", nunca "dejar pasar".

## 3. Verificación web — `/verify.php`

Página PHP que sirve `public/dist/index.html` e inyecta `window.__VERIFY_DATA__`:

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
   `state:"confirm"` con la IP, el país y la hora de la solicitud.
2. El usuario confirma "soy yo quien está entrando desde esta IP" → formulario
   `POST /verify.php` con `action=confirm`, `token`, `csrf`. El servidor guarda el token en sesión y
   responde `303` a Discord OAuth (`state` aleatorio en sesión).
3. `GET /verify.php?code=…&state=…` → valida `state`, que el token de la sesión siga `pending` y no
   expirado, y que el Discord ID coincida. Si coincide: `verified`, `verified_at = NOW()`,
   `expires_at = NOW() + furrsecurity_session_duration`. Si no: intento fallido.
4. La SPA limpia `code`/`state`/`token` de la URL con `history.replaceState`.

`redirect_uri` sale de `APP_URL` (env), nunca de la cabecera `Host`.

## 4. Panel — `/admin/`

### 4.1 Arranque

`admin/index.php` sirve `admin/dist/index.html` e inyecta:

```ts
window.__FURRGUARD__ = {
  version: string,
  csrfToken: string,
  loginUrl: string,              // URL de Discord OAuth
  loginError: string | null,     // invalid_code | invalid_state | discord_error | no_access |
                                 // session_expired | access_revoked | rate_limited
  user: null | { discord_id: string; username: string; avatar: string | null;
                 role: 'founder'|'owner'|'manager'|'sradmin'|'admin' },
  permissions: string[],         // secciones del rol actual (ver 4.3)
  canSeeIps: boolean,
}
```

### 4.2 Peticiones

- `POST /admin/api.php`, `Content-Type: application/json`, cabecera `X-CSRF-Token`, cuerpo
  `{"action": "...", ...parámetros}`.
- El servidor exige método POST, JSON, token CSRF válido y, si llegan, `Origin` igual a `APP_URL` y
  `Sec-Fetch-Site: same-origin`. Si no → 403 `code:"csrf"`.
- Éxito: `{"success": true, "data": ...}`. Listas paginadas:
  `{"items": [...], "pagination": {"page", "per_page", "total", "total_pages"}}`.
  Parámetros `page` (≥1) y `per_page` (por defecto 25, máx. 100).
- Límite: 300 peticiones/min por usuario del panel (y 60/min por IP sin autenticar).
- 401 → la SPA muestra el login. 403 `code:"forbidden"` → aviso de permisos.

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

- La SPA usa **exactamente** estas secciones (ya no existe `modules`).
- Sin la sección `ips`, el servidor **oculta las IPs** en jugadores, resumen y detalle
  (`last_ip: null`, `ips: []`, `ip: null`, `ip_hidden: true`) y no permite buscar por IP.

### 4.4 Acciones

| Acción | Sección | Parámetros | `data` |
|---|---|---|---|
| `logout` | — | — | `null` |
| `get_overview` | overview | — | `{online_players,total_players,connections_24h,blocked_24h,recent_connections[],recent_blocks[],counts:{whitelist,blacklist,providers,countries,continents},health:{api_key_configured,geo_mirror:"ok"\|"missing"\|"disabled",ip_api:"ok"\|"limited"\|"down"}}` |
| `get_players` | players | `page,per_page,filter(all\|online\|whitelisted\|blacklisted),search` | lista de `{id,uuid,last_nick,first_nick,last_ip,last_country,last_country_code,is_online,is_whitelisted,is_blacklisted,total_connections,first_seen,last_seen}` |
| `get_player_detail` | players | `uuid` | `{player,nicks[],ips[],recent_connections[],whitelist_entries[{id,type,value}],blacklist_entries[{id,ban_id,type,value,reason,active,expires_at}],premium:{status,uuid}}` |
| `lookup_player` | players | `player_name` | `{status:"premium"\|"not_found"\|"unknown",uuid,name}` |
| `get_name_history` | players | `player_name` | `{uuid,history:[{name,changed_at}]}` |
| `get_connections` | connections | `page,per_page,filter(all\|allowed\|blocked\|proxy\|vpn\|hosting\|mobile),search` | lista |
| `get_connection_detail` | connections | `id` | `{connection}` |
| `get_ips` | ips | `page,per_page,search` | lista `{ip,country,country_code,isp,asn,first_seen,player_count,connection_count,is_whitelisted,is_blacklisted}` |
| `get_ip_detail` | ips | `ip` | `{ip,players[]}` |
| `get_whitelist` | whitelist | `page,per_page,type,search` | lista `{id,type,value,reason,added_by,created_at,minecraft_name}` |
| `add_whitelist` | whitelist | `type,value,reason` | `{id}` |
| `edit_whitelist` | whitelist | `id,type,value,reason` | `null` |
| `remove_whitelist` | whitelist | `id` | `null` |
| `get_blacklist` | blacklist | `page,per_page,type,status(all\|active\|inactive\|expired),search` | lista de padres `{id,ban_id,type,value,reason,added_by,active,expires_at,created_at,minecraft_name,children[{id,ban_id,type,value,active,expires_at}]}` |
| `add_blacklist` | blacklist | `type,value,reason,duration_minutes(0=permanente),stain_ip` | `{id,ban_id,reactivated}` |
| `add_blacklist_unified` | blacklist | `player_name,reason,duration_minutes,stain_ip` | `{id,ban_id,type,value,is_premium,player_name}` (el servidor ignora cualquier uuid del cliente) |
| `edit_blacklist` | blacklist | `id,reason,duration_minutes(null=sin cambios)` | `null` |
| `set_blacklist_active` | blacklist | `id,active` | `null` |
| `remove_blacklist` | blacklist | `id` | `null` |
| `add_blacklist_ip` | blacklist | `parent_id,ip` | `{id}` |
| `get_sanctions` | sanctions | `page,per_page,filter(all\|active\|expired\|inactive\|permanent\|temporary),search` | lista + `stats` con los mismos criterios que los filtros |
| `get_providers` | providers | `page,per_page,type,search` | lista + `stats:{hosting,vpn,proxy}` |
| `add_provider` / `toggle_provider` / `delete_provider` | providers | `name,pattern(≥3),type` / `id,active` / `id` | … |
| `get_countries` … `delete_country` | countries | igual que hoy, paginado | … |
| `get_continents` … `delete_continent` | continents | igual que hoy | … |
| `get_messages` | messages | — | `{messages:{clave:valor}}` |
| `save_messages` | messages | `messages` (solo claves cambiadas y existentes) | `null` |
| `get_logs` | logs | `page,per_page,type,search` | lista `{id,type,action,details,ip_address,created_at}` |
| `get_settings` | settings | — | `{settings:{…sin secretos},api_key:{configured,prefix,created_at}}` |
| `save_settings` | settings | `settings` (solo claves cambiadas, validadas §7) | `null` |
| `regenerate_api_key` | settings | — | `{api_key,prefix}` (la clave solo se muestra aquí, una vez) |
| `export_data` | settings | — | sin `api_key*` ni secretos |
| `migrate_blacklist` / `migrate_players` | settings | `cursor?`, `batch_size?`(≤25) | `{processed,skipped,changed,next_cursor\|null,details[]}` |
| `get_admin_users` / `add_admin_user` / `remove_admin_user` | users | como hoy | … |
| `get_furr_perms_whitelist` / `add_furr_perms_whitelist` / `remove_furr_perms_whitelist` | furrperms | paginado; `nick,uuid?,reason` | … |
| `get_furr_perms_logs` / `clear_furr_perms_logs` | furrperms | `page,per_page,filter,search` | … |
| `furrsecurity_get_staff` / `furrsecurity_add_staff` / `furrsecurity_remove_staff` | furrsecurity | como hoy | … |
| `furrsecurity_get_sessions` | furrsecurity | `status(active\|pending\|all),search` | lista |
| `furrsecurity_get_logs` | furrsecurity | `page,per_page,group(all\|verification\|failed\|blacklist\|session),search` | lista |
| `furrsecurity_revoke_session` / `furrsecurity_get_stats` | furrsecurity | `id` / — | … |

- `activity_logs.type` ∈ `auth`, `whitelist`, `blacklist`, `providers`, `countries`, `continents`,
  `messages`, `settings`, `users`, `furrperms`, `furrsecurity`, `security`, `players`.
  Todo cambio de ajustes, mensajes, toggles o migraciones deja traza.

## 5. Sesión del panel

- Cookie `HttpOnly`, `Secure` (según `APP_URL`), `SameSite=Lax`, `session.use_strict_mode=1`.
- Tras el login: `session_regenerate_id(true)`, token CSRF nuevo y fila en `admin_sessions` con
  `session_token_hash` (SHA-256). Cada petición valida esa fila (no revocada, no expirada).
- Caducidad absoluta 8 h desde el login, inactividad 2 h, regeneración de ID cada 30 min.
- IP: se aprende una por familia (IPv4 exacta, IPv6 /64). Si llega otra IP de una familia ya
  aprendida → sesión inválida. Un cambio IPv4↔IPv6 no cierra la sesión.
- Quitar un usuario o cambiar su rol revoca sus filas de `admin_sessions`.

## 6. Geolocalización (`includes/geo.php`)

1. `ip_cache` vigente → se usa.
2. **Espejo local MaxMind** (GeoLite2-Country + GeoLite2-ASN, `maxmind-db/reader`): país, continente,
   ASN y organización. Rutas en `GEOIP_COUNTRY_DB` y `GEOIP_ASN_DB`; si faltan, el espejo se
   desactiva sin errores.
3. **ip-api** (HTTP, plan gratuito) si hay presupuesto: aporta ISP, proxy, hosting y mobile.
   Presupuesto 40/min contando **solo peticiones reales** (`ip_api_logs`) y respetando `X-Rl`/`X-Ttl`.
4. Se combinan: ip-api manda en ISP/proxy/hosting/mobile; MaxMind rellena país, continente y ASN
   cuando ip-api no los da. Caché 24 h en éxito y 5 min en fallo.
- `bin/geoip-update.php` descarga las bases con `MAXMIND_ACCOUNT_ID` + `MAXMIND_LICENSE_KEY` (cron semanal).

## 7. Ajustes (`settings`)

| Clave | Tipo / rango | Por defecto |
|---|---|---|
| `block_proxy`, `block_vpn`, `block_hosting` | bool `0/1` | `1` |
| `block_mobile`, `ip_api_fail_open`, `notify_connections`, `notify_hispanic` | bool | `0` |
| `country_change_detection_enabled` | bool | `1` |
| `country_change_continent_only` | bool | `0` |
| `country_change_min_connections` | int 1–1000 | `3` |
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
| `furrsecurity_alert_times` | lista CSV de enteros ≥ 0 | `3600,1800,300,240,180,120,60,30` |
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
`GEOIP_ASN_DB`, `MAXMIND_ACCOUNT_ID`, `MAXMIND_LICENSE_KEY`.
