# FurrGuard - Migracion: Landing + Verify a Vue 3

> **Estado inicial:** Tienes FurrGuard desplegado con el panel admin (`/admin/`) ya en Vue 3, pero la landing page (`/`) usa HTML/CSS/JS vanilla y `verify.php` renderiza HTML inline.
>
> **Estado final:** Tanto la landing page como `verify.php` usan Vue 3, servidos desde `public/dist/`. El admin no se toca.

---

## Que cambia

| Antes | Despues |
|-------|---------|
| Landing page: `index.php` con HTML inline + `assets/css/style.css` + `assets/js/script.js` | Landing page: `index.php` sirve Vue SPA desde `public/dist/` |
| Verify page: `verify.php` renderiza HTML inline | Verify page: `verify.php` inyecta datos en el mismo Vue SPA |
| 1 frontend Vue (`admin/`) | 2 frontends Vue (`admin/` + `public/`) |
| Nginx solo sirve `/admin/assets/` | Nginx sirve `/admin/assets/` y `/public/assets/` |

---

## Pasos de Migracion

### 1. Obtener los cambios

```bash
cd /home/furrguard/htdocs/furrguard.srteb.eu
git pull origin master
```

### 2. Compilar el nuevo frontend public

```bash
cd /home/furrguard/htdocs/furrguard.srteb.eu/public
npm install
npm run build
```

Si no tienes Node.js en el servidor, instalalo primero:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verifica que el build genero los archivos:

```bash
ls -la /home/furrguard/htdocs/furrguard.srteb.eu/public/dist/assets/
# Debe mostrar: index-*.js, index-*.css, vue-*.js, gsap-*.js, icons-*.js, LandingView-*.js, VerifyView-*.js
```

### 3. Eliminar assets antiguos

Los archivos CSS y JS de la landing page original ya no se usan. Se pueden borrar:

```bash
rm -rf /home/furrguard/htdocs/furrguard.srteb.eu/assets/css/style.css
rm -rf /home/furrguard/htdocs/furrguard.srteb.eu/assets/js/script.js
```

> Si `assets/` quedo vacio, puedes borrar el directorio completo: `rm -rf assets/`

### 4. Actualizar configuracion Nginx

Edita la configuracion del site en CloudPanel (**Sites** > tu sitio > **Nginx Configuration**).

Reemplaza **todo** el contenido con la configuracion actualizada:

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

Click **Save**. CloudPanel validara y recargara Nginx automaticamente.

### 5. Actualizar Discord OAuth2

Ve a [Discord Developer Portal](https://discord.com/developers/applications) > tu aplicacion > **OAuth2** > **General**.

En **Redirects**, anade esta URL (si no la tenias):

```
https://furrguard.srteb.eu/verify.php
```

Esto es necesario para que el flujo de verificacion de jugadores funcione con Discord.

### 6. Verificar permisos

```bash
cd /home/furrguard/htdocs/furrguard.srteb.eu
chown -R furrguard:furrguard public/dist/
find public/dist -type f -exec chmod 644 {} \;
find public/dist -type d -exec chmod 755 {} \;
```

### 7. Probar

```bash
# Probar landing page (debe devolver HTML, no error 500)
curl -s https://furrguard.srteb.eu/ | head -5

# Probar que los assets se sirven (debe devolver 200)
curl -I https://furrguard.srteb.eu/public/assets/index-DeJCrvnM.css
```

Verificacion en navegador:

1. Abre `https://furrguard.srteb.eu/` — debe mostrar la landing page con animaciones
2. Abre `https://furrguard.srteb.eu/verify.php` — debe mostrar tarjeta de error "Token no proporcionado"
3. Abre `https://furrguard.srteb.eu/admin/` — debe seguir funcionando igual que antes
4. Abre DevTools > Network — verifica que los assets de `/public/assets/` cargan con status 200

---

## Rollback (si algo falla)

Si la nueva landing page no funciona correctamente y necesitas volver a la version anterior:

```bash
cd /home/furrguard/htdocs/furrguard.srteb.eu

# Volver al commit anterior a la migracion
git log --oneline -5  # identifica el commit anterior
git checkout <commit-hash> -- index.php verify.php assets/

# Revertir cambios de Nginx en CloudPanel:
# Elimina las ubicaciones /public/assets/ y public/(node_modules|src)/ anadidas
```

---

## Checklist de Migracion

- [ ] `git pull origin master` completado
- [ ] `cd public && npm install && npm run build` completado
- [ ] `public/dist/assets/` contiene los archivos JS/CSS compilados
- [ ] Assets antiguos eliminados (`assets/css/style.css`, `assets/js/script.js`)
- [ ] Nginx actualizado con `location ^~ /public/assets/` (server blocks 443 y 8080)
- [ ] Nginx actualizado con bloqueo `public/(node_modules|src)/` (server blocks 443 y 8080)
- [ ] Nginx recargado sin errores
- [ ] Discord OAuth2: redirect `verify.php` anadido
- [ ] Permisos correctos en `public/dist/`
- [ ] Landing page carga correctamente en navegador
- [ ] Verify page muestra error sin token
- [ ] Admin panel sigue funcionando
- [ ] Assets cargan sin errores 404 en DevTools
