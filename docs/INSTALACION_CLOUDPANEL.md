# FurrGuard 2.0 — Instalación y despliegue en CloudPanel

Guía completa para instalar o actualizar FurrGuard (web + API) en un VPS con CloudPanel
(nginx + PHP-FPM). El contrato entre la web, el plugin y los módulos está en `docs/API.md`.

---

## 1. Requisitos

| Pieza | Versión | Notas |
|---|---|---|
| CloudPanel | 2.x | nginx + PHP-FPM |
| PHP | 8.2 o superior | extensiones `pdo_mysql`, `mbstring`, `curl`, `openssl`, `phar`, `zip` |
| Composer | 2.x | dependencias PHP (lector MaxMind) |
| MariaDB / MySQL | 10.3+ / 5.7+ | producción probada en MariaDB 10.11 |
| Node.js | 20 LTS o superior | solo para compilar los frontends |
| Cuenta MaxMind | gratuita | licencia GeoLite2 para el espejo local de geolocalización (recomendado) |
| Java | 17 o superior | solo para compilar el plugin y los módulos |

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

composer install --no-dev --optimize-autoloader
(cd admin  && npm ci && npm run build)
(cd public && npm ci && npm run build)
```

> `npm ci` usa el `package-lock.json` exacto; no uses `npm install` en el servidor.

**Alternativa (subir desde tu equipo con rsync):** compila en local y sube solo lo necesario.

```bash
composer install --no-dev --optimize-autoloader
(cd admin && npm ci && npm run build) && (cd public && npm ci && npm run build)

rsync -avz --delete \
  --exclude='.git*' --exclude='.env' --exclude='.claude' --exclude='.idea' \
  --exclude='node_modules' --exclude='admin/src' --exclude='public/src' \
  --exclude='shared' --exclude='libs' --exclude='modulos' --exclude='FurrGuard-plugin' \
  --exclude='docs' --exclude='tests' --exclude='*.md' \
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

Variables mínimas (todas documentadas en `.env.example` y en `docs/API.md` §8):

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

`storage/` debe ser escribible por el usuario de PHP (sesiones, límites de peticiones y bases GeoIP):

```bash
chown -R furrguard:furrguard storage
chmod -R u+rwX,go-rwx storage
```

---

## 5. Base de datos: migraciones

Instalación nueva y actualización usan **el mismo comando** (es idempotente):

```bash
php bin/migrate.php            # aplica las migraciones pendientes
php bin/migrate.php --status   # lista aplicadas y pendientes
```

> **Antes de migrar una instalación existente, haz copia de la base de datos**
> (CloudPanel → Databases → Export, o `mysqldump`). La migración normaliza UUID e IP de
> whitelist/blacklist, convierte la API key a hash y elimina columnas y tablas obsoletas.

Ya no existe `install.sql` ni los `.sql` de los módulos: todo está en `database/migrations/`.

---

## 6. Geolocalización: espejo MaxMind

FurrGuard consulta ip-api.com (proxy, hosting, red móvil, ISP) y además una copia local de
**GeoLite2-Country** y **GeoLite2-ASN**. Si ip-api cae o agota su cuota, los bloqueos por país,
continente, ASN y proveedor siguen funcionando.

1. Crea una cuenta gratuita en <https://www.maxmind.com/en/geolite2/signup> y genera una license key.
2. Pon `MAXMIND_ACCOUNT_ID` y `MAXMIND_LICENSE_KEY` en `.env`.
3. Descarga las bases: `php bin/geoip-update.php`.

Sin estas bases FurrGuard funciona igual, pero sin el espejo (el panel lo indica en el resumen).

---

## 7. nginx (CloudPanel → Sites → tu sitio → Vhost)

Sustituye el contenido por el siguiente. Los `{{…}}` son variables de CloudPanel: no los toques.
Solo son ejecutables los 7 puntos de entrada PHP; todo lo demás (código, configuración, datos) se
bloquea.

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
  location ~ ^/(config|includes|database|bin|storage|vendor|libs|modulos|FurrGuard-plugin|docs|tests|shared)(/|$) { deny all; return 404; }
  location ~ ^/(admin|public)/(src|node_modules)(/|$) { deny all; return 404; }
  location ~ \.(sql|tsv|md|json|lock|ya?ml|neon|xml|dist|log|env|bak|old|tmp|sh|bat|gradle|properties|java|ts|vue|mmdb|tsbuildinfo)$ { deny all; return 404; }

  # ── Assets compilados por Vite ─────────────────────────────────────────
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

---

## 8. SSL y Discord

- CloudPanel → **SSL/TLS → Let's Encrypt** y activa **Force HTTPS**.
- Discord Developer Portal → tu aplicación → **OAuth2 → Redirects**, añade:
  - `https://furrguard.srteb.eu/admin/callback.php` (panel)
  - `https://furrguard.srteb.eu/verify.php` (verificación de staff)

---

## 9. Tareas programadas (cron)

CloudPanel → **Cron Jobs** (usuario del sitio):

```cron
# Limpieza de cachés, sesiones, tokens y retención configurada: cada hora
17 * * * * php /home/furrguard/htdocs/furrguard.srteb.eu/bin/cleanup.php > /dev/null 2>&1
# Bases GeoLite2 (MaxMind publica actualizaciones dos veces por semana)
43 4 * * 2,5 php /home/furrguard/htdocs/furrguard.srteb.eu/bin/geoip-update.php > /dev/null 2>&1
```

---

## 10. Primer arranque

1. Abre `https://furrguard.srteb.eu/admin/` e inicia sesión con Discord con la cuenta de `FOUNDER_DISCORD_ID`.
2. **Ajustes → API key → Generar.** Copia la clave: solo se muestra una vez. Mientras no exista,
   la API de plugins responde `503 api_key_not_configured`.
3. Configura el plugin y los módulos con esa clave (§11).
4. Revisa en **Resumen** el estado de la API key, ip-api y el espejo MaxMind.

---

## 11. Plugin Velocity y módulos

Se compilan desde el monorepo (necesitas Java 17+):

```bash
cd FurrGuard-plugin && ./gradlew build          # → build/libs/FurrGuard-<versión>.jar
cd modulos/furrperms-module && ./gradlew build     # → build/libs/furrperms-module-<versión>.jar
cd modulos/furrsecurity-module && ./gradlew build  # → build/libs/FurrSecurity-<versión>.jar
```

- **FurrGuard** y **FurrPerms** van en `plugins/` de Velocity.
- **FurrSecurity** es un único jar para Velocity y Paper: ponlo en el proxy y en cada backend.

`config.yml` de cada uno:

```yaml
api:
  url: "https://furrguard.srteb.eu/api/plugin.php"      # FurrSecurity: /api/furrsecurity.php
  key: "fg_…"                                          # la clave generada en el panel
```

> Todos fallan en cerrado si la API no responde (FurrGuard lo permite configurar). Tras un cambio
> de clave, `/fg reload` en el proxy.

---

## 12. Comprobaciones

```bash
# API sin clave → 401; con clave → JSON
curl -s -o /dev/null -w '%{http_code}\n' -X POST 'https://furrguard.srteb.eu/api/plugin.php?action=get_settings'
curl -s -X POST -H 'X-API-Key: fg_…' 'https://furrguard.srteb.eu/api/plugin.php?action=get_settings'

# Nada interno es accesible → 404
for p in .env config.php includes/security.php database/migrations storage/ docs/API.md \
         composer.json admin/package.json FurrGuard-plugin/build.gradle; do
  printf '%-34s ' "$p"; curl -s -o /dev/null -w '%{http_code}\n' "https://furrguard.srteb.eu/$p"
done
```

- `https://furrguard.srteb.eu/` → landing.
- `https://furrguard.srteb.eu/verify.php` sin token → error "Token no proporcionado".
- Cabecera `Content-Security-Policy` con `nonce-…` en `/admin/`.

---

## 13. Actualizar

```bash
cd /home/furrguard/htdocs/furrguard.srteb.eu
# 1) copia de seguridad de la base de datos
git pull
composer install --no-dev --optimize-autoloader
(cd admin && npm ci && npm run build) && (cd public && npm ci && npm run build)
php bin/migrate.php
```

Si PHP-FPM tiene OPcache con `validate_timestamps=0`, reinícialo desde CloudPanel.

---

## 14. Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| El plugin expulsa con "Error de verificación" | API caída, clave incorrecta o sin clave: revisa `/fg status` y el Resumen del panel |
| `503 api_key_not_configured` | Genera la API key en Ajustes |
| Panel en blanco / 404 en `/admin/assets/` | Falta `npm run build` en `admin/` o el alias de nginx |
| "Token CSRF inválido" en el panel | La pestaña lleva abierta desde antes del último login: recarga |
| Resumen: espejo MaxMind "missing" | Faltan las `.mmdb`: `php bin/geoip-update.php` y revisa `MAXMIND_*` |
| Resumen: ip-api "limited" | Cuota gratuita agotada: el espejo MaxMind cubre país, continente y ASN |
| Discord OAuth no vuelve | `DISCORD_REDIRECT_URI` y los redirects del portal deben coincidir exactamente |
