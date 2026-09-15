# FurrGuard 2.0 — Instalación nueva en Ubuntu/Debian

Guía paso a paso para montar FurrGuard (panel, landing, verificación de staff y APIs) en un
servidor **nuevo** con Ubuntu 24.04 LTS o Debian 12, sin panel de control: nginx, PHP-FPM y
MariaDB de los repositorios, un usuario de servicio propio y timers de systemd. Después pone en
marcha el plugin FurrGuard y los módulos FurrPerms y FurrSecurity en Velocity y Paper.

- Servidor con CloudPanel: [`INSTALACION_CLOUDPANEL.md`](INSTALACION_CLOUDPANEL.md).
- Actualizar una 1.x en producción: [`ACTUALIZACION_2.0.md`](ACTUALIZACION_2.0.md).
- Contrato entre la web, el plugin y los módulos: [`API.md`](API.md).

Los comandos del servidor web se ejecutan **como root** (`sudo -i` o `su -`) y en la misma sesión:
la variable `DOMINIO` se define antes de empezar y `PHP` en el paso 1, y las dos se usan hasta el
final. El dominio de los ejemplos es `furrguard.srteb.eu`: pon el tuyo. Cuenta con una hora para la
web y otra para los plugins.

## Cómo queda

- **Sin root.** PHP-FPM (con un pool propio) y las tareas programadas corren como `furrguard`, un
  usuario sin shell que lee el código pero no puede modificarlo.
- **Solo 7 archivos PHP ejecutables.** El código, la configuración, los datos y la propia carpeta
  `deploy/` responden 404.
- **Secretos fuera de la pantalla.** La contraseña de la base de datos, el secreto de Discord y la
  licencia de MaxMind se escriben en `.env` sin mostrarse ni pasar por la línea de órdenes, y
  `.env` solo lo leen root y el grupo `furrguard`.
- **MariaDB solo en local**, con un usuario limitado a su base y a los privilegios que usan las
  migraciones.
- **Timers de systemd en lugar de cron**, con sandbox: limpieza cada hora, bases GeoLite2 los
  martes y viernes y, si quieres, copia diaria de la base de datos.

| Qué | Dónde |
|---|---|
| Código | `/var/www/furrguard` (de root) |
| Configuración y secretos | `/var/www/furrguard/.env` (`root:furrguard`, 0640) |
| Datos de ejecución | `/var/www/furrguard/storage/` (de `furrguard`, 0700): sesiones, límites y bases GeoIP |
| Pool de PHP-FPM | `/etc/php/<versión>/fpm/pool.d/furrguard.conf` → `/run/php/furrguard.sock` |
| Sitio de nginx | `/etc/nginx/sites-available/furrguard` |
| Tareas programadas | `/etc/systemd/system/furrguard-*.service` y `furrguard-*.timer` |
| Copias de la base de datos | `/var/backups/furrguard/` |

Los archivos de sistema salen listos de `deploy/`, comentados línea a línea:

| Archivo | Paso |
|---|---|
| `deploy/furrguard-php-fpm.conf` | 2 |
| `deploy/furrguard-nginx.conf` | 9 |
| `deploy/furrguard-cleanup.service` · `.timer` | 10 |
| `deploy/furrguard-geoip.service` · `.timer` | 10 |
| `deploy/furrguard-backup.service` · `.timer` (opcional) | 10 |
| `deploy/plugins/*.example.yml` | 14 a 16 |

---

## Antes de empezar

### El servidor

- **Sistema:** Ubuntu 24.04 LTS o Debian 12 recién instalados, de 64 bits. Ubuntu 22.04 sirve con
  un paso extra (paso 1): trae PHP 8.1 y FurrGuard pide 8.2.
- **RAM:** 1 GB basta para servir. Si compilas el panel en el propio servidor (paso 4), 2 GB o
  swap: `vue-tsc` y Vite rondan 1 GB.
- **Disco:** 2 GB libres; las dependencias de compilación ocupan la mayor parte.
- **Entrada:** puertos **80** y **443** abiertos. El 80 hace falta para Let's Encrypt y para
  redirigir a https. MariaDB no se abre.
- **Salida:** https a Discord, MaxMind (que redirige las descargas a Cloudflare R2), GitHub,
  Packagist, npm y NodeSource, y **http (puerto 80) a `ip-api.com`**, que en su plan gratuito no
  admite https.
- **Dominio:** un registro A (y AAAA si el servidor tiene IPv6) apuntando al servidor. Con
  Cloudflare, déjalo en gris («DNS only») hasta tener el certificado (paso 9).

### Qué necesitas tener a mano

- Acceso root por SSH.
- Acceso al repositorio `grinchhorizon/SrTeb-FurrGuard`; si es privado, un token de solo lectura.
- Una cuenta de Discord para crear la aplicación (paso 5) y el **Discord ID del founder**: en
  Discord, **Ajustes de usuario → Avanzado → Modo desarrollador**; después, clic derecho sobre tu
  nombre → **Copiar ID de usuario** (17 a 20 dígitos).
- Una cuenta gratuita de MaxMind (paso 5).
- Para los plugins: un equipo o una CI con JDK 21 y JDK 17 (paso 12) y acceso a los archivos de
  Velocity y de cada Paper.

### Comprobaciones previas

```bash
sudo -i
export DOMINIO=furrguard.srteb.eu         # tu dominio: sin https:// ni barra final

. /etc/os-release && echo "$PRETTY_NAME"   # Ubuntu 24.04.x LTS · Debian GNU/Linux 12 (bookworm)
systemctl --version | head -n1            # systemd 255 (Ubuntu 24.04) · systemd 252 (Debian 12)
free -h                                   # Mem total ≥ 1 GiB
df -h /var                                # ≥ 2 GB libres
getent ahosts "$DOMINIO" | head -n1       # la IP pública de este servidor…
ip -brief address                         # …que aparece aquí (detrás de NAT, la del router)
ss -ltn | grep -E ':(80|443)\s'           # nada: ningún otro servidor web ocupa 80 ni 443
```

Versiones que quedarán instaladas:

| Pieza | Ubuntu 24.04 | Debian 12 | FurrGuard pide |
|---|---|---|---|
| PHP (FPM y CLI) | 8.3 | 8.2 | 8.2 o superior |
| MariaDB | 10.11 | 10.11 | 10.3 o superior |
| nginx | 1.24 | 1.22 | — |
| Composer | 2.7 | 2.5 | 2.x |
| Node.js, solo para compilar | 22 LTS (NodeSource) | 22 LTS (NodeSource) | 20.19 o 22.12 en adelante |

---

## 1. Paquetes

```bash
apt update && apt full-upgrade -y
apt install -y nginx mariadb-server php-fpm php-cli php-mysql php-mbstring php-curl \
               composer certbot git unzip curl ca-certificates openssl
```

- `php-mysql` aporta `pdo_mysql`. `json`, `phar` y `zlib` vienen con PHP: `bin/geoip-update.php`
  los usa para abrir el `.tar.gz` de MaxMind. No hacen falta `php-xml` ni `php-zip`: Composer
  descomprime con `unzip`.
- **Ubuntu 22.04:** antes, `add-apt-repository ppa:ondrej/php && apt update`, y en la lista cambia
  `php-fpm php-cli php-mysql php-mbstring php-curl` por
  `php8.3-fpm php8.3-cli php8.3-mysql php8.3-mbstring php8.3-curl`.

Node.js solo si vas a compilar el panel en este servidor (Ubuntu 24.04 y Debian 12 traen Node 18,
demasiado antiguo para Vite):

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x -o /root/nodesource_setup.sh
bash /root/nodesource_setup.sh
apt install -y nodejs
```

Comprueba:

```bash
export PHP=$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')
echo "$PHP"                                                      # 8.3 (Ubuntu 24.04) · 8.2 (Debian 12)
php -m | grep -icE '^(curl|json|mbstring|pdo_mysql|phar|zlib)$'  # 6
systemctl is-active nginx mariadb "php$PHP-fpm"                  # active ×3
mariadb --version                                                # … 10.11.x-MariaDB …
composer --version                                               # Composer version 2.x
node -v                                                          # v22.x (si lo instalaste)
```

## 2. Usuario de servicio, código y pool de PHP-FPM

```bash
useradd --system --home /nonexistent --shell /usr/sbin/nologin furrguard
id furrguard        # uid=…(furrguard) gid=…(furrguard) groups=…(furrguard)
```

Sin carpeta personal ni shell: nadie entra como `furrguard`; solo lo usan PHP-FPM y los timers.

```bash
git clone --branch fix/auditoria https://github.com/grinchhorizon/SrTeb-FurrGuard.git /var/www/furrguard
git -C /var/www/furrguard log --oneline -1     # el último commit de la rama
ls /var/www/furrguard/deploy                   # los archivos de esta guía
```

- `fix/auditoria` es la rama de la 2.0 mientras no se fusione.
- Si el repositorio es privado, git pide usuario y contraseña: usa el token como contraseña. No lo
  metas en la URL: quedaría guardado en `.git/config`, legible para cualquier usuario del servidor.

Pool propio de PHP-FPM:

```bash
install -m 0644 /var/www/furrguard/deploy/furrguard-php-fpm.conf "/etc/php/$PHP/fpm/pool.d/furrguard.conf"
# El pool «www» del paquete no lo usa nadie: fuera, así solo quedan procesos de FurrGuard
mv "/etc/php/$PHP/fpm/pool.d/www.conf" "/etc/php/$PHP/fpm/pool.d/www.conf.disabled"

"php-fpm$PHP" -t                   # NOTICE: configuration file … test is successful
systemctl restart "php$PHP-fpm"
ls -l /run/php/furrguard.sock      # srw-rw---- 1 www-data www-data 0 … /run/php/furrguard.sock
```

El pool corre como `furrguard` y entrega el socket a `www-data`, el usuario de nginx: nginx habla
con PHP, pero no puede leer `.env` ni `storage/`. Además limita PHP a `/var/www/furrguard`
(`open_basedir`), nunca muestra errores en la página y corta una petición a los 60 s.

## 3. Base de datos

```bash
mariadb-secure-installation
```

Respuestas: contraseña actual de root → Intro (vacía: root entra por `unix_socket`) ·
*Switch to unix_socket authentication* → `n` (ya lo usa) · *Change the root password* → `n` ·
*Remove anonymous users* → `Y` · *Disallow root login remotely* → `Y` ·
*Remove test database* → `Y` · *Reload privilege tables* → `Y`.

La contraseña del usuario de FurrGuard se genera en un archivo solo de root. No sale por pantalla
ni en los argumentos de ningún proceso: el heredoc la mete por la entrada de `mariadb`.

```bash
( umask 077 && openssl rand -hex 24 > /root/furrguard-db.pass )

mariadb <<SQL
CREATE DATABASE furrguard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'furrguard'@'localhost' IDENTIFIED BY '$(cat /root/furrguard-db.pass)';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES
    ON furrguard.* TO 'furrguard'@'localhost';
SQL
```

- `'localhost'`: solo por el socket local; con este usuario no se puede entrar desde fuera.
- Son los privilegios que usan la aplicación y las migraciones: crean, cambian y borran tablas,
  índices y claves foráneas. Sin `TRIGGER`, `EVENT` ni rutinas.
- `/root/furrguard-db.pass` se usa en el paso 6 y allí se borra.

Comprueba:

```bash
MYSQL_PWD="$(cat /root/furrguard-db.pass)" mariadb -u furrguard furrguard -e 'SELECT CURRENT_USER();'
# furrguard@localhost
mariadb -e 'SELECT user, host FROM mysql.user; SHOW DATABASES;'
# usuarios: los del sistema (root, mysql, mariadb.sys) y furrguard, todos en localhost · ninguna base «test»
ss -ltnp | grep 3306       # 127.0.0.1:3306: MariaDB no escucha fuera del servidor
```

`MYSQL_PWD` pasa la contraseña por el entorno de `mariadb`, que solo pueden leer root y ese proceso.

## 4. Dependencias, compilación y permisos

```bash
cd /var/www/furrguard
COMPOSER_ALLOW_SUPERUSER=1 composer install --no-dev --optimize-autoloader
(cd admin  && npm ci && npm run build)
(cd public && npm ci && npm run build)
```

- Composer como root pide confirmación; `COMPOSER_ALLOW_SUPERUSER=1` la evita. Sin las
  dependencias de desarrollo solo instala `maxmind-db/reader`, el lector del espejo GeoIP.
- `npm ci` usa el `package-lock.json` exacto. `npm run build` comprueba los tipos (`vue-tsc`) y deja
  `admin/dist/` y `public/dist/`; sin ellas, el panel y la landing responden 503 («falta compilar
  la interfaz»).
- **Sin Node en el servidor:** compila en tu equipo, en la misma rama (el `composer install` y los
  dos `npm ci && npm run build` de arriba), y sube el resultado antes de los permisos:

```bash
# En tu equipo, dentro del repositorio
rsync -a --delete vendor/      root@servidor:/var/www/furrguard/vendor/
rsync -a --delete admin/dist/  root@servidor:/var/www/furrguard/admin/dist/
rsync -a --delete public/dist/ root@servidor:/var/www/furrguard/public/dist/
```

Comprueba:

```bash
ls vendor/autoload.php admin/dist/index.html public/dist/index.html
php -r 'require "vendor/autoload.php"; echo class_exists("MaxMind\\Db\\Reader") ? "MaxMind: OK\n" : "MaxMind: FALTA\n";'
# MaxMind: OK
```

Sin `vendor/` FurrGuard funciona, pero sin espejo GeoIP, y el Resumen del panel no lo avisa: esta es
la comprobación que lo detecta.

### Permisos

```bash
cd /var/www/furrguard
find . \( -path ./storage -o -path ./.env \) -prune -o -exec chown root:root {} + -exec chmod u=rwX,go=rX {} +
chown -R furrguard:furrguard storage && chmod -R u=rwX,go= storage
[ -f .env ] && chown root:furrguard .env && chmod 0640 .env
```

| Qué | Dueño | Permisos | Por qué |
|---|---|---|---|
| Código (todo salvo `storage/` y `.env`) | `root:root` | lectura para todos, escritura solo root | PHP-FPM, los timers y nginx lo leen. Si `furrguard` pudiera escribir aquí, un fallo en PHP podría dejar código suyo |
| `storage/` | `furrguard:furrguard` | 0700 | sesiones del panel (con sus tokens), límites de peticiones y bases GeoIP |
| `.env` (paso 6) | `root:furrguard` | 0640 | el servicio lo lee pero no lo cambia; nginx (`www-data`) no puede leerlo |

El bloque se puede repetir en cualquier momento, y se repite tras cada actualización (paso 19):
`find` se salta `storage/` y `.env`, así `.env` nunca queda legible para todos ni un instante.

Comprueba:

```bash
runuser -u furrguard -- test -w /var/www/furrguard && echo "PELIGRO: furrguard puede escribir en el código"
runuser -u furrguard -- test -w /var/www/furrguard/storage/sessions && echo "storage: escritura OK"
find /var/www/furrguard -path /var/www/furrguard/storage -prune -o \( -type f -o -type d \) \
     \( -user furrguard -o -perm /022 \) -print
```

Solo debe salir `storage: escritura OK`. El `find` no imprime nada si fuera de `storage/` no hay
archivos de `furrguard` ni escribibles por grupo u otros.

## 5. Discord y MaxMind

`.env` necesita las credenciales de los dos servicios: créalas ahora.

### Aplicación de Discord

1. <https://discord.com/developers/applications> → **New Application**. El nombre es el que ve
   quien autoriza (p. ej. «FurrGuard»).
2. **OAuth2**:
   - **Client ID:** cópialo; no es secreto.
   - **Client Secret → Reset Secret:** se muestra una sola vez. Tenlo a mano para el paso 6, sin
     pegarlo en chats ni en archivos.
   - **Redirects**, exactamente estas dos, con tu dominio, sin barra final ni `www`:
     - `https://furrguard.srteb.eu/admin/callback.php` — inicio de sesión del panel
     - `https://furrguard.srteb.eu/verify.php` — verificación del staff
3. No hace falta bot ni marcar scopes en el portal: FurrGuard pide `identify` (id, nombre y avatar)
   en cada enlace y canjea el código desde el servidor con el secreto. Deja **Public Client**
   desactivado.

Discord no comprueba los redirects hasta que alguien inicia sesión: se pueden registrar antes de
tener la web.

### Cuenta de MaxMind

1. Cuenta gratuita en <https://www.maxmind.com/en/geolite2/signup>.
2. **Account ID:** en el resumen de la cuenta.
3. **Manage License Keys → Generate new license key:** la clave se muestra una sola vez.

## 6. Configuración y secretos

```bash
install -o root -g furrguard -m 0640 /var/www/furrguard/.env.example /var/www/furrguard/.env
```

Pega esta función en la sesión. Escribe cada valor en su línea de `.env`, entre comillas simples;
si no le das el valor, lo pide sin eco. El valor llega a PHP por el entorno: no aparece en
pantalla, ni en el historial, ni en los argumentos de ningún proceso (`ps`).

```bash
# fg_env CLAVE [valor]: escribe CLAVE='valor' en .env. Sin valor, lo pide sin eco.
fg_env() {
  local valor
  if [ $# -ge 2 ]; then valor=$2; else read -rsp "$1: " valor; echo; fi
  FG_CLAVE=$1 FG_VALOR=$valor php -r '
    $archivo = "/var/www/furrguard/.env";
    $clave = getenv("FG_CLAVE");
    $valor = getenv("FG_VALOR");
    if ($valor === "" || strpbrk($valor, "\x27\r\n") !== false) {
        fwrite(STDERR, "$clave: valor vacío o con comillas simples o saltos de línea\n");
        exit(1);
    }
    $n = 0;
    $texto = preg_replace_callback("/^" . preg_quote($clave, "/") . "=.*$/m",
        fn () => "$clave=\x27$valor\x27", file_get_contents($archivo), -1, $n);
    if ($n !== 1) {
        fwrite(STDERR, "$clave no aparece una sola vez en .env\n");
        exit(1);
    }
    file_put_contents($archivo, $texto);
    echo "$clave guardada\n";'
}
```

```bash
fg_env APP_URL "https://$DOMINIO"
fg_env DISCORD_REDIRECT_URI "https://$DOMINIO/admin/callback.php"
fg_env DB_NAME furrguard
fg_env DB_USERNAME furrguard
fg_env DB_PASSWORD "$(cat /root/furrguard-db.pass)"
fg_env DISCORD_CLIENT_ID 123456789012345678       # tu Client ID
fg_env FOUNDER_DISCORD_ID 123456789012345678      # tu Discord ID
fg_env DISCORD_CLIENT_SECRET                      # lo pide sin eco: pega el secreto e Intro
fg_env MAXMIND_ACCOUNT_ID 1234567                 # tu Account ID
fg_env MAXMIND_LICENSE_KEY                        # lo pide sin eco
rm -f /root/furrguard-db.pass
```

Cada línea responde `CLAVE guardada`. Comprueba sin enseñar los secretos:

```bash
grep -Ev '^[[:space:]]*(#|$)' /var/www/furrguard/.env \
  | sed -E 's/^(DB_PASSWORD|DISCORD_CLIENT_SECRET|MAXMIND_LICENSE_KEY)=.+/\1=(oculta)/'
ls -l /var/www/furrguard/.env       # -rw-r----- 1 root furrguard …
runuser -u furrguard -- php -r 'require "/var/www/furrguard/includes/bootstrap.php"; echo APP_URL, "\n"; dbConnect(dbConfigFromEnv()); echo "BD: OK\n";'
# https://furrguard.srteb.eu
# BD: OK
```

El último comando lee `.env` como el servicio y entra en la base con sus credenciales. Si falla,
PHP dice por qué (p. ej. `[1045] Access denied`), nunca con la contraseña.

| Variable | Valor | Notas |
|---|---|---|
| `APP_ENV` | `production` | `development` muestra errores y abre la CSP al servidor de Vite: nunca en el servidor |
| `APP_URL` | `https://furrguard.srteb.eu` | **Obligatoria, con https y sin barra final.** De ella salen el origen que acepta el panel, las URL de Discord y de verificación, HSTS y la cookie de sesión `__Host-furrguard`, que el navegador solo guarda por https |
| `DB_HOST` | `localhost` | `localhost` va por el socket de MariaDB y casa con `'furrguard'@'localhost'`; `127.0.0.1` iría por TCP |
| `DB_PORT` | `3306` | solo cuenta por TCP |
| `DB_NAME` · `DB_USERNAME` | `furrguard` | los del paso 3 |
| `DB_PASSWORD` | secreto | la del paso 3 |
| `DISCORD_CLIENT_ID` | Client ID | vacío: el panel dice «El inicio de sesión no está configurado en el servidor» y la verificación responde 503 |
| `DISCORD_CLIENT_SECRET` | secreto | |
| `DISCORD_REDIRECT_URI` | `https://…/admin/callback.php` | vacía equivale a `APP_URL/admin/callback.php`. La de la verificación es siempre `APP_URL/verify.php` |
| `FOUNDER_DISCORD_ID` | Discord ID | founder siempre, aunque no esté en **Usuarios**; nadie le puede quitar el acceso desde el panel |
| `TRUSTED_PROXIES` | vacío | solo con un proxy inverso propio delante de este nginx: IPs o CIDR separados por comas. Cloudflare se detecta solo |
| `API_RATE_LIMIT_PER_MIN` | `6000` | peticiones por minuto por API key; todo el tráfico de la red sale de la IP del proxy |
| `GEOIP_COUNTRY_DB` · `GEOIP_ASN_DB` | `storage/geoip/…` | relativas a la raíz. Fuera de `/var/www/furrguard` chocarían con el `open_basedir` del pool |
| `MAXMIND_ACCOUNT_ID` · `MAXMIND_LICENSE_KEY` | cuenta y secreto | los usa `bin/geoip-update.php` |

> **`APP_URL` tiene que estar bien antes del paso 7.** Las migraciones guardan `APP_URL/verify.php`
> como URL de verificación de FurrSecurity y no vuelven a tocarla. Si más adelante cambias de
> dominio, cámbiala también en **Ajustes → FurrSecurity**.

Con `clear_env = yes` el pool no hereda variables de entorno, así que todo sale de `.env`.

## 7. Migraciones

```bash
cd /var/www/furrguard
runuser -u furrguard -- php bin/migrate.php --status    # 7 migraciones «pendiente»
runuser -u furrguard -- php bin/migrate.php
runuser -u furrguard -- php bin/migrate.php --status    # las 7 «aplicada AAAA-MM-DD HH:MM:SS UTC»
```

La ejecución lista cada migración (`→ 0001_legacy_schema`, `creada settings`… `proveedores
insertados: …`) y termina en `Aplicadas: 0001_legacy_schema, 0002_schema_fixes, 0003_api_key_hash,
0004_normalize_identities, 0005_settings_defaults, 0006_drop_orphan_tables, 0007_plugin_messages`.

- Se lanza como `furrguard`: nada queda como root y compruebas de nuevo que el servicio entra en
  la base.
- En una base vacía crean todas las tablas, los ajustes y mensajes por defecto y la lista de
  proveedores. **No crean ningún usuario del panel:** el founder es la cuenta de
  `FOUNDER_DISCORD_ID`.
- Son idempotentes: si se corta, vuelve a lanzar el comando.

Comprueba:

```bash
mariadb furrguard -e 'SHOW TABLES' | tail -n +2 | wc -l     # 25
mariadb furrguard -e 'SELECT value FROM settings WHERE `key` = "furrsecurity_verify_url"'
# https://furrguard.srteb.eu/verify.php
```

## 8. GeoIP: espejo de MaxMind

FurrGuard consulta ip-api.com (proxy, hosting, red móvil e ISP) y además una copia local de
GeoLite2-Country y GeoLite2-ASN. Si ip-api cae o agota su cupo, los bloqueos por país, continente,
ASN y proveedor siguen funcionando.

```bash
runuser -u furrguard -- php /var/www/furrguard/bin/geoip-update.php
# GeoLite2-Country: actualizada en /var/www/furrguard/storage/geoip/GeoLite2-Country.mmdb
# GeoLite2-ASN: actualizada en /var/www/furrguard/storage/geoip/GeoLite2-ASN.mmdb
ls -l /var/www/furrguard/storage/geoip/        # los dos .mmdb, -rw-r----- furrguard furrguard
```

> **Siempre como `furrguard`.** Descargadas como root, las bases quedarían `root:root 0640`:
> PHP-FPM no podría leerlas y el panel marcaría el espejo como `missing`.

Comprueba que PHP las lee:

```bash
runuser -u furrguard -- php -r 'require "/var/www/furrguard/includes/bootstrap.php"; echo geoMirrorStatus(), "\n"; var_export(geoMaxmindLookup("8.8.8.8")); echo "\n";'
# ok
# array ( 'countryCode' => 'US', 'country' => 'United States', …, 'as' => 'AS15169 …', … )
```

## 9. nginx y TLS

### 9.1 Certificado

El sitio de `deploy/` ya apunta al certificado, así que primero se emite, con el sitio por defecto
de nginx todavía activo:

```bash
curl -sI "http://$DOMINIO/" | head -n1       # HTTP/1.1 200 OK: el nginx por defecto responde en tu dominio
certbot certonly --webroot -w /var/www/html -d "$DOMINIO" --deploy-hook 'systemctl reload nginx'
ls "/etc/letsencrypt/live/$DOMINIO/"         # cert.pem  chain.pem  fullchain.pem  privkey.pem  README
```

- La primera vez pide un correo (para avisos de caducidad) y aceptar las condiciones.
- `certonly --webroot` y no `--nginx`: certbot no toca la configuración. El sitio de `deploy/`
  sigue sirviendo `/var/www/html/.well-known/acme-challenge/` para las renovaciones.
- `--deploy-hook` queda guardado: cada renovación recarga nginx. Renueva el `certbot.timer` del
  paquete.
- Si el dominio tiene AAAA, el servidor tiene que responder también por IPv6: Let's Encrypt la
  prefiere.

### 9.2 Sitio

```bash
sed "s/furrguard\.srteb\.eu/$DOMINIO/g" /var/www/furrguard/deploy/furrguard-nginx.conf > /etc/nginx/sites-available/furrguard
grep -E 'server_name|ssl_certificate' /etc/nginx/sites-available/furrguard    # tu dominio en las 4 líneas
ln -s /etc/nginx/sites-available/furrguard /etc/nginx/sites-enabled/furrguard
rm /etc/nginx/sites-enabled/default          # el sitio por defecto sobra; /var/www/html se queda
nginx -t && systemctl reload nginx
certbot renew --dry-run                      # Congratulations, all simulated renewals succeeded
```

Qué hace el sitio (los detalles, en los comentarios del archivo):

- **Puerto 80:** sirve los retos de Let's Encrypt y redirige lo demás a
  `https://furrguard.srteb.eu`, con el nombre fijo y nunca con la cabecera `Host` del cliente.
- **Solo los 7 puntos de entrada PHP** van a PHP-FPM: `index.php`, `verify.php`,
  `admin/index.php`, `admin/api.php`, `admin/callback.php`, `api/plugin.php` y
  `api/furrsecurity.php`.
- **404** para archivos ocultos (`.env`, `.git`), carpetas internas (`config`, `includes`,
  `database`, `bin`, `storage`, `vendor`, `libs`, `modulos`, `FurrGuard-plugin`, `docs`, `tests`,
  `shared`, `deploy`), fuentes de los SPA y extensiones de código y datos.
- **Assets** de Vite en `/admin/assets/` y `/public/assets/`, desde `dist/`, con caché de un año.
- **Rutas de los SPA:** cualquier otra ruta bajo `/admin/` la resuelve `admin/index.php`, y el resto
  `index.php`. nginx nunca sirve un archivo del código.
- **Cabeceras:** `nosniff` y `Referrer-Policy` para todo; la CSP con nonce, `X-Frame-Options` y
  HSTS las pone PHP. Ninguna `location` define `add_header`, así todas heredan las del servidor.
- **Límites:** 2 MB por petición (el JSON del panel admite 1 MB) y 60 s de espera a PHP.

Comprueba:

```bash
curl -sI "http://$DOMINIO/admin/" | grep -iE '^(HTTP|location)'
# HTTP/1.1 301 Moved Permanently
# Location: https://furrguard.srteb.eu/admin/
curl -s -o /dev/null -w '%{http_code}\n' "https://$DOMINIO/"             # 200 (landing)
curl -s -o /dev/null -w '%{http_code}\n' "https://$DOMINIO/verify.php"   # 400 (sin token)
curl -s -o /dev/null -w '%{http_code}\n' "https://$DOMINIO/.env"         # 404
curl -sI "https://$DOMINIO/admin/" | grep -iE '^(content-security-policy|set-cookie|strict-transport-security)'
# content-security-policy: default-src 'self'; script-src 'self' 'nonce-…'; …
# set-cookie: __Host-furrguard=…; path=/; secure; HttpOnly; SameSite=Lax
# strict-transport-security: max-age=31536000; includeSubDomains
```

Si tienes cortafuegos, abre 80 y 443 (con ufw: `ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable`).

### Cloudflare delante

- **Activa el proxy (nube naranja) después del 9.1.** Con el proxy y «Always Use HTTPS», el primer
  reto llegaría por https a un nginx aún sin certificado. Las renovaciones sí pasan por Cloudflare:
  el sitio sirve el reto por http y por https.
- **SSL/TLS → Full (strict).** Con «Flexible», Cloudflare pide por http, nginx redirige a https y
  el navegador entra en un bucle de redirecciones.
- **`TRUSTED_PROXIES` se queda vacío.** FurrGuard reconoce los rangos oficiales de Cloudflare y
  solo entonces toma la IP de `CF-Connecting-IP`. Los logs de nginx mostrarán IPs de Cloudflare.
- **Deja pasar a los plugins.** En **Security**, crea una regla que omita el desafío de bots, el
  modo «I'm Under Attack» y el WAF para `/api/plugin.php` y `/api/furrsecurity.php`. Si Cloudflare
  responde con su página de desafío, el plugin recibe HTML en vez de JSON y lo trata como un fallo
  de la API: con la política por defecto no entra nadie, y FurrSecurity mantiene bloqueado al staff.
- **Desactiva Rocket Loader:** reescribe los `<script>` y la CSP con nonce los bloquea; el panel
  queda en blanco.

## 10. Tareas programadas

Sustituyen a los cron de CloudPanel. Todas corren con el sistema en solo lectura salvo la carpeta
que necesita cada una; la limpieza y GeoIP, además, como `furrguard`.

| Unidad | Cuándo | Qué hace |
|---|---|---|
| `furrguard-cleanup` | cada hora, minuto 17 | `bin/cleanup.php`: cachés caducadas, sesiones del panel, enlaces y sesiones antiguas de FurrSecurity, intentos fallidos, archivos de límites y la retención de **Ajustes → Retención** |
| `furrguard-geoip` | martes y viernes, 04:43 (±30 min) | `bin/geoip-update.php`: GeoLite2-Country y GeoLite2-ASN |
| `furrguard-backup` (opcional) | cada día, 03:30 (±15 min) | volcado comprimido de la base; guarda 14 días |

```bash
cd /var/www/furrguard/deploy
install -m 0644 furrguard-cleanup.service furrguard-cleanup.timer \
                furrguard-geoip.service furrguard-geoip.timer /etc/systemd/system/
systemctl daemon-reload
systemd-analyze verify /etc/systemd/system/furrguard-cleanup.service /etc/systemd/system/furrguard-geoip.service

systemctl start furrguard-cleanup.service
journalctl -u furrguard-cleanup.service -n 10 --no-pager
# ip_cache                       0
# … (una línea por tarea, hasta ratelimit_files) y «Finished furrguard-cleanup.service»
systemctl start furrguard-geoip.service
journalctl -u furrguard-geoip.service -n 5 --no-pager      # las dos «actualizada en …»

systemctl enable --now furrguard-cleanup.timer furrguard-geoip.timer
systemctl list-timers 'furrguard-*'                        # próxima ejecución de cada una
```

`systemd-analyze verify` no debe quejarse de estas dos unidades. `bin/cleanup.php` toma un
bloqueo en la base: si la anterior sigue en marcha, la nueva escribe `Otra limpieza está en curso.`
y termina.

Si una unidad falla (`systemctl status furrguard-cleanup.service`):

| Síntoma | Causa |
|---|---|
| `status=226/NAMESPACE` | falta `storage/ratelimit`, `storage/geoip` o `/var/backups/furrguard` (el sandbox las abre para escritura) |
| `status=217/USER` | no existe el usuario `furrguard` (paso 2) |
| `Error en la limpieza: SQLSTATE[HY000] [1045] …` | credenciales de la base en `.env` (paso 6) |
| `Faltan MAXMIND_ACCOUNT_ID y/o MAXMIND_LICENSE_KEY en .env` | paso 6 |
| `GeoLite2-Country: Descarga fallida (HTTP 401): …` | Account ID o license key incorrectos |

### Copia diaria de la base de datos (opcional)

Corre como root para entrar en MariaDB por `unix_socket`: no hay contraseña guardada para la copia.

```bash
install -d -m 0700 /var/backups/furrguard
install -m 0644 /var/www/furrguard/deploy/furrguard-backup.service /var/www/furrguard/deploy/furrguard-backup.timer /etc/systemd/system/
systemctl daemon-reload
systemctl start furrguard-backup.service
ls -l /var/backups/furrguard/                              # furrguard-AAAA-MM-DD-HHMM.sql.gz
gunzip -c /var/backups/furrguard/furrguard-*.sql.gz | head -n 3    # la cabecera: -- MariaDB dump …
systemctl enable --now furrguard-backup.timer
```

Si el volcado falla, la unidad falla y no deja un `.gz` a medias ni borra las copias antiguas. Una
copia en el mismo disco no protege de perder el servidor: llévala también fuera.

## 11. Primer arranque del panel

1. Abre `https://furrguard.srteb.eu/admin/` → **Entrar con Discord** con la cuenta de
   `FOUNDER_DISCORD_ID`.
2. **Ajustes**, al final → **API key de los plugins** → **Generar clave**. Cópiala del diálogo
   «Tu nueva API key» a tu gestor de contraseñas: es la única vez que se muestra, porque solo se
   guarda su hash. En los `config.yml` de los plugins va en `api.key`. Mientras no exista, las APIs
   de plugins responden `503 api_key_not_configured`.
3. **Ajustes → General:** **Nombre del servidor** (`server_name`, sale en los mensajes de
   expulsión) y **Enlace de Discord** (`discord_url`). **Ajustes → FurrSecurity:** la **URL de
   verificación** debe ser `https://furrguard.srteb.eu/verify.php`, en el mismo dominio que
   `APP_URL` (la vuelta de Discord y la cookie de la verificación viven ahí); revisa también la
   duración de la sesión (8 h), la caducidad del enlace (180 s), los intentos fallidos (3 en 24 h)
   y los bloqueos. **Guardar.**
4. **Usuarios → Añadir usuario** para el resto del equipo (Discord ID y rol). Owner: todo salvo
   proveedores, ajustes y usuarios. Manager: jugadores, conexiones, IPs y listas. Sr. Admin y
   Admin: jugadores y listas, sin IPs. La lista empieza vacía: el founder no aparece en ella.
5. **Resumen:** sin avisos «Falta la API key», «ip-api no responde», «ip-api limitada» ni «Falta
   el espejo MaxMind», y abajo en la barra lateral, «Todo en orden».

Comprueba la clave contra la API sin dejarla en pantalla ni en el historial:

```bash
read -rsp 'API key: ' FG_KEY; echo
printf 'X-API-Key: %s\n' "$FG_KEY" | curl -s -X POST -H @- "https://$DOMINIO/api/plugin.php?action=get_settings"; echo
# {"notify_connections":"0","notify_hispanic":"0","server_name":"…","discord_url":"…","cache_version":"…"}
unset FG_KEY
```

`printf` es interno de bash y `curl -H @-` lee la cabecera de su entrada: la clave no pasa por los
argumentos de ningún proceso.

---

## 12. Plugins: compilar los jars

Se compilan en tu equipo o en una CI; el servidor web no necesita Java. Cada proyecto lleva su
wrapper de Gradle 8.14.4 y la librería común `libs/furrguard-common` entra sola (`includeBuild`),
sombreada dentro de cada jar.

- **Gradle con JDK 21** (`JAVA_HOME` apuntando a él).
- **Un JDK 17 instalado:** el plugin FurrGuard compila con un toolchain 17 fijo y el jar ofuscado
  usa su carpeta `jmods`. Temurin la trae; en Ubuntu, instala también `openjdk-17-jmods`.
- FurrSecurity compila con toolchain 21 (`-PtoolchainVersion=<n>` usa otro JDK ≥ 21) y FurrPerms
  con la JVM de Gradle, a bytecode 17.

```bash
git clone --branch fix/auditoria https://github.com/grinchhorizon/SrTeb-FurrGuard.git
cd SrTeb-FurrGuard
java -version                                          # 21
(cd FurrGuard-plugin && ./gradlew build)
(cd modulos/furrsecurity-module && ./gradlew build)
(cd modulos/furrperms-module && ./gradlew build)
ls FurrGuard-plugin/build/libs modulos/furrsecurity-module/build/libs modulos/furrperms-module/build/libs
```

En Windows, los mismos comandos en Git Bash (o `gradlew.bat build`). `build` pasa también los tests;
`-x test` los salta.

| Jar | Dónde va | Java de ese servidor |
|---|---|---|
| `FurrGuard-2.0.0.jar` o `FurrGuard-2.0.0-obfuscated.jar` (**uno de los dos**) | `plugins/` de Velocity 3.4+ | 17 o superior |
| `furrperms-module-2.0.0.jar` | `plugins/` de Velocity 3.4+ | 17 o superior |
| `FurrSecurity-2.0.0.jar` | `plugins/` de Velocity 3.4+ **y** de cada Paper 1.21.4+ (el mismo jar) | **21** |

En la práctica, Java 21 en el proxy y en los Paper: FurrSecurity lo exige y Paper 1.21 también.

Cada plugin crea su carpeta de datos al arrancar:

| Plugin | Carpeta |
|---|---|
| FurrGuard | `plugins/furrguard/` |
| FurrPerms | `plugins/furrperms-module/` |
| FurrSecurity en Velocity | `plugins/furrsecurity/` |
| FurrSecurity en Paper | `plugins/FurrSecurity/` |

## 13. Velocity y Paper: lo que afecta a FurrGuard

En `velocity.toml`:

```toml
# Red premium: Velocity autentica con Mojang y los UUID son los reales
online-mode = true
# Los Paper reciben del proxy la IP y el UUID reales, firmados con el secreto
player-info-forwarding-mode = "modern"
forwarding-secret-file = "forwarding.secret"

[advanced]
# true solo si delante de Velocity hay un proxy TCP (TCPShield, HAProxy…) que envía PROXY protocol
haproxy-protocol = false
```

En cada Paper:

```yaml
# config/paper-global.yml
proxies:
  velocity:
    enabled: true
    online-mode: true             # igual que online-mode en velocity.toml
    secret: "…"                   # el contenido de forwarding.secret del proxy
```

Y `online-mode=false` en `server.properties`, `settings.bungeecord: false` en `spigot.yml`.
`forwarding.secret` es un secreto: con él cualquiera puede hacerse pasar por el proxy ante los Paper.

Por qué importa cada opción:

- **`player-info-forwarding-mode = "modern"`.** FurrSecurity en Paper identifica al staff por UUID
  e IP, porque la sesión verificada está atada a la IP. Sin reenvío moderno, Paper ve la IP del
  proxy (y un UUID offline), la API responde `ip_changed` o `no_valid_session` y el staff **no se
  desbloquea nunca en Paper**. Además, con el secreto, los Paper rechazan a quien intenta entrar
  directamente, sin pasar por el proxy y, por tanto, sin pasar por FurrGuard. Aun así, que los
  backends no sean accesibles desde internet (cortafuegos o red interna).
- **`online-mode`.**
  - `true`: los UUID son los de Mojang; los baneos por UUID, `/fg check` y el UUID de las entradas
    de FurrPerms identifican a la cuenta.
  - `false` (red no premium): el UUID sale del nick, así que cualquiera puede entrar con el nick de
    otro. FurrGuard aplica igualmente los baneos por el UUID premium de ese nick (lo consulta a
    Mojang), pero al staff lo protege FurrSecurity: sin su Discord no pasa del bloqueo. El UUID de
    una entrada de FurrPerms no distingue a un impostor con el mismo nick; lo frena la sesión de
    FurrSecurity atada a la IP.
- **`haproxy-protocol`.** FurrGuard evalúa la IP con la que el jugador llega a Velocity. Con un
  proxy TCP delante y esta opción en `false`, todos llegan con la IP de ese proxy, de un
  datacenter: la detección de hosting bloquearía a todos y compartirían los baneos por IP. Actívala
  a la vez en Velocity y en el proxy delantero.
- **`prevent-client-proxy-connections`.** FurrGuard no la usa. Solo actúa con `online-mode = true`:
  Velocity pasa la IP a Mojang al autenticar y expulsa si no coincide. Actívala si quieres esa capa
  y no da falsos rechazos (redes con IPv4 e IPv6 a la vez).

Salidas que necesitan: el proxy, https a tu dominio (API) y a `furrdownloads.srteb.eu` (licencia de
FurrGuard); cada Paper, https a tu dominio.

## 14. Plugin FurrGuard (Velocity)

### 14.1 Instalación y `config.yml`

1. Copia `FurrGuard-2.0.0.jar` (o el ofuscado, nunca los dos) a `plugins/` de Velocity.
2. **Antes del primer arranque**, crea `plugins/furrguard/config.yml` a partir de
   `deploy/plugins/furrguard-config.example.yml`, con tu dominio en `api.url` y la API key del paso
   11 en `api.key`. Si arrancas sin él, el plugin crea uno con los valores de ejemplo, lo da por no
   válido y deniega todos los logins hasta que lo corrijas y ejecutes `/fg reload`.

| Clave | Por defecto | Qué hace |
|---|---|---|
| `enabled` | `true` | `false`: el proxy deja entrar a todos sin comprobar nada |
| `debug` | `false` | registra acción, estado y tiempo de cada llamada a la API (nunca cuerpos ni la clave) |
| `api.url` | `https://tu-dominio.com/api/plugin.php` | `https://furrguard.srteb.eu/api/plugin.php`. Exige https y rechaza el dominio de ejemplo |
| `api.key` | `YOUR_SECURE_API_KEY_HERE` | la API key del panel. Los valores de ejemplo (`YOUR_…`, `TU_…`, `changeme`) se rechazan |
| `api.timeout` | `8000` | ms, plazo **total** de cada petición con sus reintentos; máximo `25000` (el cliente de Minecraft abandona el login a los 30 s) |
| `api.connect-timeout` | `5000` | ms para abrir la conexión |
| `api.allow-insecure-http` | `false` | solo desarrollo: permite `http://` y la clave viajaría sin cifrar |
| `api.failure-policy` | `deny` | si la API no da una decisión (red, timeout, 5xx, 429, JSON inválido): `deny` expulsa con «error de verificación»; `allow` deja entrar sin comprobar. Una clave rechazada (401/403), otro 4xx o una configuración incorrecta deniegan siempre |
| `api.poll-interval` | `5` | segundos entre consultas de cambios del panel (1–300) |
| `cache.enabled` | `true` | guarda solo respuestas correctas; se vacía con cada cambio en el panel y con `/fg reload` |
| `cache.duration` | `300` | segundos |
| `license.discord-url` | `discord.gg/srteb` | enlace del mensaje «Sin Licencia» |
| `notifications.hispanic-countries` | 20 países | códigos ISO que no disparan el aviso de `notify_hispanic` |

Los textos de expulsiones y avisos se editan en el panel (**Mensajes**); el `messages.yml` del jar
son solo los textos por defecto.

### 14.2 Primer arranque y licencia

Sin licencia vinculada, la consola muestra:

```text
[furrguard]: FurrGuard v2.0.0 by GrinchHorizon - anti-proxy/VPN/hosting
[furrguard]: Listeners y comandos registrados: /furrguard, /fg, /guard
[furrguard]: No hay licencia vinculada: se deniegan los logins hasta completar la vinculacion.
[furrguard]: ====================================================================
[furrguard]:  VINCULACION REQUERIDA - VERIFICACION CON DISCORD
[furrguard]:  Mientras no se vincule, el proxy deniega todos los logins.
[furrguard]:  Codigo de vinculacion: <código> (caduca en 5 minutos; despues se genera otro)
[furrguard]:  Abre en el navegador: https://furrdownloads.srteb.eu/link/<código>?redirect=false
[furrguard]: ====================================================================
```

1. Abre el enlace e inicia sesión con la cuenta de Discord titular de la licencia para confirmar la
   vinculación. Mientras tanto, los jugadores ven «Sin Licencia».
2. El plugin consulta el código cada 10 s. Al completarse escribe `Servidor vinculado
   correctamente.`, `Verificando licencia...` y `Licencia valida: … | titular: … | rol: … |
   servidores: n/m | …`.
3. Si pasan los 5 minutos: `El codigo de vinculacion ha caducado: se genera uno nuevo.` y aparece
   otro código.

En `plugins/furrguard/` quedan:

| Archivo | Contenido |
|---|---|
| `key` | la clave de licencia cifrada y el `instance_id` («DO NOT modify this file») |
| `hwid` | el identificador de la máquina. Se calcula una sola vez, con el sistema, la versión de Java y el `bind` de `velocity.toml`, y después ya no cambia |
| `license-state.json` | la última verificación correcta: la base del periodo de gracia |

- Verifica la licencia cada 6 h y envía un latido cada 5 min.
- Si el servidor de licencias no responde, la red sigue abierta **72 h** desde la última
  verificación correcta (`/fg status`: «Periodo de gracia»). Pasado ese plazo, deniega hasta que
  vuelva a verificar.
- Solo un rechazo explícito de la clave borra `key` y `license-state.json` y vuelve a pedir la
  vinculación.
- Guarda copia de los tres archivos. Si borras `hwid` y ha cambiado la versión de Java o el `bind`,
  el identificador ya no coincide y hay que vincular de nuevo.

Comprueba con `/fg status` en la consola del proxy:

```text
 Estado del sistema
   Plugin: ✔ Activo
   Licencia: ✔ Válida (<titular>)
   API: ✔ Conectada (hace 3 s)
   Política de fallo: deny
   Caché: ✔ Habilitada (0 entradas, 300 s)
   Debug: ✔ Desactivado
   Jugadores: 0
```

### 14.3 Comandos y permisos

`/furrguard` (alias `/fg` y `/guard`), con el permiso `furrguard.admin`:

| Comando | Qué hace |
|---|---|
| `/fg status` | estado del plugin, la licencia, la API, la política de fallo y la caché |
| `/fg check <jugador>` | decisión actual: conectado, lo vuelve a comprobar sin registrar nada; desconectado, con su última IP |
| `/fg stats` | jugadores, servidores y tipo de licencia |
| `/fg cache info` · `/fg cache clear` | caché de verificaciones |
| `/fg reload` | relee `config.yml`; si tiene errores, los lista y conserva la configuración anterior |
| `/fg help` | ayuda |

| Permiso | Para |
|---|---|
| `furrguard.admin` | usar `/fg` y recibir los avisos |
| `furrguard.notify` | recibir los avisos: logins bloqueados, expulsiones tras cambios en el panel, altas y bajas de listas y, si están activados `notify_connections` o `notify_hispanic`, las conexiones |

No hay permiso para saltarse las comprobaciones: para dejar pasar a alguien, **Whitelist** en el
panel.

## 15. FurrPerms (Velocity)

Protege los comandos de permisos: solo los usan los jugadores de su whitelist.

1. Copia `furrperms-module-2.0.0.jar` a `plugins/` de Velocity.
2. Crea `plugins/furrperms-module/config.yml` a partir de
   `deploy/plugins/furrperms-config.example.yml`: la misma API (`/api/plugin.php`) y la misma clave
   que FurrGuard.
3. Reinicia el proxy: FurrPerms no tiene comando de recarga. En la consola:
   `FurrPerms 2.0.0 protegiendo 23 comandos de permisos`.

| Clave | Por defecto | Qué hace |
|---|---|---|
| `enabled` | `true` | `false`: los comandos de permisos quedan sin proteger |
| `debug` | `false` | registra cada decisión (nunca los argumentos del comando) |
| `api.url` | `https://furrguard.srteb.eu/api/plugin.php` | exige https |
| `api.key` | `YOUR_FURRGUARD_API_KEY_HERE` | con un valor de ejemplo se deniegan todos los comandos protegidos. Si falta, se lee la clave antigua `api-key` |
| `commands.protected` | `[]` | comandos que se **suman** a la lista integrada |
| `notifications.blocked` | `true` | avisos a quien tenga `furrperms.notify` (y a la consola) |
| `notifications.allowed` | `true` | |

La lista integrada cubre LuckPerms en servidor, BungeeCord y Velocity (`lp`, `luckperms`, `perm`,
`perms`, `permission`, `permissions`, `lpb`… `lpv`, `luckpermsvelocity`, `vperm`…), `op`, `deop`,
`pex` y `permissionsex`, también con namespace (`/luckperms:lp`), dentro de `execute … run` y tras
`sudo`, `esudo` o `cmi sudo`.

Cada comando protegido de un jugador se consulta a la API:

| Resultado | Qué ve el jugador |
|---|---|
| no está en la whitelist (`not_whitelisted`) | «El comando … está restringido por FurrPerms. Solo usuarios autorizados pueden ejecutarlo.» |
| la entrada tiene UUID y no es el suyo (`uuid_mismatch`) | «Tu cuenta no coincide con la autorizada para usar …» |
| es staff de FurrSecurity sin sesión verificada desde esa IP (`needs_furrsecurity`) | «Verifica tu identidad con FurrSecurity antes de usar …» |
| la API no responde | «No se ha podido comprobar tu autorización…» (se deniega) |

Un permiso concedido se recuerda 30 s para ese UUID e IP; tras una denegación, espera 5 s. Solo se
filtran los comandos de jugadores que pasan por el proxy; la consola no.

**Alta en el panel:** **FurrPerms → Whitelist de comandos → Añadir a FurrPerms**, con el nick, el
UUID (opcional; en redes premium, recomendable: está en la ficha del jugador, en **Jugadores**) y el
motivo. **Registro de comandos** muestra lo permitido y lo bloqueado, según **Ajustes → FurrPerms**.

## 16. FurrSecurity (Velocity y Paper)

Obliga al staff a verificar su identidad con Discord, desde su IP, antes de poder jugar.

### 16.1 Cómo se reparte el trabajo

| | Velocity | Paper con `proxy-mode: true` |
|---|---|---|
| Bloquea al entrar, antes de consultar la API | sí | sí |
| Da el enlace, avisa de la caducidad y expulsa | sí | no: espera a que el jugador verifique en el proxy |
| Bloquea comandos | sí | sí |
| Bloquea el cambio de servidor | sí | — |
| Bloquea movimiento, inventario, chat, romper, colocar y daño (con ceguera) | no | sí |

Instálalo en Velocity **y** en todos los Paper con `proxy-mode: true`. Un Paper sin Velocity con
FurrSecurity delante usa `proxy-mode: false` y hace todo él solo.

### 16.2 Instalación y `config.yml`

1. Copia `FurrSecurity-2.0.0.jar` a `plugins/` de Velocity y de cada Paper (Java 21).
2. Crea `plugins/furrsecurity/config.yml` en Velocity a partir de
   `deploy/plugins/furrsecurity-velocity-config.example.yml`, y `plugins/FurrSecurity/config.yml`
   en cada Paper a partir de `deploy/plugins/furrsecurity-paper-config.example.yml`.
3. Arranca. En la consola: `FurrSecurity 2.0.0 activo en Velocity` y
   `FurrSecurity 2.0.0 activo en Paper (modo proxy)`.
4. `/fsec status` en los dos: `Activo: si`, `Plataforma: Velocity` o `Paper (modo proxy)`,
   `API: OK`, `Staff en la lista: n` y `Jugadores bloqueados: 0`.

| Clave | Por defecto | Qué hace |
|---|---|---|
| `enabled` | `true` | `false`: no bloquea a nadie (quedan los comandos `/fsec`) |
| `proxy-mode` | `false` | solo en Paper, detrás de un Velocity con FurrSecurity (16.1) |
| `api.url` | `https://furrguard.srteb.eu/api/furrsecurity.php` | la API de FurrSecurity, no la de plugins. Exige https |
| `api.key` | `YOUR_API_KEY_HERE` | con un valor de ejemplo el staff queda bloqueado |
| `alert-times` | `[3600, 1800, 300, 240, 180, 120, 60, 30]` | valor inicial |
| `early-verify-time` | `300` | valor inicial |
| `lock.movement`, `lock.commands`, `lock.inventory`, `lock.server-switch` | `true` | valores iniciales |
| `lock.chat` | `true` | solo aquí y solo en Paper: Velocity no puede cortar el chat de clientes 1.19.1+ sin expulsarlos |
| `notify-admins` | `true` | valor inicial |
| `admin-permission` | `furrsecurity.notify` | valor inicial |

- Los **valores iniciales** valen hasta que responde la API; después mandan los del panel
  (**Ajustes → FurrSecurity**), que se releen cada minuto junto con la lista de staff y los
  mensajes. La duración de la sesión, la caducidad del enlace, los intentos fallidos, su ventana y
  la URL de verificación solo existen en el panel.
- La conexión con la API no se configura: 5 s para conectar, 10 s en total y 2 reintentos.
  Cualquier fallo mantiene el bloqueo y reintenta cada 5 s (cada 60 s si la clave se rechaza o la
  configuración no es válida).
- `/fsec reload` relee `config.yml` y vuelve a pedir staff, ajustes y mensajes.

### 16.3 Quién tiene que verificar, permisos y comandos

- **Solo el staff dado de alta en el panel:** **FurrSecurity → Staff → Añadir staff**, con el
  Discord ID (17 a 20 dígitos) y el nick de Minecraft. La API reconoce al staff por el nick; la
  cuenta de Discord es la que tiene que autorizar.
- Quien tenga `furrsecurity.staff`, `furrguard.*` o `*` (y en Paper, además, ser op) queda bloqueado
  al entrar **hasta que la API conteste**; si no está en la lista, se desbloquea al momento. Da
  `furrsecurity.staff` a todo el staff: si la API no responde al arrancar, el módulo aún no tiene la
  lista y ese permiso es lo único que lo bloquea.

| Permiso | Para | Por defecto en Paper |
|---|---|---|
| `furrsecurity.admin` | usar `/furrsecurity` (alias `/fsec` y `/fs`) | op |
| `furrsecurity.notify` | el aviso «… requiere verificacion» al generarse un enlace nuevo. El nodo se cambia en **Ajustes → FurrSecurity** | op |
| `furrsecurity.staff` | marca de staff: bloqueado hasta que conteste la API | nadie |

En Velocity no hay valores por defecto: hace falta un plugin de permisos (paso 17).

| Comando | Qué hace |
|---|---|
| `/fsec status` | activo, plataforma, estado de la API, staff en la lista y jugadores bloqueados |
| `/fsec check <jugador>` | su estado (bloqueado, verificado, no es staff) y el tiempo de sesión que le queda |
| `/fsec reset <jugador>` | invalida su sesión: queda bloqueado al momento y tiene que verificar de nuevo |
| `/fsec reload` | relee `config.yml`, la API, los ajustes y los mensajes |
| `/fsec help` | ayuda |

Un jugador bloqueado no puede usar comandos, `/fsec` incluido: nadie se desbloquea a sí mismo.

### 16.4 La verificación vista por el staff

1. Entra al servidor y queda bloqueado; en Paper, además, ciego y sin poder moverse. En el chat:
   «Debes verificar tu identidad para continuar.» y «Haz click para verificar: https://…/verify.php?token=…».
2. El enlace dura lo que marque la **caducidad del enlace** (180 s por defecto). La página muestra
   la cuenta de Minecraft, la IP que pidió la verificación, el país, la hora (de Madrid) y la cuenta
   atrás, con el aviso «Si no eres tú quien está entrando ahora mismo desde esta IP, no continúes».
3. Marca **Confirmo que soy yo** → **Continuar con Discord** → autoriza. Discord enseña siempre con
   qué cuenta se autoriza.
4. La página dice «Verificación completada» y, en unos 5 s, el juego «Verificacion completada.
   Ahora puedes jugar.»: queda libre en el proxy y en el Paper.
5. La sesión dura lo que marque la **duración de la sesión** (8 h) y vale solo desde esa IP (la
   misma IPv4, o la misma red /64 en IPv6). Antes de caducar recibe avisos y, en los últimos
   `early-verify-time` segundos, un enlace para renovarla sin cortar la partida.
6. Si vuelve desde otra IP (datos móviles, otra casa), tiene que verificar otra vez. En la consola
   del proxy: `<nick> entra desde otra IP que la de su sesion: debe verificar de nuevo`.

Cuando sale mal:

- **No verifica a tiempo:** expulsión con «No completaste la verificacion a tiempo.» y un intento
  fallido.
- **Autoriza con otra cuenta de Discord:** «Cuenta de Discord incorrecta», con «Intento n de 3»; cuenta
  como fallido.
- **Llega al máximo de intentos dentro de la ventana** (3 en 24 h): baneo automático de su UUID, con
  el nick y la IP (en IPv6, su /64) como hijas. Se quita en **Blacklist**; el autor es
  `FurrSecurity`.

## 17. LuckPerms

Un ejemplo con dos grupos. En la **consola de Velocity** (LuckPerms-Velocity):

```text
lpv creategroup staff
lpv creategroup admin
lpv group admin parent add staff
lpv group staff permission set furrsecurity.staff true
lpv group staff permission set furrguard.notify true
lpv group admin permission set furrguard.admin true
lpv group admin permission set furrperms.notify true
lpv group admin permission set furrsecurity.admin true
lpv group admin permission set furrsecurity.notify true
lpv user <nick> parent add staff
```

En la **consola de cada Paper** (LuckPerms-Bukkit; si todos comparten la base de datos de
LuckPerms y los grupos no dependen del servidor, basta una vez):

```text
lp creategroup staff
lp creategroup admin
lp group admin parent add staff
lp group staff permission set furrsecurity.staff true
lp group admin permission set furrsecurity.admin true
lp user <nick> parent add staff
```

- **Desde la consola, no desde el juego:** `lp` y `lpv` son comandos protegidos por FurrPerms, y en
  el juego exigen estar en su whitelist y, al staff de FurrSecurity, una sesión verificada.
- Los nodos marcan y dan comandos; quién verifica lo decide la lista de **FurrSecurity → Staff**, y
  quién usa comandos de permisos, la de **FurrPerms**.
- Dar `furrguard.*` o `*` en lugar de nodos sueltos también marca como staff (bloqueo hasta que
  conteste la API).
- En Paper con `proxy-mode: true`, `furrsecurity.notify` no se usa: avisa el proxy.

---

## 18. Comprobaciones finales

Desde cualquier equipo:

```bash
DOMINIO=furrguard.srteb.eu

# APIs: GET → 405 · POST sin clave → 401
curl -s -o /dev/null -w '%{http_code}\n' "https://$DOMINIO/api/plugin.php?action=get_settings"
curl -s -o /dev/null -w '%{http_code}\n' -X POST "https://$DOMINIO/api/plugin.php?action=get_settings"
curl -s -o /dev/null -w '%{http_code}\n' -X POST "https://$DOMINIO/api/furrsecurity.php?action=get_staff"

# Con clave → 200 y JSON
read -rsp 'API key: ' FG_KEY; echo
printf 'X-API-Key: %s\n' "$FG_KEY" | curl -s -X POST -H @- "https://$DOMINIO/api/furrsecurity.php?action=get_staff"; echo
# {"staff":[{"nick":"…"}]}
unset FG_KEY

# Nada interno es accesible → 404 en todas
for p in .env .git/config config.php includes/security.php database/migrations storage/ vendor/autoload.php \
         bin/cleanup.php docs/API.md deploy/furrguard-nginx.conf composer.json admin/package.json \
         admin/src/main.ts admin/api/router.php FurrGuard-plugin/build.gradle; do
  printf '%-32s ' "$p"; curl -s -o /dev/null -w '%{http_code}\n' "https://$DOMINIO/$p"
done

# Assets desde dist/ con caché larga, y CSP con nonce en el panel
asset=$(curl -s "https://$DOMINIO/admin/" | grep -o '/admin/assets/index-[^"]*\.js' | head -n1)
curl -sI "https://$DOMINIO$asset" | grep -iE '^(HTTP|cache-control)'          # 200 · max-age=31536000
curl -sI "https://$DOMINIO/admin/" | grep -i '^content-security-policy' | grep -o "'nonce-[^']*'"
```

Un `503 api_key_not_configured` en lugar de 401 significa que aún no generaste la clave (paso 11).

En la red, con jugadores de prueba:

1. **Permitido:** entra un jugador normal. En el panel aparece en **Conexiones**, y `/fg check
   <nick>` responde «✔ PERMITIDO».
2. **VPN o datacenter:** entra con una VPN comercial. Lo expulsa (VPN, proxy u hosting), quien
   tenga `furrguard.notify` recibe el aviso con la IP y el motivo, y en **Conexiones** sale como
   bloqueada.
3. **Baneo:** con el jugador dentro, **Blacklist → Banear jugador**. En unos 5 s lo expulsa con
   «¡Tu cuenta ha sido suspendida!», el motivo y el ID del baneo. Quita el baneo y vuelve a entrar.
4. **Staff:** da de alta a una cuenta de prueba en **FurrSecurity → Staff**, entra, verifica
   (16.4) y comprueba que se desbloquea en el proxy y en el Paper; `/fsec check <nick>` dice
   «verificado» y cuánto le queda.
5. **FurrPerms:** con esa cuenta en **FurrPerms → Whitelist de comandos**, un comando de LuckPerms
   se deniega antes de verificar (`needs_furrsecurity`) y se permite después. Una cuenta fuera de
   la whitelist no puede usarlo nunca.
6. **Revocar:** **FurrSecurity → Sesiones → Revocar** o `/fsec reset <nick>`: vuelve a quedar
   bloqueado.

Durante las pruebas no gastes los intentos fallidos del staff de verdad: el tercero lo banea. Si
pasa, quita el baneo en **Blacklist**.

Mientras pruebas, sigue la consola de Velocity y `tail -f /var/log/nginx/furrguard-error.log`.

## 19. Mantenimiento

### Actualizar dentro de 2.x

```bash
sudo -i
export PHP=$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')
cd /var/www/furrguard
systemctl start furrguard-backup.service     # o el mariadb-dump a mano de abajo
git status --short                           # vacío: sin cambios locales
git pull --ff-only
COMPOSER_ALLOW_SUPERUSER=1 composer install --no-dev --optimize-autoloader
(cd admin && npm ci && npm run build) && (cd public && npm ci && npm run build)

# Permisos (el mismo bloque del paso 4)
find . \( -path ./storage -o -path ./.env \) -prune -o -exec chown root:root {} + -exec chmod u=rwX,go=rX {} +
chown -R furrguard:furrguard storage && chmod -R u=rwX,go= storage
chown root:furrguard .env && chmod 0640 .env

runuser -u furrguard -- php bin/migrate.php
systemctl reload "php$PHP-fpm"               # vacía OPcache sin cortar peticiones
```

- Mientras compila, el panel y la landing responden 503 unos segundos.
- Si una versión nueva trae cambios en `deploy/`, vuelve a instalar los archivos afectados (pasos 2,
  9 o 10) y recarga el servicio correspondiente.
- Las migraciones no se deshacen: volver a la versión anterior es `git checkout` del commit previo,
  recompilar y, si la migración cambió la base, restaurar la copia.
- Si cambiaste los jars, sustitúyelos en Velocity y en los Paper (paso 12) y reinicia.

### Copias de seguridad

- Con el timer del paso 10 quedan en `/var/backups/furrguard/` 14 días. Llévalas fuera del servidor.
- A mano:

```bash
( umask 077 && mariadb-dump --single-transaction --routines --triggers furrguard | gzip > /root/furrguard-$(date +%F).sql.gz )
```

- Guarda también `.env`, **cifrado** o en tu gestor de contraseñas: contiene los secretos. En el
  proxy, `plugins/furrguard/` (`config.yml`, `key`, `hwid`, `license-state.json`),
  `plugins/furrperms-module/config.yml` y `plugins/furrsecurity/config.yml`, y en cada Paper
  `plugins/FurrSecurity/config.yml`.
- Restaurar, **siempre sobre una base vacía** (si quedan tablas de una versión más nueva,
  `schema_migrations` no cuadraría con el esquema):

```bash
mariadb -e 'DROP DATABASE furrguard; CREATE DATABASE furrguard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;'
gunzip -c /var/backups/furrguard/furrguard-AAAA-MM-DD-HHMM.sql.gz | mariadb furrguard
```

Los privilegios del usuario `furrguard` sobreviven al borrado de la base: no hay que volver a darlos.

### Logs

| Qué | Dónde |
|---|---|
| Peticiones | `/var/log/nginx/furrguard-access.log` |
| Errores de nginx y de PHP | `/var/log/nginx/furrguard-error.log` (los de PHP, como `FastCGI sent in stderr: "PHP message: …"`) |
| PHP-FPM (arranque del pool, `pm.max_children`) | `/var/log/php8.3-fpm.log` (`php8.2-fpm.log` en Debian 12) |
| Tareas programadas | `journalctl -u furrguard-cleanup -u furrguard-geoip -u furrguard-backup` |
| Renovaciones del certificado | `journalctl -u certbot` y `/var/log/letsencrypt/letsencrypt.log` |
| Quién hizo qué en el panel | **Registro** |

Los logs de nginx ya rotan con el `logrotate` del paquete.

### Rotar la API key

Hazlo si la clave se ha filtrado, con la red tranquila y los archivos listos:

1. **Ajustes → API key de los plugins → Regenerar.** La anterior deja de valer al momento.
2. Pon la nueva en `api.key` de `plugins/furrguard/config.yml`, `plugins/furrperms-module/config.yml`
   y `plugins/furrsecurity/config.yml` en Velocity, y de `plugins/FurrSecurity/config.yml` en cada
   Paper.
3. `/fg reload` y `/fsec reload` en el proxy, `/fsec reload` en cada Paper, y reinicia el proxy por
   FurrPerms.

Hasta el último paso, FurrGuard deniega todos los logins (una clave rechazada deniega siempre),
FurrSecurity mantiene bloqueado al staff y FurrPerms deniega los comandos protegidos.

## 20. Vuelta atrás y problemas frecuentes

### Desinstalar

Una instalación nueva no tiene versión anterior: volver atrás es desinstalar, en este orden.

1. **Primero los plugins.** Con la web apagada y `failure-policy: deny`, el proxy denegaría todos los
   logins y FurrSecurity bloquearía al staff. Quita los jars de Velocity y de cada Paper y reinicia.
   Guarda antes `plugins/furrguard/` si quieres conservar la vinculación de la licencia.
2. **Tareas programadas:**

```bash
systemctl disable --now furrguard-cleanup.timer furrguard-geoip.timer furrguard-backup.timer
rm -f /etc/systemd/system/furrguard-*.service /etc/systemd/system/furrguard-*.timer
systemctl daemon-reload
```

3. **nginx y certificado:**

```bash
rm -f /etc/nginx/sites-enabled/furrguard /etc/nginx/sites-available/furrguard
ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
certbot delete --cert-name "$DOMINIO"
```

4. **PHP-FPM** (el pool `www` vuelve antes de reiniciar: sin ningún pool, PHP-FPM no arranca):

```bash
export PHP=$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')
mv "/etc/php/$PHP/fpm/pool.d/www.conf.disabled" "/etc/php/$PHP/fpm/pool.d/www.conf"
rm -f "/etc/php/$PHP/fpm/pool.d/furrguard.conf"
systemctl restart "php$PHP-fpm"
```

5. **Base de datos**, con una última copia si la quieres:

```bash
( umask 077 && mariadb-dump --single-transaction furrguard | gzip > /root/furrguard-final.sql.gz )
mariadb -e "DROP DATABASE furrguard; DROP USER 'furrguard'@'localhost';"
```

6. **Código, datos y usuario:**

```bash
rm -rf /var/www/furrguard /var/backups/furrguard
userdel furrguard
```

7. **Fuera del servidor:** borra los redirects (o la aplicación) en el portal de Discord, revoca la
   license key en MaxMind y quita el registro DNS.

### Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| `nginx -t`: `cannot load certificate "/etc/letsencrypt/live/…"` | el sitio se activó antes de emitir el certificado | 9.1 antes que 9.2 |
| certbot: `Timeout during connect` o `NXDOMAIN` | el dominio no apunta aquí o el puerto 80 está cerrado | DNS y cortafuegos; con Cloudflare, en gris durante la emisión |
| `502 Bad Gateway` en todo lo que es PHP | nginx no llega al socket del pool | `ls -l /run/php/furrguard.sock` (de `www-data`), `php-fpm$PHP -t`, `systemctl status php$PHP-fpm` |
| 503 «Servicio no disponible: falta compilar la interfaz.» | faltan `admin/dist` o `public/dist` | paso 4 |
| 503 «El panel no está disponible ahora mismo» | PHP no entra en la base | error log: `FurrGuard DB: conexión fallida … [1045]` → `DB_*` en `.env`; `[2002]` → MariaDB parada |
| Panel: «El inicio de sesión no está configurado en el servidor.» | `DISCORD_CLIENT_ID` vacío, o `.env` ilegible para `furrguard` | paso 6; `ls -l .env` → `root furrguard -rw-r-----` |
| Discord: «Invalid OAuth2 redirect_uri» | el redirect no está registrado tal cual | paso 5: `https://…/admin/callback.php` y `https://…/verify.php`, sin barra final |
| Vuelve al login: «Discord no respondió correctamente» | secreto incorrecto o `DISCORD_REDIRECT_URI` distinta del portal | error log: `FurrGuard Discord: /api/oauth2/token respondió HTTP 401` (secreto) o `HTTP 400` (redirect) |
| «La petición de inicio de sesión no es válida o ha caducado» (`invalid_state`) | el navegador no conserva la sesión: entraste por un host distinto de `APP_URL` (`www.`, la IP) o por http (la cookie `__Host-furrguard` solo se guarda por https y en ese host exacto), o bloquea las cookies | entra siempre por la dirección exacta de `APP_URL`, con https |
| «Tu cuenta de Discord no tiene acceso al panel» | no es `FOUNDER_DISCORD_ID` ni está en **Usuarios** | añádela en **Usuarios** o revisa `FOUNDER_DISCORD_ID` |
| «Token CSRF inválido o petición no permitida. Recarga la página.» | una vez: la pestaña estaba abierta desde antes del último login. En todas las acciones: `APP_URL` no coincide con la dirección del navegador (`http://`, `www.`, otro dominio) | recarga; `APP_URL` exacta, con https |
| La sesión del panel se cierra sola | cambió tu IP (IPv4, o de red /64 en IPv6), 2 h sin uso, 8 h desde el login o entraste desde otro dispositivo | es lo previsto |
| Resumen: «Falta el espejo MaxMind» | faltan las `.mmdb` o PHP no puede leerlas | paso 8 como `furrguard`; `ls -l storage/geoip`; rutas `GEOIP_*` dentro de `/var/www/furrguard` |
| El espejo MaxMind no funciona, pero el Resumen no dice «Falta el espejo MaxMind» | espejo `disabled`: falta `vendor/`, y el Resumen solo avisa del caso `missing` | paso 4: `composer install` y la comprobación `MaxMind: OK` |
| Resumen: «ip-api no responde» | sin salida por http (puerto 80) a `ip-api.com` | abre esa salida: el plan gratuito no admite https |
| Resumen: «ip-api limitada» | se agotó el cupo por minuto (FurrGuard gasta como mucho 40) | normal en picos: el espejo MaxMind cubre país, continente y ASN |
| API: `503 api_key_not_configured` · plugin: `HTTP 503 (api_key_not_configured): el panel no tiene API key…` | aún no hay clave | paso 11 |
| API: `401 invalid_api_key` · `/fg status`: `API: ✘ UNAUTHORIZED: HTTP 401 (invalid_api_key)` | clave distinta o regenerada | copia la actual en `api.key` y `/fg reload` |
| API: `429 rate_limited` en las peticiones del proxy | más de 30 claves erróneas por minuto desde esa IP, o más de `API_RATE_LIMIT_PER_MIN` con la buena | corrige la clave de todos los módulos y espera el `Retry-After` |
| Todos los logins: «SERVIDOR INICIANDO» | `config.yml` no válida (la consola lista los problemas, p. ej. `la clave de la API es el valor de ejemplo`) o licencia verificándose | corrige y `/fg reload`; mira `/fg status` |
| Todos los logins: «Sin Licencia» | licencia sin vincular | el enlace de la consola (14.2) |
| Todos los logins: «ERROR DE VERIFICACIÓN» | la API no responde o Cloudflare devuelve su desafío | `/fg status`; en la consola, `Login de … denegado [ref …]: …`; reglas de Cloudflare (paso 9) |
| Todos bloqueados por hosting o proxy, con la misma IP | Velocity detrás de un proxy TCP sin PROXY protocol | `haproxy-protocol = true` en los dos lados (paso 13) |
| Staff bloqueado sin enlace; consola: `API no disponible para <nick> (…): sigue bloqueado y se reintenta` | API caída, o `api.url`/`api.key` de FurrSecurity mal | `/fsec status` (línea API); `api.url` acaba en `/api/furrsecurity.php` |
| El staff verifica y se libera en Velocity, pero en Paper sigue ciego | Paper no recibe la IP ni el UUID reales: el reenvío no es `modern` | paso 13: `velocity.toml`, `paper-global.yml` y `server.properties` |
| Verificación: «Enlace caducado» (`token_expired`) | el enlace dura 180 s o ya se usó | volver a entrar al servidor |
| Verificación: «Solicitud no válida» (`invalid_state`) | se abrió el enlace en un navegador y se volvió de Discord en otro, o sin cookies | todo en el mismo navegador |
| Verificación: «Cuenta bloqueada» (`auto_blacklisted`) | se llegó al máximo de intentos | quitar el baneo en **Blacklist** |
| Verificación: «Verificación no configurada» (503) | faltan `APP_URL` o `DISCORD_CLIENT_ID` | paso 6 |
| FurrPerms: «No se ha podido comprobar tu autorización» | API caída o clave de FurrPerms mal (consola al arrancar: `API de FurrGuard mal configurada (…)`) | corrige `config.yml` y reinicia el proxy |
| FurrSecurity no carga | Java inferior a 21 | Java 21 en ese servidor |
| Timer: `status=226/NAMESPACE` | falta una carpeta que la unidad abre para escritura | `storage/ratelimit`, `storage/geoip` o `/var/backups/furrguard` |
| Log de PHP-FPM: `server reached pm.max_children setting` | el pool se quedó corto | sube `pm.max_children` en el pool y recarga PHP-FPM |
