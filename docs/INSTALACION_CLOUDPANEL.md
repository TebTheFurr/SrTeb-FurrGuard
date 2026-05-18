# FurrGuard - Guia de Instalacion en CloudPanel

> Guia completa para desplegar FurrGuard en un servidor gestionado con CloudPanel.

---

## Requisitos Previos

| Requisito | Version | Notas |
|-----------|---------|-------|
| CloudPanel | 2.x+ | Panel de gestion del servidor |
| PHP | 8.1+ | Extensiones: pdo_mysql, json, mbstring, openssl, curl |
| MySQL / MariaDB | 5.7+ / 10.3+ | Base de datos |
| Node.js | 18+ | Solo para compilar el frontend Vue |
| npm | 9+ | Viene con Node.js |
| Compositor | Servidor VPS | CloudPanel solo funciona en VPS dedicados |

---

## 1. Crear Site en CloudPanel

1. Accede a **CloudPanel** (`https://tu-servidor:8443`)
2. Ve a **Sites** > **Add Site** > **Create a Custom Site**
3. Configura:
   - **Domain:** `furrguard.srteb.eu` (o tu dominio)
   - **Document Root:** dejalo por defecto (`/home/furrguard/htdocs/furrguard.srteb.eu/public`)
   - **PHP Version:** 8.2 (o la mas reciente disponible)
4. CloudPanel creara el usuario y la estructura de directorios.

> **Nota sobre el document root:** CloudPanel crea por defecto un directorio `public/` como document root del site. FurrGuard tambien tiene un directorio `public/` (el frontend Vue de la landing page + verify). **No confundas ambos** — en el paso 7 sobreescribimos el `root` de Nginx para apuntar a `/home/furrguard/htdocs/furrguard.srteb.eu/` (la raiz del proyecto), no al `public/` de CloudPanel. El `public/` del proyecto contiene el frontend compilado que se sirve via alias en Nginx. Los archivos sensibles (`.env`, `config/`, `includes/`) quedan protegidos con reglas de ubicacion en el vhost.

---

## 2. Crear Base de Datos

1. En CloudPanel, ve a **Databases** > **Add Database**
2. Configura:
   - **Name:** `furrguard`
   - **Username:** `furrguard_user`
   - **Password:** Genera una contraseña segura (guardala para el `.env`)
3. Anota las credenciales, las necesitaras en el paso 5.

---

## 3. Subir Archivos al Servidor

### Opcion A: Desde tu maquina local con rsync

```bash
# Construir los frontends ANTES de subir
cd admin && npm install && npm run build && cd ..
cd public && npm install && npm run build && cd ..

# Subir al directorio del site (NO a /public/)
# El vhost de Nginx apunta root a /home/furrguard/htdocs/furrguard.srteb.eu/
rsync -avz --delete \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='node_modules' \
  --exclude='admin/node_modules' \
  --exclude='admin/src' \
  --exclude='public/node_modules' \
  --exclude='public/src' \
  --exclude='.idea' \
  --exclude='.claude' \
  --exclude='docs' \
  ./ furrguard@tu-servidor:/home/furrguard/htdocs/furrguard.srteb.eu/
```

### Opcion B: Git clone en el servidor

```bash
# SSH al servidor
ssh furrguard@tu-servidor

cd /home/furrguard/srteb.eu

# Clonar el repositorio
git clone https://github.com/tu-usuario/FurrGuard.git .

# Compilar los frontends en el servidor (necesitas Node.js - ver paso 4)
cd admin && npm install && npm run build && cd ..
cd public && npm install && npm run build && cd ..
```

---

## 4. Instalar Node.js (si compilas en el servidor)

Solo necesario si compilas el frontend directamente en el servidor.

```bash
# SSH al servidor
ssh furrguard@tu-servidor

# Instalar Node.js 20 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar
node --version   # v20.x
npm --version    # 10.x

# Compilar frontends
cd /home/furrguard/htdocs/furrguard.srteb.eu/admin
npm install
npm run build

cd /home/furrguard/htdocs/furrguard.srteb.eu/public
npm install
npm run build
```

El resultado estara en `admin/dist/` y `public/dist/` (archivos JS/CSS optimizados).

---

## 5. Configurar Variables de Entorno

Crea el archivo `.env` en la raiz del proyecto:

```bash
nano /home/furrguard/htdocs/furrguard.srteb.eu/.env
```

Contenido (ajusta los valores):

```env
# Discord OAuth2
DISCORD_CLIENT_ID=tu_client_id
DISCORD_CLIENT_SECRET=tu_client_secret
DISCORD_REDIRECT_URI=https://furrguard.srteb.eu/admin/callback.php
FOUNDER_DISCORD_ID=tu_discord_id

# Base de datos
DB_HOST=localhost
DB_NAME=furrguard
DB_USERNAME=furrguard_user
DB_PASSWORD=tu_password_seguro

# Seguridad
CORS_ALLOWED_ORIGIN=https://furrguard.srteb.eu
TRUSTED_PROXIES=
```

**Proteger el archivo `.env`:**

```bash
chmod 600 /home/furrguard/htdocs/furrguard.srteb.eu/.env
chown furrguard:furrguard /home/furrguard/htdocs/furrguard.srteb.eu/.env
```

---

## 6. Importar Base de Datos

```bash
# SSH al servidor
mysql -u furrguard_user -p furrguard < /home/furrguard/htdocs/furrguard.srteb.eu/install.sql
```

O desde CloudPanel: **Databases** > Click en la BD > **Import** > sube `install.sql`.

---

## 7. Configurar Nginx (CloudPanel)

CloudPanel usa Nginx con un formato de vhost especifico. Los placeholders entre `{{corchetes}}` son variables internas de CloudPanel que se rellenan automaticamente — **no los modifiques**.

1. En CloudPanel, ve a **Sites** > tu sitio > **Nginx Configuration**
2. Reemplaza **todo** el contenido con:

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
  # FurrGuard: sobreescribimos {{root}} porque el proyecto no usa subdirectorio public/
  root /home/furrguard/htdocs/furrguard.srteb.eu;
  index index.php index.html;

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

  # Security headers
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-XSS-Protection "1; mode=block" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;

  # Gzip compression
  gzip on;
  gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
  gzip_min_length 256;
  gzip_vary on;

  # ============================================================
  # FurrGuard — Security: bloquear archivos y directorios sensibles
  # ============================================================

  # Bloquear dotfiles (.env, .git, .htaccess, .idea)
  location ~ /\.(env|git|htaccess|idea) {
    deny all;
    return 404;
  }

  # Bloquear extensiones sensibles
  location ~ \.(sql|log|bak|old|tmp)$ {
    deny all;
    return 404;
  }

  # Bloquear acceso directo a config/ e includes/
  location ~ ^/(config|includes)/ {
    deny all;
    return 404;
  }

  # Bloquear config.php e install.sql directamente
  location ~ ^/(config\.php|install\.sql)$ {
    deny all;
    return 404;
  }

  # Bloquear directorios de desarrollo del admin
  location ~ ^/admin/(node_modules|src)/ {
    deny all;
    return 404;
  }

  # Bloquear directorios de desarrollo del public frontend
  location ~ ^/public/(node_modules|src)/ {
    deny all;
    return 404;
  }

  # ============================================================
  # FurrGuard — Frontend assets compilados por Vite (cache largo)
  # El HTML compilado referencia /{admin,public}/assets/... pero
  # los archivos estan en {admin,public}/dist/assets/. Usamos alias.
  # ============================================================

  # ^~ evita que el regex de static assets capture estos ficheros antes
  location ^~ /admin/assets/ {
    alias /home/furrguard/htdocs/furrguard.srteb.eu/admin/dist/assets/;
    expires 1y;
    add_header Cache-Control "public, immutable";
    add_header Access-Control-Allow-Origin "*";
    access_log off;
  }

  # Landing page + verify page assets compilados por Vite
  location ^~ /public/assets/ {
    alias /home/furrguard/htdocs/furrguard.srteb.eu/public/dist/assets/;
    expires 1y;
    add_header Cache-Control "public, immutable";
    add_header Access-Control-Allow-Origin "*";
    access_log off;
  }

  # ============================================================
  # FurrGuard — Admin panel (Vue SPA)
  # ============================================================

  # Archivos PHP del admin → PHP-FPM directo
  location ~ ^/admin/(api|callback)\.php$ {
    include fastcgi_params;
    fastcgi_intercept_errors on;
    fastcgi_index index.php;
    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    try_files $uri =404;
    fastcgi_read_timeout 60;
    fastcgi_pass 127.0.0.1:{{php_fpm_port}};
    fastcgi_param PHP_VALUE "{{php_settings}}";
  }

  # Admin SPA catch-all → index.php (Vue Router hash mode)
  location /admin/ {
    try_files $uri $uri/ /admin/index.php?$query_string;
  }

  # ============================================================
  # FurrGuard — Pagina principal (Vue SPA via index.php) + API del plugin
  # ============================================================

  # Landing page + verify page → index.php / verify.php
  location / {
    try_files $uri $uri/ /index.php?$query_string;
  }

  # ============================================================
  # FurrGuard — PHP general via FastCGI
  # ============================================================

  location ~ \.php$ {
    include fastcgi_params;
    fastcgi_intercept_errors on;
    fastcgi_index index.php;
    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    try_files $uri =404;
    fastcgi_read_timeout 60;
    fastcgi_send_timeout 60;
    fastcgi_pass 127.0.0.1:{{php_fpm_port}};
    fastcgi_param PHP_VALUE "{{php_settings}}";
  }

  # ============================================================
  # FurrGuard — Static assets
  # ============================================================

  location ~* ^.+\.(css|js|jpg|jpeg|gif|png|ico|gz|svg|svgz|ttf|otf|woff|woff2|eot|mp4|ogg|ogv|webm|webp|zip|swf|map|mjs)$ {
    add_header Access-Control-Allow-Origin "*";
    expires max;
    access_log off;
    try_files $uri =404;
  }

  location ~ /\.(ht|svn|git) {
    deny all;
  }

  if (-f $request_filename) {
    break;
  }
}

# ==============================================================
# Backend port 8080 (usado internamente por CloudPanel)
# ==============================================================

server {
  listen 8080;
  listen [::]:8080;
  server_name furrguard.srteb.eu;
  root /home/furrguard/htdocs/furrguard.srteb.eu;

  include /etc/nginx/global_settings;

  index index.php index.html;

  # Security: bloquear archivos sensibles
  location ~ /\.(env|git|htaccess|idea) {
    deny all;
    return 404;
  }

  location ~ \.(sql|log|bak|old|tmp)$ {
    deny all;
    return 404;
  }

  location ~ ^/(config|includes)/ {
    deny all;
    return 404;
  }

  location ~ ^/admin/(node_modules|src)/ {
    deny all;
    return 404;
  }

  location ~ ^/public/(node_modules|src)/ {
    deny all;
    return 404;
  }

  # Vite assets (cache largo)
  # ^~ evita que el regex de static assets capture estos ficheros antes
  location ^~ /admin/assets/ {
    alias /home/furrguard/htdocs/furrguard.srteb.eu/admin/dist/assets/;
    expires 1y;
    access_log off;
  }

  # Landing page + verify page assets
  location ^~ /public/assets/ {
    alias /home/furrguard/htdocs/furrguard.srteb.eu/public/dist/assets/;
    expires 1y;
    access_log off;
  }

  # Admin SPA
  location /admin/ {
    try_files $uri $uri/ /admin/index.php?$args;
  }

  # General routing
  location / {
    try_files $uri $uri/ /index.php?$args;
  }

  # PHP via FastCGI
  location ~ \.php$ {
    include fastcgi_params;
    fastcgi_intercept_errors on;
    fastcgi_index index.php;
    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    try_files $uri =404;
    fastcgi_read_timeout 3600;
    fastcgi_send_timeout 3600;
    fastcgi_param HTTPS "on";
    fastcgi_param SERVER_PORT 443;
    fastcgi_pass 127.0.0.1:{{php_fpm_port}};
    fastcgi_param PHP_VALUE "{{php_settings}}";
  }

  location ~ /\.(ht|svn|git) {
    deny all;
  }

  if (-f $request_filename) {
    break;
  }
}
```

3. Click **Save**. CloudPanel validara y recargara Nginx automaticamente.

---

## 8. Configurar SSL (Let's Encrypt)

CloudPanel lo gestiona automaticamente:

1. Ve a **Sites** > tu sitio > **SSL/TLS**
2. Click **Add Certificate** > **Let's Encrypt**
3. Activa **Force HTTPS**
4. CloudPanel renovara los certificados automaticamente.

---

## 9. Configurar Discord OAuth2

1. Ve a [Discord Developer Portal](https://discord.com/developers/applications)
2. Selecciona tu aplicacion (o crea una nueva)
3. En **OAuth2** > **General**:
   - **Redirects:** Anade estas dos URLs:
     - `https://furrguard.srteb.eu/admin/callback.php` (panel admin)
     - `https://furrguard.srteb.eu/verify.php` (verificacion de jugadores)
4. Copia el **Client ID** y **Client Secret** al `.env`

---

## 10. Verificar Permisos de Archivos

```bash
# SSH al servidor
ssh furrguard@tu-servidor

cd /home/furrguard/htdocs/furrguard.srteb.eu

# Propietario correcto
chown -R furrguard:furrguard .

# Permisos generales
find . -type d -exec chmod 755 {} \;
find . -type f -exec chmod 644 {} \;

# .env solo legible por el propietario
chmod 600 .env

# Directorio temporal para rate limiting (debe ser escribible)
mkdir -p /tmp/furrguard_ratelimit
chmod 700 /tmp/furrguard_ratelimit
chown furrguard:furrguard /tmp/furrguard_ratelimit
```

---

## 11. Probar la Instalacion

### Verificar PHP

```bash
curl -I https://furrguard.srteb.eu/admin/api.php
# Debe devolver HTTP 200 o 401 (no 500)
```

### Verificar Frontend

1. Abre `https://furrguard.srteb.eu/admin/` en el navegador
2. Debe mostrar la pagina de login con Discord
3. Click "Iniciar sesion con Discord" y verifica que redirige correctamente

### Verificar Landing Page

1. Abre `https://furrguard.srteb.eu/` en el navegador
2. Debe mostrar la landing page de FurrGuard con animaciones y secciones
3. Verifica que el menu movil funciona (en viewport < 768px)
4. Verifica que los enlaces de navegacion hacen scroll suave

### Verificar Pagina de Verificacion

1. Abre `https://furrguard.srteb.eu/verify.php` sin token
2. Debe mostrar una tarjeta de error: "Token no proporcionado"
3. Abre `https://furrguard.srteb.eu/verify.php?token=invalido` con token invalido
4. Debe mostrar: "Token invalido"

### Verificar API del Plugin (Minecraft)

```bash
# Desde tu maquina o el servidor
curl -X POST https://furrguard.srteb.eu/api/plugin.php \
  -H "Content-Type: application/json" \
  -H "X-API-Key: TU_API_KEY" \
  -d '{"action":"get_settings"}'
# Debe devolver JSON con success:true
```

### Verificar Base de Datos

```bash
mysql -u furrguard_user -p -e "SHOW TABLES;" furrguard
# Debe mostrar: players, player_nicks, player_ips, whitelist, blacklist, settings, etc.
```

---

## 12. Configurar el Plugin de Minecraft

En tu servidor Velocity:

1. Compila el plugin: `cd FurrGuard-plugin && ./gradlew shadowJar`
2. Copia `build/libs/FurrGuard-1.0.0.jar` a la carpeta `plugins/` de Velocity
3. Inicia el servidor para generar `plugins/FurrGuard/config.yml`
4. Edita la config:

```yaml
api:
  url: "https://furrguard.srteb.eu/api/plugin.php"
  key: "TU_API_KEY"  # La misma que generaste en la base de datos
```

5. Reinicia Velocity.

---

## Estructura de Archivos en Produccion

```
/home/furrguard/htdocs/furrguard.srteb.eu/
├── .env                          # Variables de entorno (chmod 600)
├── .gitignore
├── .htaccess                     # (No funciona en Nginx, ignorar)
├── CLAUDE.md
├── config.php                    # Config principal
├── index.php                     # Pagina principal
├── install.sql                   # Schema SQL
├── verify.php                    # Script de verificacion
│
├── config/
│   ├── database.php              # Conexion BD (singleton PDO)
│   └── env.php                   # Cargador de .env
│
├── includes/
│   ├── functions.php             # Helpers compartidos
│   └── security.php              # Seguridad, rate limit, CSP
│
├── api/
│   └── plugin.php                # API para el plugin Minecraft
│
├── admin/
│   ├── .gitignore
│   ├── .htaccess                 # (No funciona en Nginx, ignorar)
│   ├── index.php                 # Entrada del panel admin (Vue SPA)
│   ├── index.html                # Entrada para Vite build
│   ├── api.php                   # API del panel admin
│   ├── callback.php              # Callback Discord OAuth2
│   ├── package.json              # Dependencias Node.js
│   ├── vite.config.ts            # Config de Vite (base: '/admin/')
│   ├── dist/                     # Frontend compilado (npm run build)
│   │   ├── assets/
│   │   │   ├── index-[hash].js
│   │   │   ├── index-[hash].css
│   │   │   └── vendor chunks...
│   │   └── index.html
│   └── src/                      # Codigo fuente Vue (no necesario en prod)
│
├── public/
│   ├── .gitignore
│   ├── index.html                # Entrada para Vite build
│   ├── package.json              # Dependencias Node.js
│   ├── vite.config.ts            # Config de Vite (base: '/public/')
│   ├── dist/                     # Frontend compilado (npm run build)
│   │   ├── assets/
│   │   │   ├── index-[hash].js   # Router + app
│   │   │   ├── index-[hash].css  # Tailwind v4
│   │   │   ├── vue-[hash].js     # Vue + Vue Router
│   │   │   ├── gsap-[hash].js    # GSAP animations
│   │   │   ├── icons-[hash].js   # Lucide icons
│   │   │   ├── LandingView-[hash].js
│   │   │   └── VerifyView-[hash].js
│   │   └── index.html
│   └── src/                      # Codigo fuente Vue (no necesario en prod)
│       ├── main.ts               # Bootstrap (createApp + router)
│       ├── App.vue               # GSAP route transitions
│       ├── style.css             # Tailwind v4 @theme
│       ├── router/index.ts       # Hash routes: / → Landing, /verify → Verify
│       ├── views/
│       │   ├── LandingView.vue   # Landing page orchestrator
│       │   └── VerifyView.vue    # Verify page state router
│       ├── components/
│       │   ├── landing/          # Header, Hero, Features, Architecture, Protection, CTA, Footer
│       │   └── verify/           # VerifyCard, VerifyError, VerifySuccess
│       └── composables/          # useScrollEffects, useCardEffects
│
├── FurrGuard-plugin/             # Codigo fuente del plugin (no necesario en prod)
│   ├── build.gradle
│   └── src/
│
└── modulos/                      # Modulos adicionales del plugin
    └── furrperms-module/
```

---

## Comandos Utiles

```bash
# Recompilar frontend admin tras cambios
cd /home/furrguard/htdocs/furrguard.srteb.eu/admin
npm install && npm run build

# Recompilar frontend public (landing + verify) tras cambios
cd /home/furrguard/htdocs/furrguard.srteb.eu/public
npm install && npm run build

# Reiniciar Nginx
sudo systemctl restart nginx

# Ver logs de Nginx
tail -f /var/log/nginx/furrguard.srteb.eu.error.log
tail -f /var/log/nginx/furrguard.srteb.eu.access.log

# Ver logs de PHP
tail -f /var/log/php8.2-fpm/error.log

# Verificar estado de servicios
sudo systemctl status nginx
sudo systemctl status php8.2-fpm

# Limpiar archivos de rate limit expirados
php /home/furrguard/htdocs/furrguard.srteb.eu/verify.php
```

---

## Solucion de Problemas

### Error 502 Bad Gateway

- PHP-FPM no esta corriendo: `sudo systemctl start php8.2-fpm`
- Socket incorrecto en Nginx: verifica `/etc/nginx/conf.d/upstreams.conf`

### La pagina de admin muestra pantalla en blanco

- Verifica que `admin/dist/` existe y contiene los assets compilados
- Ejecuta `cd admin && npm run build`
- Revisa los logs de Nginx para errores 404 en `/admin/dist/`

### La landing page muestra pantalla en blanco

- Verifica que `public/dist/` existe y contiene los assets compilados
- Ejecuta `cd public && npm run build`
- Revisa los logs de Nginx para errores 404 en `/public/dist/`
- Verifica que `index.php` puede leer `public/dist/index.html` (permisos)

### Error de conexion a base de datos

- Verifica las credenciales en `.env`
- Confirma que MySQL esta corriendo: `sudo systemctl status mysql`
- Prueba la conexion: `mysql -u furrguard_user -p -h localhost furrguard`

### Discord OAuth2 no redirige

- Verifica `DISCORD_REDIRECT_URI` en `.env` coincida con la URL configurada en Discord Developer Portal
- Debe ser exactamente: `https://furrguard.srteb.eu/admin/callback.php`

### CSP bloquea el frontend

- En produccion, la CSP es estricta (nonce-based)
- Si ves errores en consola del navegador tipo "refused to load", verifica que Nginx esta sirviendo correctamente los assets
- Los scripts inline en `index.php` (admin y landing) usan nonce CSP que se genera dinamicamente
- Verifica que Nginx sirve los assets desde `/admin/dist/` y `/public/dist/`

### Assets 404 en produccion

- **Admin:** Verifica que Vite compilo con `base: '/admin/'`, assets en `admin/dist/assets/`
- **Public:** Verifica que Vite compilo con `base: '/public/'`, assets en `public/dist/assets/`
- Revisa la configuracion Nginx: las secciones `location ^~ /admin/assets/` y `location ^~ /public/assets/` deben estar antes que el catch-all

---

## Actualizaciones

```bash
# SSH al servidor
cd /home/furrguard/htdocs/furrguard.srteb.eu

# Obtener ultimos cambios
git pull origin master

# Recompilar frontends (si hubo cambios en src/)
cd admin && npm install && npm run build && cd ..
cd public && npm install && npm run build && cd ..

# Si hubo cambios en la base de datos, aplicar migraciones
# mysql -u furrguard_user -p furrguard < migrations/nueva_migracion.sql
```

---

## Seguridad Adicional (Recomendado)

1. **Firewall:** Solo abre puertos 80, 443 y el del servidor Minecraft
2. **Fail2Ban:** CloudPanel lo instala por defecto
3. **Backups automaticos:** Configura en CloudPanel > **Backups**
4. **Monitoreo:** Revisa los logs periodicamente
5. **Actualizar API Key:** Genera una nueva clave desde el panel admin y actualiza el plugin
