# FurrGuard dentro del panel de Pterodactyl

Guía para integrar el panel de FurrGuard como una página más del panel de Pterodactyl
(tema Luna con la capa de personalización de Tebby), al estilo de la integración del Vault.
Al terminar, los usuarios del panel que tengan el permiso **FurrGuard** ven un botón
**FurrGuard** en la barra de navegación de la portada, entran con Discord y usan todas las
secciones de FurrGuard (resumen, jugadores, conexiones, IPs, whitelist, blacklist, sanciones,
proveedores, países, continentes, FurrPerms, FurrSecurity, mensajes, registro, ajustes y
usuarios) sin salir del panel, con el aspecto del tema y totalmente responsive.

FurrGuard y Pterodactyl corren en **máquinas distintas**. Esta guía tiene por eso dos partes
bien separadas: lo que se hace en el servidor de FurrGuard (parte A) y lo que se hace en el
servidor del panel (parte B). Ninguna de las dos necesita acceso SSH a la otra: solo hablan
por HTTPS.

> Contrato técnico del puente: [`API.md` §9](API.md#9-puente-con-el-panel-de-pterodactyl--post-apipanelphp).
> Instalación de FurrGuard en sí: [`INSTALACION.md`](INSTALACION.md) o
> [`INSTALACION_CLOUDPANEL.md`](INSTALACION_CLOUDPANEL.md). Esta guía da por hecho que FurrGuard
> ya funciona (panel propio incluido) y que el panel de Pterodactyl ya tiene el tema Luna con
> la personalización de Tebby.

---

## 1. Cómo funciona

```
                 ┌──────────────────────────────┐          ┌──────────────────────────────┐
  Navegador ───► │ Panel de Pterodactyl (Laravel)│ ───────► │ FurrGuard                     │
  sesión del     │ console.tebby.lgbt            │  HTTPS   │ furrguard.srteb.eu            │
  panel          │ /furrguard (React)            │  firmado │ /api/panel.php                │
                 │ /api/client/furrguard/...     │  HMAC    │ (mismas acciones que /admin)  │
                 └──────────────────────────────┘          └──────────────────────────────┘
                              │                                          │
                              └─────────── Discord OAuth ────────────────┘
                                 (la aplicación de Discord es la de FurrGuard)
```

- **El navegador solo habla con el panel.** La página `/furrguard` es React dentro del propio
  panel y llama a `/api/client/furrguard/...` con la sesión normal de Pterodactyl.
- **El panel reenvía cada acción a FurrGuard** (`POST /api/panel.php`) firmando la petición con
  una clave compartida (HMAC-SHA256 con marca de tiempo y nonce, como hace con el Vault). Sin
  esa clave FurrGuard responde 404, como si el puente no existiera.
- **Quién es el usuario lo decide Discord y FurrGuard, no el panel.** Al entrar en la página, el
  panel manda al navegador a Discord; Discord vuelve al panel; el panel entrega el código a
  FurrGuard, que lo canjea con **su** aplicación de Discord y abre una sesión con el rol de esa
  cuenta (founder, owner, manager, sradmin o admin). Las secciones que ve cada rol y qué puede
  hacer son exactamente las del panel propio de FurrGuard: no hay una segunda lista de
  permisos que mantener.
- **El token de sesión de FurrGuard nunca llega al navegador.** Vive en la sesión de servidor
  de Laravel; el navegador solo ve el nombre, el avatar, el rol y las secciones permitidas.
- **Dos llaves para entrar.** Un usuario necesita (1) el permiso **FurrGuard** en su cuenta del
  panel, que se activa desde *Admin → Users*, y (2) que su cuenta de Discord tenga rol en
  FurrGuard. Sin lo primero no ve el botón; sin lo segundo, tras entrar con Discord ve «Sin
  acceso a FurrGuard».
- **La auditoría sigue siendo la de FurrGuard.** Cada acción queda en el registro de FurrGuard
  con la IP real del navegador (el panel la manda en una cabecera y FurrGuard la adopta) y el
  inicio de sesión anota además desde qué usuario del panel se hizo.

### Qué se instala en cada máquina

| Máquina | Piezas | Qué hacen |
|---|---|---|
| **FurrGuard** | `api/panel.php`, `includes/panel_bridge.php`, migración `0010_panel_nonces.php`, tres variables en `.env`, una línea en nginx | El puente: comprueba la firma del panel, hace el OAuth con Discord, abre sesiones y despacha las acciones del panel propio |
| **Pterodactyl** | `config/furrguard.php`, `app/Services/FurrGuard/*`, `app/Http/Controllers/Base/FurrGuardAuthController.php`, `app/Http/Controllers/Api/Client/FurrGuardController.php`, `app/Http/Middleware/RequireFurrGuardAccess.php`, migración `add_furrguard_access_to_users_table`, rutas, la columna `users.furrguard_access` y la página React `resources/scripts/components/furrguard/*` | El botón, la página, el login con Discord y el proxy firmado hacia FurrGuard |

---

## 2. Antes de empezar

Ten a mano:

- **Acceso SSH** a las dos máquinas (usuario con `sudo`).
- **El dominio del panel** (p. ej. `https://console.tebby.lgbt`) y **el de FurrGuard**
  (p. ej. `https://furrguard.srteb.eu`). Los dos con HTTPS válido: el panel comprueba el
  certificado de FurrGuard al conectar y Discord solo redirige a URLs https.
- **Acceso al portal de desarrolladores de Discord** de la aplicación que ya usa FurrGuard
  (la de `DISCORD_CLIENT_ID` en su `.env`). Hay que añadirle una URL de redirección.
- **Una clave compartida nueva.** Genérala en cualquiera de las dos máquinas y cópiala: es la
  única cosa que las dos tienen que tener igual.

  ```bash
  openssl rand -hex 32
  ```

- **Los relojes en hora.** La firma caduca a los 120 segundos: si el reloj de una máquina va
  más de dos minutos desviado, todas las peticiones fallan con «FurrGuard ha rechazado la
  conexión del panel». Comprueba en las dos:

  ```bash
  timedatectl        # "System clock synchronized: yes"
  ```

  Si pone `no`: `sudo timedatectl set-ntp true` (o instala `chrony`).

- **Conectividad del panel hacia FurrGuard.** Desde la máquina del panel:

  ```bash
  curl -sS -o /dev/null -w '%{http_code}\n' https://furrguard.srteb.eu/api/panel.php
  ```

  Ahora mismo tiene que devolver `404` (el puente aún no existe o no está configurado). Lo
  importante es que no sea un error de conexión ni de certificado. Si FurrGuard está detrás de
  Cloudflare con reglas de firewall, deja pasar la IP del panel.

---

## 3. Parte A — servidor de FurrGuard

Todo lo de esta parte se hace en la máquina de FurrGuard, en `/var/www/furrguard` (o la ruta
que uses; en CloudPanel, la raíz del sitio).

### A.1 Actualizar el código

El puente viene con FurrGuard 2.0 a partir de este cambio. Si tu copia es anterior, actualiza
como en [`INSTALACION.md` §19](INSTALACION.md#19-mantenimiento) («Actualizar dentro de 2.x»).
Tienen que existir:

```bash
ls api/panel.php includes/panel_bridge.php database/migrations/0010_panel_nonces.php
```

### A.2 Migración

Crea la tabla `panel_nonces` (donde se anotan las firmas ya usadas para que ninguna petición
valga dos veces):

```bash
cd /var/www/furrguard
sudo runuser -u furrguard -- php bin/migrate.php --status   # 0010_panel_nonces «pendiente»
sudo runuser -u furrguard -- php bin/migrate.php
```

(En CloudPanel, con el usuario del sitio: `php bin/migrate.php`.)

### A.3 Variables de entorno

Añade al `.env` de FurrGuard (`chmod 600`, nunca lo subas al repositorio):

```dotenv
# ── Puente con el panel de Pterodactyl ──
PTERODACTYL_URL=https://console.tebby.lgbt
PTERODACTYL_PANEL_KEY=<la clave de openssl rand -hex 32>
PTERODACTYL_PANEL_IPS=
```

| Variable | Qué es |
|---|---|
| `PTERODACTYL_URL` | Origen del panel, esquema y host, **sin barra final**. Discord devolverá al navegador a `PTERODACTYL_URL/furrguard/callback`, así que tiene que ser exactamente el dominio con el que los usuarios abren el panel. |
| `PTERODACTYL_PANEL_KEY` | La clave compartida. La misma cadena irá en `FURRGUARD_PANEL_KEY` del panel. Mientras esté vacía (o `PTERODACTYL_URL` lo esté), `api/panel.php` responde 404. |
| `PTERODACTYL_PANEL_IPS` | Opcional. IPs o rangos CIDR separados por comas desde los que se acepta el puente (la IP pública del servidor del panel). Si se define, cualquier otra IP recibe 403 aunque tenga la clave. Déjala vacía si el panel no tiene IP fija o si FurrGuard está detrás de Cloudflare y no quieres depender de ello. |

Una variable definida en el entorno real (PHP-FPM, systemd) tiene prioridad sobre `.env`, como
el resto de la configuración.

### A.4 nginx: el punto de entrada

FurrGuard solo ejecuta una lista cerrada de archivos PHP; todo lo demás es 404. Hay que añadir
`panel` a esa lista. En `/etc/nginx/sites-available/furrguard` (o en el vhost de CloudPanel)
busca la `location` de los puntos de entrada y déjala así:

```nginx
    location ~ ^/(index|verify)\.php$|^/admin/(index|api|callback)\.php$|^/api/(plugin|furrsecurity|panel)\.php$ {
```

(`deploy/furrguard-nginx.conf` ya trae la línea nueva; si instalaste copiando ese archivo,
basta con volver a copiarlo.) Después:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### A.5 Discord: la URL de vuelta del panel

El canje del código lo hace FurrGuard con su propia aplicación de Discord, pero Discord
devuelve al navegador **al panel**, no a FurrGuard. Esa URL tiene que estar registrada:

1. <https://discord.com/developers/applications> → la aplicación de FurrGuard → **OAuth2**.
2. En **Redirects**, añade (sin quitar la que ya hay del panel propio):

   ```
   https://console.tebby.lgbt/furrguard/callback
   ```

   Exactamente `PTERODACTYL_URL` + `/furrguard/callback`, sin barra final ni parámetros.
3. **Save changes.**

Si falta o no coincide, Discord muestra «Invalid OAuth2 redirect_uri» al pulsar «Entrar con
Discord».

### A.6 Comprobar la parte A

Desde la propia máquina de FurrGuard:

```bash
# Sin firma: el puente existe pero rechaza la petición
curl -sS -X POST https://furrguard.srteb.eu/api/panel.php -H 'Content-Type: application/json' -d '{"action":"session"}'
```

Tiene que responder `{"success":false,"error":"Firma del panel inválida. …","code":"panel_signature"}`
con estado 401. Si responde 404, revisa A.3 (variables vacías o `.env` no leído) y A.4 (nginx).
Con `PTERODACTYL_PANEL_IPS` definida y probando desde otra IP verás 403 `panel_ip`: es lo
esperado.

Cada fallo de firma cuenta en un límite de 60 por minuto e IP de origen, así que no hagas
bucles de pruebas.

---

## 4. Parte B — servidor del panel de Pterodactyl

Todo lo de esta parte se hace en la máquina del panel, en `/var/www/pterodactyl`. Es el mismo
procedimiento que cualquier otro cambio del tema (ver el `CLAUDE.md` del tema, §6): los
archivos se suben, se migra, se limpian cachés y, como hay cambios en `.tsx`, se recompila el
frontend con `yarn build:production` (2–8 minutos con el panel en mantenimiento).

### B.1 Archivos que hay que subir

Si generas el paquete desde el repositorio del tema (`Tema2-2-1`), el `git diff` contra el
baseline ya los incluye. Si prefieres subirlos a mano (FTP), esta es la lista completa de la
integración; las rutas son relativas a `/var/www/pterodactyl`:

```
config/furrguard.php
database/migrations/2026_09_15_000000_add_furrguard_access_to_users_table.php
app/Exceptions/FurrGuard/FurrGuardException.php
app/Services/FurrGuard/FurrGuardClient.php
app/Services/FurrGuard/FurrGuardSessionStore.php
app/Http/Middleware/RequireFurrGuardAccess.php
app/Http/Controllers/Base/FurrGuardAuthController.php
app/Http/Controllers/Api/Client/FurrGuardController.php
app/Http/Requests/Api/Client/FurrGuard/ActionRequest.php
app/Http/Requests/Admin/UserFormRequest.php            (modificado: acepta furrguard_access)
app/Http/Requests/Admin/NewUserFormRequest.php         (modificado)
app/Models/User.php                                    (modificado: campo furrguard_access)
routes/base.php                                        (modificado: /furrguard/login y /furrguard/callback)
routes/api-client.php                                  (modificado: /api/client/furrguard/*)
resources/views/admin/users/view.blade.php             (modificado: selector «FurrGuard»)
resources/views/admin/users/new.blade.php              (modificado)
resources/lang/es/dashboard.php                        (modificado: bloque furrguard)
resources/lang/en/dashboard.php                        (modificado)
resources/scripts/state/user.ts                        (modificado: furrguardAccess)
resources/scripts/components/App.tsx                   (modificado)
resources/scripts/routers/DashboardRouter.tsx          (modificado: ruta /furrguard)
resources/scripts/components/layout/Sidebar.tsx        (modificado: botón FurrGuard)
resources/scripts/api/furrguard/                       (client.ts, types.ts)
resources/scripts/components/furrguard/                (toda la carpeta: página, vistas, diálogos, hooks, lib)
```

Los archivos «modificados» son versiones completas: sustituyen a los que hay. Ojo con el
propietario si subes por FTP: el `chown` del final no es opcional.

Para generar el paquete desde el repositorio del tema:

```bash
cd Tema2-2-1
git diff --name-only 0c5e279 HEAD -- Product | sed 's|^Product/||' > /tmp/files.txt
cd Product && tar --format=ustar -czf ../luna-panel-changes.tar.gz -T /tmp/files.txt
scp ../luna-panel-changes.tar.gz usuario@panel:~/
```

### B.2 Variables de entorno del panel

Añade al `.env` de Pterodactyl (`/var/www/pterodactyl/.env`):

```dotenv
# FurrGuard (config/furrguard.php)
FURRGUARD_URL=https://furrguard.srteb.eu
FURRGUARD_PANEL_KEY=<la misma clave que PTERODACTYL_PANEL_KEY en FurrGuard>
FURRGUARD_TIMEOUT=20
```

| Variable | Qué es |
|---|---|
| `FURRGUARD_URL` | Origen de FurrGuard, esquema y host, sin barra final. El panel le añade `/api/panel.php`. |
| `FURRGUARD_PANEL_KEY` | La clave compartida. Con ella o con `FURRGUARD_URL` vacías, el botón no aparece y las rutas responden 404: es la forma de desactivar la integración sin tocar código. |
| `FURRGUARD_TIMEOUT` | Segundos de espera por petición (por defecto 20). FurrGuard consulta a Discord y a Mojang dentro de ese tiempo, no lo bajes de 10. |

### B.3 Desplegar

```bash
cd /var/www/pterodactyl
php artisan down

# 1. Archivos (tarball o FTP)
tar -xzf ~/luna-panel-changes.tar.gz -C /var/www/pterodactyl

# 2. Columna users.furrguard_access
php artisan migrate --force

# 3. Cachés: la config nueva y las rutas nuevas no se ven hasta limpiar
php artisan config:clear && php artisan route:clear && php artisan view:clear

# 4. Frontend (hay .tsx nuevos): 2–8 min
yarn install
NODE_OPTIONS="--openssl-legacy-provider --max-old-space-size=4096" yarn build:production

# 5. Propietario y arriba
chown -R www-data:www-data /var/www/pterodactyl
php artisan up
```

`route:clear` es obligatorio: sin él, `/furrguard/login` y `/api/client/furrguard` dan 404
aunque los archivos estén. Si el build muere por memoria, añade swap (ver «Build OOM» en el
`CLAUDE.md` del tema) y **no levantes el panel hasta que compile**, porque `build:production`
borra los assets antiguos al empezar.

### B.4 Comprobar la parte B

```bash
cd /var/www/pterodactyl
php artisan route:list | grep furrguard
```

Tiene que listar cinco rutas:

```
GET|HEAD  furrguard/login ................ furrguard.login
GET|HEAD  furrguard/callback ............. furrguard.callback
GET|HEAD  api/client/furrguard ........... api:client.furrguard.index
POST      api/client/furrguard/logout .... api:client.furrguard.logout
POST      api/client/furrguard/action .... api:client.furrguard.action
```

Y que el build incluye la página (la clave i18n sobrevive a la minificación):

```bash
grep -l "furrguard.login.button" public/assets/*.js
```

Si no devuelve nada, el build no incluye los cambios o `resources/scripts/components/furrguard/`
no llegó entera.

---

## 5. Dar acceso a un usuario

1. En el panel, como administrador: **Admin → Users → (el usuario) → Permissions**.
2. **FurrGuard: Yes** → *Update User*.
3. El usuario recarga el panel: aparece **FurrGuard** en la barra de navegación de la portada
   (en escritorio junto a *Servers*; en móvil, en el menú lateral o en la barra inferior según
   el diseño elegido en el editor de temas).
4. Al abrirla: **Entrar con Discord** → Discord pide confirmar la cuenta → vuelve al panel ya
   dentro, con su rol de FurrGuard en la cabecera y solo las secciones de ese rol.

Para retirar el acceso: **FurrGuard: No**. El botón desaparece y las rutas responden 404 para
ese usuario; si además quieres cortar una sesión ya abierta en FurrGuard, revoca su usuario
desde FurrGuard.

Al crear un usuario nuevo (*Admin → Users → Create New*) el mismo selector está disponible.
Los administradores (`root_admin`) **no** tienen el permiso por defecto: se activa por usuario,
también para ellos.

### Lo que ve el usuario

- **Cabecera:** título, rol de FurrGuard, cuenta de Discord con botón para cerrar esa sesión
  (la del panel no se toca) y, si su rol ve IPs, un interruptor **IPs visibles / IPs ocultas**
  para compartir pantalla sin enseñar direcciones.
- **Pestañas:** las secciones de su rol, agrupadas como en el panel propio (General ·
  Jugadores · Protección · Filtros · Módulos · Sistema). En pantallas estrechas la barra se
  desplaza en horizontal.
- **Listas:** búsqueda, filtros y paginación en la URL (al volver atrás se conserva lo que
  estaba filtrado), tablas con desplazamiento horizontal en móvil, diálogos para añadir, editar,
  banear y confirmar.
- **Sesión:** la de FurrGuard dura 8 horas y caduca a las 2 de inactividad. Cuando caduca, la
  página vuelve a mostrar «Entrar con Discord» con un aviso; los datos no se pierden porque
  no hay nada que guardar en el navegador.

---

## 6. Comprobación final de punta a punta

Con un usuario que tenga el permiso y una cuenta de Discord con rol en FurrGuard:

1. Abre el panel → botón **FurrGuard** → **Entrar con Discord** → autoriza.
2. Debe volver a `/furrguard` dentro, con el rol en la cabecera y el **Resumen** cargado.
3. En FurrGuard, **Registro** (o `activity_logs`): una fila `auth · login` con «desde
   Pterodactyl (usuario del panel N:nombre)» y la IP del navegador, no la del panel.
4. Haz un cambio pequeño (p. ej. añade y quita una entrada de whitelist): aparece al momento
   en el panel propio de FurrGuard y en su registro.
5. Cierra la sesión de Discord desde la cabecera: la fila de `admin_sessions` queda revocada y
   la página vuelve al botón.

---

## 7. Problemas frecuentes

| Síntoma | Causa | Qué hacer |
|---|---|---|
| No aparece el botón FurrGuard | El usuario no tiene el permiso, o `FURRGUARD_URL`/`FURRGUARD_PANEL_KEY` vacías, o el build no incluyó los cambios | *Admin → Users*; `.env` del panel + `php artisan config:clear`; B.4 |
| El botón lleva a una página 404 | `route:clear` sin ejecutar, o el permiso se quitó | `php artisan route:clear`; B.4 |
| «Entrar con Discord» vuelve con «No se pudo conectar con FurrGuard» | El panel no llega a `FURRGUARD_URL` (DNS, TLS, firewall, Cloudflare) o FurrGuard responde 404 (A.3/A.4) | `curl` desde el panel como en §2; `storage/logs/laravel.log` («Could not reach FurrGuard») |
| «FurrGuard ha rechazado la conexión del panel. Avisa a un administrador.» | Claves distintas, reloj desviado más de 2 min, o IP del panel fuera de `PTERODACTYL_PANEL_IPS` | `storage/logs/laravel.log` dice cuál (`panel_signature` / `panel_ip`); `timedatectl` en ambas; `/var/log/nginx/furrguard-error.log` en FurrGuard |
| Discord: «Invalid OAuth2 redirect_uri» | Falta `PTERODACTYL_URL/furrguard/callback` en la aplicación de Discord, o `PTERODACTYL_URL` no es el dominio real del panel | A.5 y A.3 |
| Tras Discord: «Discord no pudo completar el inicio de sesión» | El `state` no coincide (dos pestañas a la vez, más de 10 min en Discord) o FurrGuard no pudo canjear el código (`DISCORD_CLIENT_SECRET`) | Repetir; `furrguard-error.log` («FurrGuard Discord: … respondió HTTP …») |
| «Sin acceso a FurrGuard» tras entrar | La cuenta de Discord elegida no tiene rol en FurrGuard | «Usar otra cuenta» |
| «Demasiados intentos de inicio de sesión» | Más de 10 canjes en 5 minutos desde el mismo navegador | Esperar |
| Todo funciona y a las 8 h pide entrar otra vez | Caducidad normal de la sesión de FurrGuard | Nada |
| Un cambio de rol en FurrGuard no se refleja | La página relee el rol al cargar; las pestañas no cambian en caliente | Recargar la página |
| `admin/api.php` del panel propio de FurrGuard pide login tras entrar desde Pterodactyl | Igual que con dos navegadores: entrar de nuevo revoca la sesión anterior de esa cuenta | Esperado |

Dónde mirar:

- **Panel:** `/var/www/pterodactyl/storage/logs/laravel.log`. Los errores del puente empiezan
  por «FurrGuard» y llevan el código (`panel_signature`, `unreachable`, `invalid_response`…).
- **FurrGuard:** `/var/log/nginx/furrguard-error.log` (errores de PHP, con prefijo «FurrGuard
  puente Pterodactyl:») y el **Registro** del panel (accesos y acciones).

---

## 8. Seguridad: qué protege qué

- **Clave compartida y firma por petición.** Cada petición del panel lleva HMAC-SHA256 de
  método, ruta, marca de tiempo, nonce y hash del cuerpo. Un nonce solo vale una vez y una
  marca de tiempo solo 120 s: capturar una petición no sirve para repetirla.
- **Lista de IPs opcional.** Con `PTERODACTYL_PANEL_IPS` la clave sola no basta: además hay
  que venir desde el servidor del panel.
- **El token de FurrGuard no sale del servidor del panel.** Está en la sesión de Laravel, en
  el lado del servidor; el navegador nunca lo ve ni podría llamar a FurrGuard directamente
  (sin la clave del panel recibiría 401).
- **Dos permisos independientes.** El del panel (quién ve el botón) y el rol de la cuenta de
  Discord en FurrGuard (qué puede hacer). Quitar cualquiera de los dos cierra la puerta.
- **Mismos límites que el panel propio:** 300 acciones por minuto y usuario, 10 canjes de
  Discord cada 5 minutos por navegador, 60 firmas inválidas por minuto e IP.
- **Auditoría real.** FurrGuard anota cada acción con la IP del navegador y, al entrar, con el
  usuario del panel desde el que se hizo.

---

## 9. Actualizaciones

- **Actualizar FurrGuard:** el puente forma parte del código; solo hay que migrar si hay
  migraciones nuevas. Las variables `PTERODACTYL_*` del `.env` se conservan.
- **Actualizar el tema Luna:** su instalador reemplaza `app/`, `resources/`, `routes/` y
  `database/migrations/` enteros y **borra la integración** (igual que borra el Vault). Reaplica
  el paquete del tema (B.1/B.3) y recompila. Ver el `CLAUDE.md` del tema, §7.
- **Actualizar el panel Pterodactyl:** puede pisar `routes/` y `app/Models/User.php`. Tras
  actualizar, `php artisan route:list | grep furrguard` tiene que seguir listando las cinco
  rutas y *Admin → Users* debe seguir mostrando el selector **FurrGuard**.
- **Cambiar la clave compartida:** cámbiala en los dos `.env` (FurrGuard y panel), luego
  `php artisan config:clear` en el panel. Las sesiones abiertas siguen valiendo (el token no
  depende de la clave).
- **Cambiar de dominio el panel:** actualiza `PTERODACTYL_URL` en FurrGuard **y** la URL de
  redirección en la aplicación de Discord.

## 10. Desactivar

- **Temporalmente:** vacía `FURRGUARD_PANEL_KEY` en el panel y `php artisan config:clear`. El
  botón desaparece para todos y las rutas responden 404. FurrGuard puede quedarse como está.
- **Del todo:** además vacía `PTERODACTYL_PANEL_KEY` en FurrGuard (el puente vuelve a ser 404)
  y quita la URL de redirección del panel en Discord. La columna `users.furrguard_access` y la
  tabla `panel_nonces` no molestan; si quieres, `php artisan migrate:rollback --step=1` en el
  panel elimina la columna.
