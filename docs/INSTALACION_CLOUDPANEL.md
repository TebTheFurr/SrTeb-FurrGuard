# FurrGuard 2.0 — Instalación y despliegue en CloudPanel

> **¿Servidor sin panel?** Para un Ubuntu 24.04 o Debian 12 con nginx, PHP-FPM y MariaDB instalados
> a mano, usuario de servicio propio y timers de systemd, sigue
> [`INSTALACION.md`](INSTALACION.md): cubre también el plugin y los módulos paso a paso.

Guía para instalar FurrGuard (web + API) en un VPS con CloudPanel (nginx + PHP-FPM) y configurar el
plugin y los módulos. El contrato entre la web, el plugin y los módulos está en `docs/API.md`.
**Si ya tienes una 1.x en producción, sigue `docs/ACTUALIZACION_2.0.md`.**

---

## 1. Requisitos

| Pieza | Versión | Notas |
|---|---|---|
| CloudPanel | 2.x | nginx + PHP-FPM |
| PHP | 8.2 o superior | extensiones `pdo_mysql`, `mbstring`, `curl`, `json`; `phar` y `zlib` para `bin/geoip-update.php` |
| Composer | 2.x | dependencias PHP (lector MaxMind); necesita `unzip` o la extensión `zip` |
| MariaDB / MySQL | 10.3+ / 5.7+ | probado en MariaDB 10.11 |
| Node.js | 20.19+ o 22.12+ para compilar | los tests de `public/` (Vitest 5) piden 22.12+ o 24+: usa **Node 22 LTS o 24 LTS** y sirve para todo |
| Cuenta MaxMind | gratuita | licencia GeoLite2 para el espejo local de geolocalización (recomendado) |
| JDK (compilar) | **21** para ejecutar Gradle, más un **JDK 17** instalado | el plugin compila con un toolchain 17 fijo y FurrSecurity con uno 21 (§11.1) |

Servidores de Minecraft:

| Jar | Dónde | Java mínimo |
|---|---|---|
| `FurrGuard-2.0.0.jar` | Velocity 3.4+ | 17 |
| `furrperms-module-2.0.0.jar` | Velocity 3.4+ | 17 |
| `FurrSecurity-2.0.0.jar` | Velocity 3.4+ **y** Paper 1.21.4+ | **21** (en los dos) |

---

## 2. Site y base de datos

1. CloudPanel → **Sites → Add Site → Create a PHP Site**: dominio (`furrguard.srteb.eu`), PHP 8.2+.
2. CloudPanel → **Databases → Add Database**: nombre, usuario y contraseña segura.

---

## 3. Código

La opción recomendada es clonar en el servidor y compilar allí.

```bash
ssh furrguard@tu-servidor
cd /home/furrguard/htdocs/furrguard.srteb.eu
git clone https://github.com/grinchhorizon/SrTeb-FurrGuard.git .
git checkout fix/auditoria          # rama de la 2.0 mientras no se fusione

composer install --no-dev --optimize-autoloader
(cd admin  && npm ci && npm run build)
(cd public && npm ci && npm run build)
```

> `npm ci` usa el `package-lock.json` exacto; no uses `npm install` en el servidor.
> `npm run build` hace primero la comprobación de tipos (`vue-tsc`) y deja el resultado en
> `admin/dist/` y `public/dist/`. Sin esas carpetas el panel y la landing responden 503.

**Alternativa (subir desde tu equipo con rsync):** compila en local y sube solo lo necesario.

```bash
composer install --no-dev --optimize-autoloader
(cd admin && npm ci && npm run build) && (cd public && npm ci && npm run build)

rsync -avz --delete \
  --exclude='.git*' --exclude='.env' --exclude='.claude' --exclude='.idea' \
  --exclude='node_modules' --exclude='admin/src' --exclude='public/src' \
  --exclude='shared' --exclude='libs' --exclude='modulos' --exclude='FurrGuard-plugin' \
  --exclude='docs' --exclude='deploy' --exclude='tests' --exclude='*.md' \
  --exclude='storage/sessions/*' --exclude='storage/ratelimit/*' --exclude='storage/geoip/*.mmdb' \
  ./ furrguard@tu-servidor:/home/furrguard/htdocs/furrguard.srteb.eu/
```

> Nunca subas volcados `.sql` de producción al servidor web.

---

## 4. Configuración (`.env`)

```bash
cp .env.example .env
nano .env
chmod 600 .env
```

Variables (todas comentadas en `.env.example` y listadas en `docs/API.md` §8):

```env
APP_ENV=production
APP_URL=https://furrguard.srteb.eu

DB_HOST=localhost
DB_PORT=3306
DB_NAME=furrguard
DB_USERNAME=furrguard_user
DB_PASSWORD=...

DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_REDIRECT_URI=https://furrguard.srteb.eu/admin/callback.php
FOUNDER_DISCORD_ID=...

# Solo si hay un proxy inverso propio delante (Cloudflare se detecta solo)
TRUSTED_PROXIES=

API_RATE_LIMIT_PER_MIN=6000

GEOIP_COUNTRY_DB=storage/geoip/GeoLite2-Country.mmdb
GEOIP_ASN_DB=storage/geoip/GeoLite2-ASN.mmdb
MAXMIND_ACCOUNT_ID=...
MAXMIND_LICENSE_KEY=...
```

- `APP_URL` es obligatoria, sin barra final y **con https**: de ella salen el origen permitido del
  panel, HSTS, las URL de Discord y de verificación y la cookie de sesión `__Host-furrguard`, que el
  navegador solo acepta por https. Con `http://` la cookie pierde el prefijo y `Secure` (solo sirve
  para desarrollo local).
- `DISCORD_REDIRECT_URI` vacía equivale a `APP_URL/admin/callback.php`.
- `APP_ENV=development` muestra errores en pantalla y abre la CSP al servidor de Vite: nunca en producción.
- `CORS_ALLOWED_ORIGIN` ya no se usa: si viene de una instalación antigua, bórrala.
- Una variable definida en el entorno de PHP-FPM tiene prioridad sobre `.env`.

`storage/` debe ser escribible por el usuario de PHP (sesiones, límites de peticiones, pausa de
ip-api y bases GeoIP):

```bash
chown -R furrguard:furrguard storage
chmod -R u+rwX,go-rwx storage
```

---

## 5. Base de datos: migraciones

Instalación nueva y actualización usan **el mismo comando**:

```bash
php bin/migrate.php            # aplica las migraciones pendientes
php bin/migrate.php --status   # lista aplicadas y pendientes
```

- Las migraciones están en `database/migrations/` y son idempotentes: si una se corta, vuelve a
  lanzar el comando. Ya no existen `install.sql` ni los `.sql` de los módulos.
- En una base vacía crean todas las tablas, los ajustes y mensajes por defecto y la lista de
  proveedores. No crean ningún usuario del panel: el founder es la cuenta de `FOUNDER_DISCORD_ID`,
  que tiene acceso siempre sin estar en `admin_users`, y el resto se añade desde **Usuarios**.
- **Antes de migrar una instalación existente, haz copia de la base de datos** (ver
  `docs/ACTUALIZACION_2.0.md`).

---

## 6. Geolocalización: espejo MaxMind

FurrGuard consulta ip-api.com (proxy, hosting, red móvil, ISP) y además una copia local de
**GeoLite2-Country** y **GeoLite2-ASN**. Si ip-api cae o agota su cuota, los bloqueos por país,
continente, ASN y proveedor siguen funcionando (respuestas con `degraded: true`).

1. Crea una cuenta gratuita en <https://www.maxmind.com/en/geolite2/signup> y genera una license key.
2. Pon `MAXMIND_ACCOUNT_ID` y `MAXMIND_LICENSE_KEY` en `.env`.
3. Descarga las bases: `php bin/geoip-update.php` (verifica el SHA-256 y las sustituye de forma atómica).

Sin estas bases FurrGuard funciona igual, pero sin el espejo: el **Resumen** del panel muestra
`missing` (faltan las `.mmdb`) o `disabled` (falta `composer install`).

---

## 7. nginx (CloudPanel → Sites → tu sitio → Vhost)

Sustituye el contenido por el siguiente. Los `{{…}}` son variables de CloudPanel: no los toques.
Solo son ejecutables los 7 puntos de entrada PHP (`index.php`, `verify.php`, `admin/index.php`,
`admin/api.php`, `admin/callback.php`, `api/plugin.php`, `api/furrsecurity.php`); todo lo demás
(código, configuración, datos) devuelve 404.

```nginx
server {
  listen 80;
  listen [::]:80;
  listen 443 quic;
  listen 443 ssl;
  listen [::]:443 quic;
  listen [::]:443 ssl;
  http2 on;
  http3 off;
  {{ssl_certificate_key}}
  {{ssl_certificate}}
  server_name furrguard.srteb.eu;
  root /home/furrguard/htdocs/furrguard.srteb.eu;
  index index.php;

  {{nginx_access_log}}
  {{nginx_error_log}}

  if ($scheme != "https") {
    rewrite ^ https://$host$request_uri permanent;
  }

  location ~ /.well-known {
    auth_basic off;
    allow all;
  }

  {{settings}}

  # Cabeceras base. PHP añade la CSP con nonce. No uses add_header dentro de las location
  # de abajo: nginx dejaría de heredar estas.
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;

  gzip on;
  gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;
  gzip_min_length 256;
  gzip_vary on;

  # ── Bloqueos ────────────────────────────────────────────────────────────
  location ~ /\.(?!well-known) { deny all; return 404; }
  location ~ ^/(config|includes|database|bin|storage|vendor|libs|modulos|FurrGuard-plugin|docs|tests|shared|deploy)(/|$) { deny all; return 404; }
  location ~ ^/(admin|public)/(src|node_modules)(/|$) { deny all; return 404; }
  location ~ \.(sql|tsv|md|json|lock|ya?ml|neon|xml|dist|log|env|bak|old|tmp|sh|bat|gradle|properties|java|ts|vue|mmdb|tsbuildinfo)$ { deny all; return 404; }

  # ── Assets compilados por Vite (base /admin/ y /public/) ────────────────
  location ^~ /admin/assets/ {
    alias /home/furrguard/htdocs/furrguard.srteb.eu/admin/dist/assets/;
    expires 1y;
    access_log off;
  }
  location ^~ /public/assets/ {
    alias /home/furrguard/htdocs/furrguard.srteb.eu/public/dist/assets/;
    expires 1y;
    access_log off;
  }

  # ── Puntos de entrada PHP (únicos ejecutables) ─────────────────────────
  location ~ ^/(index|verify)\.php$|^/admin/(index|api|callback)\.php$|^/api/(plugin|furrsecurity)\.php$ {
    include fastcgi_params;
    fastcgi_intercept_errors on;
    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    try_files $uri =404;
    fastcgi_read_timeout 60;
    fastcgi_send_timeout 60;
    fastcgi_pass 127.0.0.1:{{php_fpm_port}};
    fastcgi_param PHP_VALUE "{{php_settings}}";
  }
  location ~ \.php$ { deny all; return 404; }

  # ── Rutas de los SPA ───────────────────────────────────────────────────
  location = /admin {
    return 301 /admin/;
  }
  location /admin/ {
    try_files $uri /admin/index.php?$query_string;
  }
  location / {
    try_files $uri /index.php?$query_string;
  }
}
```

> **Bloque del puerto 8080:** CloudPanel lo añade para Varnish. Si no usas Varnish en este sitio,
> elimínalo. Si lo usas, cambia `listen 8080` por `listen 127.0.0.1:8080` y copia los mismos bloqueos.
>
> `fastcgi_read_timeout 60` cubre el `poll_changes` con espera larga (máx. 25 s). El `.htaccess` de la
> raíz es solo un equivalente de emergencia para Apache; la instalación soportada es nginx.

---

## 8. SSL y Discord

- CloudPanel → **SSL/TLS → Let's Encrypt** y activa **Force HTTPS**.
- Discord Developer Portal → tu aplicación → **OAuth2 → Redirects**, añade exactamente:
  - `https://furrguard.srteb.eu/admin/callback.php` (panel; o el valor de `DISCORD_REDIRECT_URI`)
  - `https://furrguard.srteb.eu/verify.php` (verificación de staff; siempre `APP_URL/verify.php`)

---

## 9. Tareas programadas (cron)

CloudPanel → **Cron Jobs** (usuario del sitio). Usa el binario de la misma versión de PHP que el
sitio (p. ej. `php8.3`) si `php` apunta a otra:

```cron
# Cachés, sesiones del panel, enlaces y sesiones de FurrSecurity antiguos, intentos fallidos,
# archivos de límites y retención configurada (retention_*_days): cada hora
17 * * * * php /home/furrguard/htdocs/furrguard.srteb.eu/bin/cleanup.php > /dev/null 2>&1
# Bases GeoLite2 (MaxMind publica actualizaciones dos veces por semana)
43 4 * * 2,5 php /home/furrguard/htdocs/furrguard.srteb.eu/bin/geoip-update.php > /dev/null 2>&1
```

`bin/cleanup.php` usa un bloqueo en la BD: si una ejecución anterior sigue en marcha, la nueva sale sin hacer nada.

---

## 10. Primer arranque

1. Abre `https://furrguard.srteb.eu/admin/` e inicia sesión con Discord con la cuenta de `FOUNDER_DISCORD_ID`.
2. **Ajustes**, apartado de la API key: genera una y cópiala, porque solo se muestra una vez. Mientras no exista,
   las APIs de plugins responden `503 api_key_not_configured`.
3. **Ajustes → FurrSecurity:** revisa la URL de verificación (por defecto `APP_URL/verify.php`),
   la duración de sesión, los intentos fallidos y los bloqueos.
4. Configura el plugin y los módulos con esa clave (§11).
5. Revisa en **Resumen** el estado de la API key, ip-api y el espejo MaxMind.

---

## 11. Plugin Velocity y módulos

### 11.1 Compilar

Se compilan desde el monorepo con el wrapper de Gradle (8.14.4) de cada proyecto; la librería común
`libs/furrguard-common` entra sola (`includeBuild`) y va sombreada dentro de cada jar.

- Ejecuta Gradle con **JDK 21** (Gradle 8.14 no arranca sobre JDK 26).
- **FurrGuard-plugin** compila con un toolchain **17 fijo**: necesitas un JDK 17 instalado donde
  Gradle lo encuentre (rutas estándar, SDKMAN, `org.gradle.java.installations.paths`…). El jar
  ofuscado usa los `jmods` de ese JDK: Temurin los trae; en Debian/Ubuntu instala `openjdk-17-jmods`.
- **FurrSecurity** compila con un toolchain **21** (`-PtoolchainVersion=<n>` usa otro JDK instalado ≥ 21).
- **FurrPerms** y la librería común compilan con la JVM que ejecuta Gradle (bytecode Java 17).

```bash
(cd FurrGuard-plugin && ./gradlew build)
(cd modulos/furrsecurity-module && ./gradlew build)
(cd modulos/furrperms-module && ./gradlew build)
```

`build` ejecuta también los tests (añade `-x test` para saltarlos). Resultado:

| Jar | Instalar en |
|---|---|
| `FurrGuard-plugin/build/libs/FurrGuard-2.0.0.jar` | `plugins/` de Velocity |
| `FurrGuard-plugin/build/libs/FurrGuard-2.0.0-obfuscated.jar` | alternativa ofuscada del anterior: instala **uno de los dos**, nunca ambos |
| `modulos/furrperms-module/build/libs/furrperms-module-2.0.0.jar` | `plugins/` de Velocity |
| `modulos/furrsecurity-module/build/libs/FurrSecurity-2.0.0.jar` | `plugins/` de Velocity **y** de cada backend Paper 1.21.4+ (mismo jar), con Java 21 |

### 11.2 FurrGuard (`plugins/furrguard/config.yml`)

| Clave | Por defecto | Notas |
|---|---|---|
| `enabled` | `true` | `false`: el proxy deja entrar a todos sin comprobar |
| `debug` | `false` | registra acción, estado y tiempo de cada llamada (nunca cuerpos ni la clave) |
| `api.url` | `https://tu-dominio.com/api/plugin.php` | pon `https://furrguard.srteb.eu/api/plugin.php`; exige https y rechaza el valor de ejemplo |
| `api.key` | `YOUR_SECURE_API_KEY_HERE` | la clave del panel; la de ejemplo se rechaza |
| `api.timeout` | `8000` | ms, plazo **total** de cada petición con reintentos; máximo 25000 |
| `api.connect-timeout` | `5000` | ms para abrir la conexión |
| `api.allow-insecure-http` | `false` | solo desarrollo: permite `http://` |
| `api.failure-policy` | `deny` | `deny` o `allow`: qué hacer con un login si la API no decide (red, timeout, 5xx, 429, JSON inválido). Una clave rechazada (401/403), otro 4xx o una configuración incorrecta deniegan siempre |
| `api.poll-interval` | `5` | segundos entre `poll_changes` (1–300) |
| `cache.enabled` | `true` | guarda solo respuestas correctas; se vacía al cambiar algo en el panel y con `/fg reload` |
| `cache.duration` | `300` | segundos |
| `license.discord-url` | `discord.gg/srteb` | enlace del mensaje "sin licencia" |
| `notifications.hispanic-countries` | `[ES, MX, AR, CO, PE, VE, CL, EC, GT, CU, BO, DO, HN, PY, SV, NI, CR, PA, UY, GQ]` | países que no disparan el aviso de `notify_hispanic` |

- Si `config.yml` no es válida al arrancar, **se deniegan todos los logins** ("servidor iniciando")
  hasta corregirla y usar `/fg reload`; un `/fg reload` con errores conserva la configuración anterior.
- Mientras verifica la licencia deniega los logins; sin licencia vinculada muestra en la consola el
  código de vinculación. Si el servidor de licencias no responde, hay 72 h de gracia desde la última
  verificación correcta.
- Comandos `/furrguard` (alias `/fg`, `/guard`) con permiso `furrguard.admin`: `check <jugador>`,
  `status`, `stats`, `cache <clear|info>`, `reload`, `help`. Los avisos llegan a quien tenga
  `furrguard.notify` o `furrguard.admin`.

### 11.3 FurrSecurity (`config.yml` en Velocity y en cada Paper)

| Clave | Por defecto | Notas |
|---|---|---|
| `enabled` | `true` | `false`: no bloquea a nadie |
| `proxy-mode` | `false` | solo Paper detrás de un Velocity con FurrSecurity: bloquea y espera a que el jugador verifique en el proxy |
| `api.url` | `https://furrguard.srteb.eu/api/furrsecurity.php` | exige https |
| `api.key` | `YOUR_API_KEY_HERE` | con la de ejemplo el staff queda bloqueado |
| `alert-times` | `[3600, 1800, 300, 240, 180, 120, 60, 30]` | valor inicial |
| `early-verify-time` | `300` | valor inicial |
| `lock.movement`, `lock.commands`, `lock.inventory`, `lock.server-switch` | `true` | valores iniciales |
| `lock.chat` | `true` | **solo local y solo Paper** (Velocity no puede cortar el chat de clientes 1.19.1+) |
| `notify-admins` | `true` | valor inicial |
| `admin-permission` | `furrsecurity.notify` | valor inicial |

- Los "valores iniciales" solo se usan hasta que responde la API: después mandan los ajustes del
  panel (**Ajustes → FurrSecurity**), que se releen cada minuto. La duración de sesión, la caducidad
  del enlace, los intentos máximos y la URL de verificación solo existen en el panel.
- La conexión con la API no es configurable: 5 s para conectar, 10 s en total y 2 reintentos.
  Cualquier fallo **bloquea y reintenta** (nunca deja pasar).
- Solo tiene que verificar el staff dado de alta en la sección **FurrSecurity** del panel (Discord
  ID + nick). Quien tenga `furrsecurity.staff`, `furrguard.*` o `*`, o esté en esa lista, queda bloqueado al
  entrar hasta que la API responda. Comandos `/furrsecurity` (alias `/fsec`, `/fs`) con
  `furrsecurity.admin`: `reload`, `status`, `check`, `reset`, `help`.

### 11.4 FurrPerms (`plugins/furrperms-module/config.yml`)

| Clave | Por defecto | Notas |
|---|---|---|
| `enabled` | `true` | `false`: los comandos de permisos quedan sin proteger |
| `debug` | `false` | registra cada decisión (nunca los argumentos) |
| `api.url` | `https://furrguard.srteb.eu/api/plugin.php` | exige https |
| `api.key` | `YOUR_FURRGUARD_API_KEY_HERE` | con la de ejemplo se deniegan los comandos protegidos; si falta se lee la clave antigua `api-key` |
| `commands.protected` | `[]` | comandos que se **suman** a la lista integrada (alias de LuckPerms, op, deop, PermissionsEx, con namespace y dentro de `execute … run`/`sudo`) |
| `notifications.blocked` | `true` | avisos a quien tenga `furrperms.notify` (y a la consola) |
| `notifications.allowed` | `true` | |

- Si la API no responde, el comando se deniega. El staff de FurrSecurity necesita además una sesión
  verificada desde su IP (`needs_furrsecurity`).
- No tiene comando de recarga: tras cambiar `config.yml`, reinicia el proxy.

---

## 12. Comprobaciones

```bash
# API: GET → 405; POST sin clave → 401 (503 api_key_not_configured si aún no hay clave); con clave → JSON
curl -s -o /dev/null -w '%{http_code}\n' 'https://furrguard.srteb.eu/api/plugin.php?action=get_settings'
curl -s -o /dev/null -w '%{http_code}\n' -X POST 'https://furrguard.srteb.eu/api/plugin.php?action=get_settings'
curl -s -X POST -H 'X-API-Key: fg_…' 'https://furrguard.srteb.eu/api/plugin.php?action=get_settings'

# Nada interno es accesible → 404
for p in .env config.php includes/security.php database/migrations storage/ docs/API.md \
         composer.json admin/package.json admin/api/router.php FurrGuard-plugin/build.gradle; do
  printf '%-34s ' "$p"; curl -s -o /dev/null -w '%{http_code}\n' "https://furrguard.srteb.eu/$p"
done
```

- `https://furrguard.srteb.eu/` → landing.
- `https://furrguard.srteb.eu/verify.php` sin token → error "Token no proporcionado" (HTTP 400).
- `/admin/` responde con `Content-Security-Policy` con `nonce-…` y la cookie `__Host-furrguard`.
- En el proxy, `/fg status` muestra "Plugin ✔ Activo" y "API ✔ Conectada".

---

## 13. Actualizar (dentro de 2.x)

```bash
cd /home/furrguard/htdocs/furrguard.srteb.eu
# 1) copia de seguridad de la base de datos
git pull
composer install --no-dev --optimize-autoloader
(cd admin && npm ci && npm run build) && (cd public && npm ci && npm run build)
php bin/migrate.php
```

Si PHP-FPM tiene OPcache con `validate_timestamps=0`, reinícialo desde CloudPanel. Para pasar de 1.x
a 2.0 usa `docs/ACTUALIZACION_2.0.md`.

---

## 14. Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| El plugin expulsa con "Error de verificación" | API caída, clave incorrecta o sin clave: revisa `/fg status` y el Resumen del panel |
| Todos los logins se deniegan con "servidor iniciando" | `config.yml` del plugin no válida (la consola lista los problemas) o licencia aún verificándose |
| `503 api_key_not_configured` | Genera la API key en Ajustes |
| Panel o landing con "falta compilar la interfaz" (503) | Falta `npm run build` en `admin/` o `public/` |
| 404 en `/admin/assets/` o `/public/assets/` | Revisa los `alias` de nginx |
| Discord no vuelve al panel o vuelve con error | `DISCORD_REDIRECT_URI` distinta de la del portal de Discord |
| Cada acción del panel da 403 "Token CSRF inválido" | `APP_URL` no coincide con el origen real (http en vez de https, otro dominio o barra final) |
| La sesión del panel caduca sola | Cambió tu IP (IPv4, o de red /64 en IPv6), 2 h de inactividad, 8 h desde el login o has entrado desde otro dispositivo |
| "Token CSRF inválido" en el panel | La pestaña lleva abierta desde antes del último login: recarga |
| Resumen: espejo MaxMind "missing" / "disabled" | Faltan las `.mmdb` (`php bin/geoip-update.php`, revisa `MAXMIND_*`) o falta `composer install` |
| Resumen: ip-api "limited" | Cuota gratuita agotada: el espejo MaxMind cubre país, continente y ASN |
| FurrSecurity no carga en Paper o Velocity | Necesita Java 21 |
| Discord OAuth no vuelve | Los redirects del portal deben coincidir exactamente con `DISCORD_REDIRECT_URI` y `APP_URL/verify.php` |
