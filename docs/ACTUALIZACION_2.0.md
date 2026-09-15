# FurrGuard — actualizar una instalación 1.x a 2.0

Pasos para llevar a 2.0 una instalación 1.x en producción (web en CloudPanel + plugin y módulos en la
red). Los detalles de cada pieza están en `docs/INSTALACION_CLOUDPANEL.md` y el contrato en
`docs/API.md`.

**Planifica una ventana de mantenimiento corta y haz todo seguido.** Las migraciones de la base de
datos no tienen vuelta atrás salvo restaurando la copia, y la web 2.0 no está pensada para convivir
con los jars 1.x: estos no envían los campos que la API exige ahora (por ejemplo, la IP en
FurrSecurity) y FurrSecurity 1.x dejaba pasar ante un error. Lo más seguro es **parar el proxy** (o
cerrarlo a los jugadores) desde el paso 1 hasta el 6.

Ruta del sitio usada en los ejemplos: `/home/furrguard/htdocs/furrguard.srteb.eu`.

---

## 1. Antes: copias de seguridad

Guárdalas **fuera** de `htdocs` (un `.sql.gz` dentro de la web se podría descargar).

```bash
cd /home/furrguard/htdocs/furrguard.srteb.eu
mkdir -p ~/backups

# Base de datos
mysqldump --single-transaction --routines --triggers -u furrguard_user -p furrguard \
  | gzip > ~/backups/furrguard-1x-$(date +%F).sql.gz

# Archivos de la web (incluye .env y storage/) y commit actual
tar -czf ~/backups/furrguard-web-1x-$(date +%F).tar.gz --exclude='node_modules' .
git rev-parse HEAD > ~/backups/furrguard-1x-commit.txt
```

Guarda también, en el proxy y en cada backend:

- los jars actuales de FurrGuard, FurrPerms y FurrSecurity;
- sus carpetas de datos (`plugins/furrguard/` con `config.yml` y el archivo `key` de la licencia,
  `plugins/furrperms-module/`, `plugins/furrsecurity/` en Velocity y `plugins/FurrSecurity/` en Paper);
- el vhost de nginx (CloudPanel → Sites → Vhost) y los cron jobs del sitio.

Comprueba que el volcado no está vacío (`gunzip -c ~/backups/furrguard-1x-*.sql.gz | head`).

---

## 2. Código y dependencias

Requisitos nuevos: PHP 8.2+ y Node 20.19+ (recomendado 22 LTS o 24 LTS). Compruébalo con
`php -v` y `node -v`.

```bash
cd /home/furrguard/htdocs/furrguard.srteb.eu
git status                          # debe estar limpio: guarda o descarta cambios locales antes
git fetch
git checkout fix/auditoria          # rama de la 2.0 mientras no se fusione
git pull

composer install --no-dev --optimize-autoloader
(cd admin  && npm ci && npm run build)
(cd public && npm ci && npm run build)
```

- Git elimina los archivos que ya no existen (`install.sql`, los `.sql` de los módulos,
  `includes/functions.php`, las guías antiguas…). Revisa con `git status --ignored` si quedan en el
  servidor archivos de la 1.x que nunca estuvieron en git y bórralos si ya no se usan.
- Si compilas en tu equipo, sube con el `rsync` de la guía de instalación (§3).

---

## 3. Configuración

### 3.1 `.env`

Compara tus variables con las de `.env.example`:

```bash
diff <(grep -o '^[A-Z_]*' .env | sort) <(grep -o '^[A-Z_]*' .env.example | sort)
```

- **`APP_URL`** (nueva, obligatoria): URL pública con https y sin barra final, p. ej.
  `https://furrguard.srteb.eu`. Sin https la cookie de sesión `__Host-furrguard` no funciona.
- **`DB_PORT`** (nueva, `3306`).
- **`API_RATE_LIMIT_PER_MIN`** (nueva, `6000`): peticiones por minuto por API key.
- **MaxMind** (nuevas): `GEOIP_COUNTRY_DB`, `GEOIP_ASN_DB`, `MAXMIND_ACCOUNT_ID`,
  `MAXMIND_LICENSE_KEY` (cuenta gratuita, ver guía §6).
- `TRUSTED_PROXIES`: solo si hay un proxy inverso propio delante (Cloudflare se detecta solo).
- **Quita `CORS_ALLOWED_ORIGIN`**: ya no se usa.
- Revisa que `DISCORD_REDIRECT_URI` coincide con el portal de Discord y deja `chmod 600 .env`.

### 3.2 `storage/`

Sesiones del panel, límites de peticiones, pausa de ip-api y bases GeoIP viven ahí:

```bash
chown -R furrguard:furrguard storage
chmod -R u+rwX,go-rwx storage
```

### 3.3 nginx

**Sustituye el vhost completo** por el de la guía de instalación (§7). El nuevo solo ejecuta los 7
puntos de entrada PHP, sirve `/admin/assets/` y `/public/assets/` desde `dist/` y bloquea código,
configuración y datos. Guarda y comprueba que CloudPanel lo acepta.

### 3.4 Cron

Deja exactamente estos dos (guía §9) y quita cualquier cron antiguo que llame a scripts que ya no existen:

```cron
17 * * * * php /home/furrguard/htdocs/furrguard.srteb.eu/bin/cleanup.php > /dev/null 2>&1
43 4 * * 2,5 php /home/furrguard/htdocs/furrguard.srteb.eu/bin/geoip-update.php > /dev/null 2>&1
```

---

## 4. Base de datos y GeoIP

```bash
php bin/migrate.php --status   # todas "pendiente"
php bin/migrate.php            # aplica 0001 … 0007 y muestra un resumen de cada una
php bin/geoip-update.php       # descarga GeoLite2-Country y GeoLite2-ASN
```

Si `migrate.php` se corta (conexión, tiempo), vuelve a lanzarlo: las migraciones son idempotentes.
Qué cambia en la base de datos:

- **API key:** la clave en claro pasa a hash SHA-256 (con su prefijo y fecha). **La clave que ya
  usan el plugin y los módulos sigue valiendo.** Si era la clave de ejemplo, se descarta y la API
  responde `503 api_key_not_configured` hasta generar una en **Ajustes** (apartado de la API key). La clave nueva
  solo se muestra una vez: ya no se puede consultar después.
- **Normalización:** UUID, IP, rangos y AS de whitelist y blacklist, y los UUID de `players`, pasan
  a su forma canónica. Si dos filas quedan iguales se fusionan (se conserva la activa más antigua y
  las hijas del baneo descartado pasan al conservado). Los valores que no se pueden normalizar se
  dejan como están (el resumen los cuenta como "inválidas").
- **Esquema:** las fechas pasan de `TIMESTAMP` a `DATETIME` (sin desplazar valores); se eliminan
  `players.is_whitelisted` y `players.is_blacklisted` (el estado se calcula al consultar); se añaden
  índices, la caché de perfiles de Mojang (`minecraft_profiles`), la caché negativa de nombres y la
  ventana de intentos fallidos de FurrSecurity; los registros `login` pasan a `auth`.
- **Tablas huérfanas** `furrsecurity_sessions`, `furrsecurity_verification_tokens` y
  `furrsecurity_verified_staff`: se borran si están vacías; si tienen filas se dejan y se avisa
  ("AVISO: … no se elimina") para que las revises a mano.
- **Ajustes:** se añaden los que falten con su valor por defecto (ver `docs/API.md` §7) y se borran
  `api_key` (en claro), `webhook_url` y `notify_blocks`.
- **Mensajes:** se borran los **11 mensajes antiguos `furrsecurity_*`** (el módulo nunca los leía; usa
  `furr_security_*`) y se añaden los nuevos que falten (`fur_perms_uuid_mismatch`,
  `fur_perms_needs_furrsecurity`, `fur_perms_unavailable`, `notify_mobile_blocked`,
  `notify_player_kicked`, `kick_starting`, `kick_unlicensed`). Tus textos personalizados no se tocan.
- **Sesiones del panel:** la tabla `admin_sessions` se rehace. **Todas las sesiones abiertas se
  invalidan: todos los administradores tienen que volver a entrar.**

Si PHP-FPM tiene OPcache con `validate_timestamps=0`, reinícialo desde CloudPanel.

---

## 5. Primer acceso al panel

1. Entra en `https://furrguard.srteb.eu/admin/` con Discord.
2. **Resumen:** API key configurada, espejo MaxMind `ok` e ip-api `ok`.
3. **Ajustes → FurrSecurity:** revisa la URL de verificación (`APP_URL/verify.php`), la duración de
   sesión, la caducidad del enlace, los intentos máximos y su ventana, y los bloqueos. Estos valores
   ya **no** se leen de los `config.yml` de los módulos.
4. **Ajustes**, migraciones «Blacklist unificada» y «Jugadores premium» (opcional): trabajan por
   lotes de 25, se pueden cancelar y omiten lo que Mojang no pueda confirmar.

---

## 6. Plugin y módulos 2.0.0

Compila los jars (guía §11.1) y sustituye los antiguos. Borra los jars 1.x: dos versiones del mismo
plugin en `plugins/` impiden arrancar.

| Jar | Dónde | Java |
|---|---|---|
| `FurrGuard-2.0.0.jar` (o `FurrGuard-2.0.0-obfuscated.jar`, solo uno) | Velocity | 17+ |
| `furrperms-module-2.0.0.jar` | Velocity | 17+ |
| `FurrSecurity-2.0.0.jar` | Velocity y cada Paper 1.21.4+ | **21** |

### 6.1 Licencia de FurrGuard y Java 21

En su primer arranque FurrGuard 2.0 calcula el identificador de la máquina con la misma fórmula que
la 1.x (sistema, **versión de Java** y dirección del proxy) y lo guarda en `plugins/furrguard/hwid`;
desde entonces ya no cambia. Si en ese mismo arranque cambias también la versión de Java, el
identificador no coincidirá con el de la licencia y habrá que volver a vincularla (el código aparece
en la consola).

- **Si el proxy ya usa Java 21:** cambia los tres jars y arranca.
- **Si no:** arranca una vez con FurrGuard 2.0 (y FurrPerms 2.0) con tu Java actual y **sin**
  FurrSecurity, comprueba que existe `plugins/furrguard/hwid` y que `/fg status` muestra la licencia
  válida, para el proxy, pasa a Java 21 y añade `FurrSecurity-2.0.0.jar`.

### 6.2 `config.yml`

Los `config.yml` antiguos siguen cargando (las claves nuevas toman su valor por defecto), pero
revísalos contra los nuevos. Si prefieres empezar limpio, renombra el tuyo: el plugin crea el
`config.yml` por defecto al arrancar y solo tienes que copiar la URL y la clave.

- **FurrGuard:**
  - `api.timeout` ahora es el plazo **total** de cada petición, reintentos incluidos (defecto
    `8000` ms, máximo `25000`).
  - Nuevas: `api.connect-timeout` (`5000`), `api.allow-insecure-http` (`false`),
    `api.failure-policy` (`deny`), `api.poll-interval` (`5`), `license.discord-url`,
    `notifications.hispanic-countries`.
  - Eliminada: `bypass.permission`.
  - `api.url` debe ser `https://…/api/plugin.php`; un `config.yml` con errores deniega todos los
    logins hasta corregirlo.
- **FurrSecurity:**
  - Eliminadas: `session-duration`, `token-expiration`, `max-failed-attempts` y `verify-url` (ahora
    se configuran en el panel). `alert-times`, `early-verify-time`, `lock.*`, `notify-admins` y
    `admin-permission` quedan como valores iniciales hasta que responde la API.
  - Nueva: `lock.chat` (solo Paper). En los Paper detrás de un Velocity con FurrSecurity, `proxy-mode: true`.
  - Eliminado el permiso `furrsecurity.bypass`.
- **FurrPerms:**
  - La clave pasa a `api.key` (la antigua `api-key` se sigue leyendo) y la URL es configurable
    en `api.url`.
  - Nuevo `commands.protected` para añadir comandos a la lista integrada; los avisos llegan a quien
    tenga `furrperms.notify`.

La API key existente vale para los tres: no hace falta regenerarla.

---

## 7. Después: comprobaciones

```bash
php bin/migrate.php --status     # todas "aplicada"
curl -s -o /dev/null -w '%{http_code}\n' -X POST 'https://furrguard.srteb.eu/api/plugin.php?action=get_settings'   # 401
curl -s -X POST -H 'X-API-Key: fg_…' 'https://furrguard.srteb.eu/api/plugin.php?action=get_settings'               # JSON
```

- Panel: inicias sesión, el **Resumen** carga y las listas (whitelist, blacklist, sanciones) muestran
  tus datos.
- Proxy: `/fg status` → "Plugin ✔ Activo", "Licencia ✔ Válida", "API ✔ Conectada" y la política de
  fallo que esperas. `/fg check <jugador>` devuelve una decisión.
- FurrSecurity: `/fsec status` en el proxy y en un Paper; un miembro del staff entra, recibe el
  enlace, ve la página de confirmación y completa la verificación con Discord.
- FurrPerms: un comando protegido se permite a quien está autorizado y se deniega al resto.
- Sigue la consola de Velocity y el log de errores de PHP (CloudPanel → Logs) durante un rato.

### Volver atrás

Las migraciones no se deshacen: la vuelta a 1.x es **restaurar las copias**. Todo lo cambiado desde la
actualización (baneos, ajustes, sesiones) se pierde.

1. Para el proxy y vuelve a poner los jars, `config.yml` y carpetas de datos 1.x.
2. Web: `git checkout $(cat ~/backups/furrguard-1x-commit.txt)` o restaura el `tar`, y vuelve a poner
   el `.env`, el vhost de nginx y los cron antiguos.
3. Base de datos: **vacíala antes de importar** (borra y crea de nuevo la base desde CloudPanel, o
   borra todas sus tablas). Si queda la tabla `schema_migrations`, una actualización posterior creería
   que las migraciones ya están aplicadas.

   ```bash
   gunzip -c ~/backups/furrguard-1x-FECHA.sql.gz | mysql -u furrguard_user -p furrguard
   ```

---

## 8. Cambios de comportamiento que debes conocer

- **La blacklist gana a la whitelist.** Estar en la whitelist exime de las reglas automáticas (proxy,
  VPN, país…), pero nunca de un baneo. Un baneo por UUID también se aplica si el jugador entra con ese
  nick en modo offline.
- **Sesiones de FurrSecurity atadas a la IP.** Una verificación vale solo desde la IP que pidió el
  enlace (IPv4 exacta o la misma red /64 en IPv6). Si el staff cambia de IP, tiene que verificar otra
  vez. Se puede re-verificar antes de que caduque para renovar la sesión.
- **Verificación con paso de confirmación.** Antes de ir a Discord la página muestra la IP, el país y
  la hora de la solicitud y pide confirmar que es él quien entra. Un intento con otra cuenta de
  Discord cuenta como fallido y, al llegar al máximo dentro de la ventana, banea la cuenta.
- **Fechas en UTC.** Todo se guarda en UTC y el panel lo muestra en hora de Madrid. Las fechas que la
  1.x escribía en hora de Madrid (por ejemplo, la expiración de baneos temporales y de sesiones de
  FurrSecurity) se ven 1–2 h más tarde, y esos baneos temporales duran hasta 2 h más de lo previsto.
  No se pueden corregir automáticamente.
- **`webhook_url` y `notify_blocks` eliminados**, sin sustituto.
- **Ajustes de FurrSecurity desde el panel** (**Ajustes → FurrSecurity**): duración de sesión,
  caducidad del enlace, intentos y ventana, URL de verificación, bloqueos y avisos. El panel manda
  sobre los `config.yml` de los módulos.
- **Política de fallo del plugin.** Por defecto (`api.failure-policy: deny`), si la API no responde
  **nadie entra** ("error de verificación"). Con `allow` entran sin comprobar. FurrGuard también
  deniega mientras arranca, verifica la licencia o tiene un `config.yml` con errores.
- **Los cambios del panel se aplican en segundos.** Tras cambiar listas o reglas, el plugin vuelve a
  comprobar a los conectados y expulsa a quien ahora esté baneado o bloqueado (nunca por un fallo de
  ip-api).
- **FurrPerms exige la verificación de FurrSecurity al staff.** Un nick del staff de FurrSecurity no
  puede usar comandos protegidos sin una sesión verificada desde su IP. Si la entrada de FurrPerms
  tiene UUID, solo vale ese UUID. Si la API no responde, el comando se deniega.
- **FurrSecurity falla en cerrado:** ante cualquier error el staff sigue bloqueado y se reintenta.
- **Panel:** una sola sesión activa por usuario (entrar desde otro sitio cierra la anterior), atada a
  la IP, con caducidad de 8 h y 2 h de inactividad. Los roles sin la sección "IPs" ya no ven IPs.
- **Proveedores por palabra completa:** un patrón ya no coincide dentro de otra palabra ("aws" no
  bloquea "Lawson"); algún proveedor que antes coincidía por casualidad puede dejar de hacerlo. Los
  patrones nuevos necesitan al menos 3 letras o números.
- **Baneos automáticos:** las IPv6 se banean como su red /64 y las IPs privadas nunca. La detección
  de cuenta comprometida solo tiene en cuenta las conexiones que se permitieron.
- **Baneo por nombre:** si Mojang no responde no se banea (se muestra un error) para no confundir una
  cuenta premium con una offline.

---

## 9. Mejoras de seguridad

- **API key protegida:** solo se guarda su hash, se muestra una sola vez, la clave de ejemplo
  nunca vale y hay límites de peticiones por clave y de intentos fallidos por IP.
- **Panel:** sesiones comprobadas en el servidor en cada petición, revocables, atadas a la IP y con
  caducidad; protección CSRF y de origen; política de contenido estricta sin fuentes externas; cookie
  de sesión solo por https.
- **Permisos en el servidor:** cada acción del panel comprueba el rol y lo no previsto se rechaza; las
  IPs se ocultan a quien no tiene permiso y todo cambio queda registrado.
- **Verificación del staff:** confirmación explícita, enlace que caduca, sesión ligada a la IP,
  límite de intentos con baneo automático y pantalla de Discord que muestra siempre con qué cuenta
  se autoriza.
- **Plugin y módulos:** fallan en cerrado, exigen https, no siguen redirecciones, nunca registran la
  clave ni el contenido de las peticiones y tratan como texto plano todo lo que llega de fuera.
  FurrPerms reconoce los comandos protegidos aunque se escriban con otro alias o dentro de otros
  comandos.
- **Servidor web:** solo 7 archivos PHP ejecutables; configuración, código, datos y copias quedan
  inaccesibles.
- **Datos de entrada:** toda identidad (UUID, IP, rango, AS, nick) se valida y normaliza; la IP real
  del cliente solo se toma de proxies de confianza o de Cloudflare.
- **Disponibilidad:** el espejo local de MaxMind mantiene los bloqueos por país, continente y
  proveedor aunque ip-api caiga, y el uso de ip-api respeta su cuota.
- **Fechas coherentes en UTC**, para que expiraciones y sesiones duren lo configurado.
