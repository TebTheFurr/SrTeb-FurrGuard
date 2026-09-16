# Luna Pterodactyl Theme — personalización Tebby Services S.L.

Tema Luna 2.2.1 (Buzz Development) para el panel Pterodactyl de **tebby.lgbt**, con
una capa de personalización propia encima. Servidor de Minecraft.

Producción corre **Panel 1.14.1** y **Wings 1.13.2**.

> **Este directorio NO es el panel en producción.** Es la copia de trabajo desde la
> que se generan los paquetes que se despliegan en `/var/www/pterodactyl`.

> ⚠️ **Hay una pieza fuera del panel.** Desde el tamaño de carpetas mantenemos también
> un **fork de Wings** (§5). Cualquier actualización de Wings lo borra. Ver §7.

---

## 0. Estructura del directorio de trabajo

```
luna-pterodactyl-theme-2-2-1/
├── CLAUDE.md                    ← este archivo (copia commiteada en Tema2-2-1/CLAUDE.md)
├── GUIA-TAMANO-CARPETAS.md      ← guia de despliegue paso a paso de la feature de §5
├── Tema2-2-1/                   ← EL REPO GIT. Aqui se trabaja
│   ├── .git/                       baseline en 0c5e279 (Luna 2.2.1 virgen)
│   ├── Product/                    mapea 1:1 con /var/www/pterodactyl
│   └── install_script/
├── panel-release-v1.14.1/       ← copia de referencia, solo lectura
├── wings-release-v1.13.2/       ← fuente de Wings CON nuestro parche aplicado (§5)
└── vault/                       ← Tebby Vault 2: proyecto APARTE (copias en vault01).
                                   Tiene su propio vault/CLAUDE.md; no comparte nada con el panel
```

Las dos copias `*-release-*` son fuentes upstream para consultar y comparar. **No las
edites** salvo el parche de Wings, que vive ahí a propósito.

---

## 1. Arquitectura

`Tema2-2-1/Product/` mapea 1:1 con la raíz del panel (`Product/app/…` → `/var/www/pterodactyl/app/…`).

Son **dos stacks distintos** que comparten las mismas variables CSS de tema:

| Zona | Stack | Dónde | Requiere build |
|---|---|---|---|
| **Área de cliente** | React 16 + TypeScript + Tailwind + styled-components/twin.macro, webpack | `resources/scripts/` | **Sí** |
| **Panel admin** | AdminLTE 2 + Bootstrap 3 + Blade | `resources/views/admin/`, `public/themes/pterodactyl/css/admin/` | No |
| **Backend** | Laravel | `app/`, `database/migrations/` | No |

Tamaño: 226 `.tsx`, ~1.023 `.php`, 71 vistas Blade de admin.

### Variables de tema (el puente entre ambos stacks)

Definidas por el editor de temas, guardadas en la tabla `theme_settings`, servidas por
`app/Http/ViewComposers/AssetComposer.php` e inyectadas como CSS custom properties tanto
en el área de cliente como en `resources/views/layouts/admin.blade.php`:

```
--color-primary            --color-background
--color-secondary          --color-background-secondary
--color-neutral            --border-radius
--color-base   (texto principal)
--color-muted  (texto secundario)
--color-inverted (texto terciario — es el MÁS apagado, no lo uses para títulos)
```

**Regla:** nunca hardcodees colores. Usa estas variables y el tema seguirá la paleta y el
modo claro/oscuro automáticamente. Únicas excepciones permitidas: los colores semánticos
de estado (`#ef4444` peligro, `#eab308` aviso, `#22c55e` éxito).

---

## 2. Capa de diseño compartida

`resources/scripts/components/elements/ui/` — **creada por nosotros, no venía en Luna.**
Luna había abandonado sus primitivas originales (`TitledGreyBox` se usaba en 1 archivo,
`SubNavigation` en ninguno) y cada página llevaba estilos inline propios.

| Primitiva | Uso |
|---|---|
| `Panel` + `PanelHeader/Body/List` | Contenedor de sección con cabecera (icono, título, subtítulo, acciones) |
| `StatTile` | Métrica: icono + etiqueta + usado/total + barra de progreso + niveles de alarma. Prop `details` → tooltip (hover y foco) |
| `StatDetails` | Contenido del tooltip de `StatTile`: lectura exacta + filas de contexto (límite, % del límite, disponible, última lectura) |
| `AnimatedNumber` | Número que se desliza hasta cada valor nuevo (rAF, escribe el texto directo en el DOM; respeta *reduced motion*) |
| `motion.ts` | `VALUE_TRANSITION_MS` (900 ms) y la curva que comparten número animado y barra |
| `MetaChip` | Chip icono+texto para metadatos (nodo, ubicación, estado) |
| `DataField` | Campo etiquetado en caja, con botón de copiar opcional |
| `PageHeader` | Título de página + descripción + chips + acciones |
| `tokens.ts` | `usageLevel()` (normal / warning ≥80% / danger ≥90%), `usageColor()`, `percentOf()`, `UNLIMITED` |

**Al tocar cualquier página, usa estas primitivas antes de escribir estilos nuevos.**

### Páginas ya migradas

Consola · Red · Copias · Bases de datos · Usuarios · Programaciones · Archivos · Arranque ·
Ajustes · Actividad · Dashboard · Cuenta · tarjeta de servidor (`ServerRow`) · `PlayerCountWidget`

---

## 3. Footer configurable

El campo "Copyright Text" del editor pasó a ser un **footer HTML + CSS completo**.

- **Ruta de config:** `general.copyright_text` (HTML) y `general.footer_custom_css` (CSS)
- **UI:** `Admin → Settings → Theme → General → Footer` (dos textareas de código)
- **Render:** `components/elements/PanelFooter.tsx` en el cliente; `layouts/admin.blade.php` en el admin
- **Wrapper:** `<div class="luna-footer" data-variant="page|auth">` — escopa tu CSS a `.luna-footer`
- **Token `{year}`** → año actual (sustituido en JS en el cliente, en PHP en el admin)
- **Defaults:** `app/Helpers/DefaultFooter.php` (footer Tebby: logo base64, botón X, botón Status → `status.tebby.lgbt`, badge "Hosted in Europe")

### Seguridad — no lo saltes

`app/Helpers/FooterSanitizer.php` limpia el HTML/CSS **en cada render** (no solo al guardar),
porque el footer lo ve todo visitante y un admin con acceso solo a la pestaña General podría
inyectar XSS almacenado.

Se eliminan: `<script>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<base>`, `<meta>`,
`<link>`, handlers `on*=`, URLs `javascript:`/`vbscript:`/`data:text/html`. En CSS: breakouts
de `</style>`, `expression()` y URLs de script. `data:image/…` se preserva (el logo).

Validado con 17 tests de lógica de regex. Si tocas el sanitizador, revalida.

---

## 4. Tema del panel admin

`public/themes/pterodactyl/css/admin/theme-overrides.css` — **23 KB, 133 reglas.**

Una sola hoja reescribe AdminLTE 2 / Bootstrap 3 contra las variables del tema y cubre las
**71 vistas admin sin tocar ninguna**. Cubre: shell, header, sidebar, `.box`, tablas,
formularios, Select2, botones, tabs, paginación, alertas, callouts, labels, modales,
dropdowns, tooltips, `pre`/`code`, scrollbars y footer.

Se carga *después* de `admin.min.css` y `skin-blue.min.css`, por eso usa `!important`.

### ⚠️ Exención del editor de temas

`admin/theme-editor.css` (164 KB) trae su propio sistema `.te-*` con variables `--editor-*`,
y el editor **extiende `layouts.admin`**. Las reglas genéricas de `input`/`textarea`/`select`
con `!important` le repintarían los campos.

Hay una sección de exención al final de `theme-overrides.css` con selectores de la misma
especificidad colocados después. **Si añades reglas genéricas de elemento, extiende esa
exención** o romperás el editor.

---

## 5. Fork de Wings — tamaño de carpetas

**La única pieza que vive fuera del panel.** Guía completa en `GUIA-TAMANO-CARPETAS.md`.

### El problema

El listado de archivos de Wings devuelve, para una carpeta, el tamaño de su **inodo**
(4096 en ext4), no el de su contenido — se ve en `server/filesystem/stat.go`, donde el
`MarshalJSON` hace `Size: s.Size()`. Por eso el gestor de archivos pintaba `—`: mostrar
ese 4096 sería mentir.

Wings **sí** sabe recorrer un árbol y sumar (`Filesystem.DirectorySize()` en
`server/filesystem/disk_space.go:162` — es como calcula el disco de cada servidor), pero
no lo expone por HTTP. Verificado en el `router.go` de la v1.13.2: no hay endpoint de
tamaño ni de búsqueda.

### El parche — 13 líneas

`wings-release-v1.13.2/router/router_server_files.go` (handler) y `router/router.go`
(una línea registrando la ruta). También está como `wings-directory-size.patch`, que
aplica limpio sobre un v1.13.2 virgen.

```
GET /api/servers/{uuid}/files/directory-size?directory=/plugins → {"size": 12345678}
```

Al reutilizar `DirectorySize()` hereda gratis tres cosas que si no habría que escribir:
`SafePath()` (un `../../etc` no se sale del volumen), cuenta **solo ficheros regulares**
(no sigue symlinks → sin bucles infinitos) y **deduplica hard links por inodo**.

### Lado panel

| Archivo | Qué hace |
|---|---|
| `DaemonFileRepository::getDirectorySize()` | Proxy a Wings |
| `FileController::directorySize()` | Acción + caché de 60 s |
| `Files/DirectorySizeRequest.php` | Permiso `file.read` |
| `routes/api-client.php` | `GET /files/directory-size` |

Un subusuario con la carpeta restringida recibe **404**: no puede ni saber cuánto pesa.

### Lado tema

`plugins/useDirectorySizes.ts` resuelve las carpetas visibles **de 4 en 4**, con caché de
60 s en navegador. `components/server/files/DirectorySizeContext.tsx` reparte los valores
a `FileObjectRow` y a la tarjeta de cuadrícula.

**Tope de 100 carpetas por directorio.** El API de cliente permite 256 peticiones/minuto
por usuario (`config/http.php`); sin tope, una carpeta con 300 subcarpetas se comería el
presupuesto de una sentada.

### Por qué la caché no es opcional

`updateCachedDiskUsage()` toma `fs.mu.Lock()` para no lanzar dos recorridos de disco a la
vez. El handler nuevo llama a `DirectorySize` **directamente y no pasa por ese lock**. Es
bueno (no compite con el cálculo de disco) pero sin caché un usuario recargando el gestor
de archivos apilaría recorridos sobre el nodo. De ahí los 60 s en panel + 60 s en cliente.

### Degradación

Si Wings no tiene el endpoint (binario oficial, o actualización que borró el parche), las
peticiones fallan y las carpetas muestran `—`: exactamente el aspecto de antes, sin
errores en pantalla. **Por eso una actualización de Wings rompe esto en silencio.**

### Limitaciones aceptadas

- **Ordenar por tamaño no ordena las carpetas entre sí.** Se agrupan primero por tipo,
  igual que antes. Ordenarlas por peso real obligaría a esperar a que todas resuelvan.
- **En vista de cuadrícula las carpetas muestran tamaño en vez de fecha.** Solo hay una
  línea de metadatos por tarjeta. La fecha sigue en vista de lista.

---

## 6. Despliegue

### Generar el paquete

```bash
cd /c/Users/grinc/Downloads/luna-pterodactyl-theme-2-2-1/Tema2-2-1
git diff 0c5e279 HEAD -- Product > luna-panel-changes.patch
git diff --name-only 0c5e279 HEAD -- Product | sed 's|^Product/||' > /tmp/files.txt
cd Product && tar --format=ustar -czf ../luna-panel-changes.tar.gz -T /tmp/files.txt
```

`0c5e279` es el commit baseline (Luna 2.2.1 sin modificar).

### Desplegar

Los archivos se suben **por FTP** (SSH solo para los comandos). El `scp` de abajo es la
alternativa si prefieres tarball; para el detalle FTP archivo a archivo, ver
`GUIA-TAMANO-CARPETAS.md` §4.2. Ojo: lo subido por FTP queda con el usuario de FTP como
propietario — el `chown` final no es opcional.

```bash
scp luna-panel-changes.tar.gz usuario@IP:~/          # desde Git Bash

cd /var/www/pterodactyl
php artisan down                                      # solo si hay cambios .tsx
tar -xzf ~/luna-panel-changes.tar.gz -C /var/www/pterodactyl
php artisan migrate --force
php artisan view:clear && php artisan route:clear && php artisan config:clear
yarn install                                          # solo si hay cambios .tsx
NODE_OPTIONS="--openssl-legacy-provider --max-old-space-size=4096" yarn build:production
chown -R www-data:www-data /var/www/pterodactyl
php artisan up
```

### Qué requiere qué

| Cambias | Necesitas |
|---|---|
| `.tsx` / `.ts` | `yarn build:production` (2–8 min, hay downtime) |
| `.php` / `.blade.php` | `php artisan view:clear` |
| Rutas nuevas en `routes/` | `php artisan route:clear` — **obligatorio**, no basta view:clear |
| `public/themes/…` (CSS/JS admin) | Nada |
| Migraciones | `php artisan migrate --force` |
| `wings-release-*/router/*.go` | Recompilar Wings y sustituir el binario (§5, §7) |

### Verificar que el build entró

Las claves i18n son literales en el JSX y **sobreviven a la minificación**:

```bash
grep -l "allocations_title" public/assets/*.js
```

Si no devuelve nada, el build no incluye los cambios (o los archivos no llegaron —
comprueba `ls resources/scripts/components/elements/ui/`, deben ser 7 archivos).

---

## 7. Actualizaciones — qué se rompe y cómo reaplicarlo

**Nada de esto se reaplica solo.** Hay tres componentes que se actualizan por separado y
cada uno borra una parte distinta del trabajo. Lee esto antes de actualizar cualquier cosa.

| Actualizas | Qué se pierde | Cómo se nota |
|---|---|---|
| **Tema Luna** | `app/`, `resources/`, `public/`, `database/migrations/` y `package.json` **enteros** | Todo vuelve al aspecto original de Luna |
| **Panel Pterodactyl** | Puede pisar `routes/` y archivos de `app/` | El gestor de archivos da 500, o las carpetas vuelven a `—` |
| **Wings** | El binario parcheado (§5) | Las carpetas vuelven a `—` **en silencio, sin ningún error** |

### Tras actualizar el tema Luna

Es el más destructivo: `install_script/updateManifest.json` reemplaza directorios completos.

```bash
# 1. Corre el install.sh de Luna
# 2. Comprueba si el parche sigue aplicando sobre la version nueva
cd Tema2-2-1 && git apply --check luna-panel-changes.patch
# 3. Reaplica el tar y recompila (§6)
```

Si `git apply --check` falla, Luna cambió los archivos de debajo: hay que resolver los
conflictos a mano antes de reempaquetar.

### Tras actualizar el panel Pterodactyl

Comprueba que los 4 archivos PHP de §5 conservan los cambios y que la ruta existe:

```bash
cd /var/www/pterodactyl && php artisan route:list | grep directory-size
# → GET api/client/servers/{server}/files/directory-size
```

Actualiza también la copia de referencia `panel-release-v1.14.1/` a la versión nueva para
poder seguir comparando.

### Tras actualizar Wings ← el que se olvida

**El instalador oficial sobrescribe `/usr/local/bin/wings` y el endpoint desaparece.** No
hay error, no hay log: las carpetas simplemente vuelven a mostrar `—`.

```bash
# 1. Clonar el tag NUEVO
git clone --depth 1 -b vX.Y.Z https://github.com/pterodactyl/wings.git

# 2. Reaplicar el parche
git apply wings-directory-size.patch

# 3. Compilar y sustituir el binario (pasos 3.4 y 3.5 de GUIA-TAMANO-CARPETAS.md)
```

**Antes de dar por bueno el parche**, comprueba dos cosas en la versión nueva:

1. Que `Filesystem.DirectorySize()` sigue existiendo con esa firma en
   `server/filesystem/disk_space.go`
2. Que upstream no ha añadido ya un endpoint de tamaño — sería absurdo mantener el fork:
   ```bash
   grep -n "files\." router/router.go
   ```

Y actualiza `wings-release-v1.13.2/` en el directorio de trabajo al tag nuevo, con el
parche reaplicado.

### Comprobación rápida de que todo sigue vivo

```bash
# ¿Wings tiene el endpoint?
TOKEN=$(grep -m1 "^token:" /etc/pterodactyl/config.yml | awk '{print $2}')
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/servers/UUID/files/directory-size?directory=/"
# → {"size":...}   404 = el binario parcheado no esta activo

# ¿Entró el build del tema?
grep -l "directory-size" /var/www/pterodactyl/public/assets/*.js

# ¿Sigue la capa de diseño?
ls /var/www/pterodactyl/resources/scripts/components/elements/ui/   # 7 archivos
```

---

## 8. Trampas conocidas

**El instalador de Luna borra estos cambios.** `install_script/updateManifest.json` reemplaza
`app/`, `resources/`, `public/`, `database/migrations/` y `package.json` **enteros**. Tras cada
actualización de Luna: corre su `install.sh`, comprueba el parche con `git apply --check`, y
reaplica el tar + rebuild. Detalle completo en §7.

**Build OOM.** `yarn build:production` muere por falta de RAM en VPS pequeños. Síntoma:
`JavaScript heap out of memory` o el proceso muere sin más. Añade swap:
`fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`.
Y ojo: `build:production` ejecuta `yarn clean` primero, que borra `public/assets/*.js` — si
falla a mitad, el panel se queda sin frontend. No levantes hasta que compile.

**Service worker.** `public/sw.js` cachea *cache-first* con `CACHE_NAME` fijo (`luna-pwa-v1`)
que nunca se invalida. Si ves contenido viejo tras un build correcto:
F12 → Application → Service Workers → *Unregister* → Storage → *Clear site data*.

**`{cache-version}` — arreglado.** `Theme::getUrl()` emitía el placeholder literalmente, así
que las URLs de los 16 assets con ese token eran idénticas entre versiones y los navegadores
servían CSS/JS obsoleto para siempre. Ahora se sustituye por el `mtime` del fichero.

**`replaceAll()` del editor de temas.** Usaba `String.replace` con string de reemplazo, así
que `$&`/`$1`/`$$` dentro de valores del usuario se interpretaban como patrones. Arreglado con
función de reemplazo.

---

## 9. Convenciones

- **Colores:** solo variables de tema. Estados semánticos hardcodeados solo en `tokens.ts`.
- **i18n:** nada de texto hardcodeado. Claves en `resources/lang/{en,es}/`. Para claves que
  no existen en los ~18 idiomas restantes usa `t('clave', 'Texto por defecto')`.
- **Estilos:** styled-components con `tw` de twin.macro. Evita `style={{}}` inline.
- **Props de styled-components:** prefijo `$` para las transitorias (`$active`, `$level`).
- **PHP:** PSR-12, constantes y propiedades antes de los métodos.
- **Commits:** conventional commits en español, sin tildes en el asunto.

### Verificación disponible sin `node_modules`

No hay dependencias instaladas en esta copia, así que **no se puede compilar ni tipar aquí**.
Lo que sí se puede:

```bash
# sintaxis TS/TSX (solo TS1xxx; los TS2xxx son falsos por imports no resueltos)
node "$CLAUDE_JOB_DIR/tmp/node_modules/typescript/bin/tsc" --noEmit --noResolve \
  --jsx react --target es2019 --moduleResolution node --skipLibCheck <archivos>

node --check <archivo.js>                          # JS del admin
python -c "..."                                     # balance de llaves en CSS/PHP/Blade
```

No hay PHP ni Go instalados localmente: ni `php -l` ni `go build` son posibles aquí. Para
el fork de Wings, la compilación en el VPS es la única verificación real — pero el parche
sí se puede validar sin compilar:

```bash
patch -p1 --dry-run < wings-directory-size.patch   # sobre un clon virgen del tag
```

El build del servidor es la verificación real de todo lo demás.

---

## 10. Estado y pendientes

**55 archivos, +2.987 / −566 líneas.** 16 archivos nuevos. Baseline en `0c5e279`.
Más el fork de Wings (§5), que va aparte y no cuenta aquí.

### Pendiente

- **`Sidebar.tsx`** (137 KB, 45 bloques inline) — la navegación del cliente. El mayor salto
  visual que queda; merece sesión propia.
- **`ServerDashboardContainer`** — sus `Card`/`CardHeader` locales aún no usan `Panel`. Es la
  **página de aterrizaje real** de un servidor (`/server/xxx`), no la consola (`/server/xxx/console`).
- **Tarjetas del listado de servidores en vivo** — `ServerRow` sigue sondeando cada 30 s y el
  panel cachea `resources` 20 s (`ResourceUtilizationController`), así que no son tiempo real (§12).
- **Vistas Blade admin** — cubiertas visualmente por el CSS, pero su *estructura* sigue siendo
  la de Pterodactyl original.
- **Páginas de addons** (plugins, mods, modpacks, subdominios, proxies, splits, importador,
  propiedades, variables de entorno, versiones MC) — código muerto: **no hay ningún addon
  instalado** en este panel.

### Decisión abierta

`Components → Stat card` del editor ofrece 6 estilos que controlaban `StatBlock.tsx`. Al
sustituirlo por `StatTile` en la consola, **ese selector quedó inerte**. `StatBlock.tsx` sigue
en el código sin usar. Falta decidir: llevar las 6 variantes a `StatTile`, o quitar el ajuste.

### Configuración que hay que tocar a mano en el panel

- `Components → Server card → **Detailed**` — si no, no se ve la tarjeta rediseñada
- `Components → Player count` — desactivado por defecto, muy útil para MC
- `Advanced → Captcha` — **el registro está abierto sin captcha**
- `Components → RAM upgrade alert` — upsell automático al 85% de RAM
- `Components → Login panel background` — apunta por defecto a un CDN ajeno (hotlinking)

---

## 11. Integración con Tebby Vault (sección VAULT)

Cada servidor con Vault activado (admin de Pterodactyl → servidor → pestaña **Vault**) tiene
su carpeta en vault01 (`Global`, `Mundos`, `Backups`, `M-Backups`) y pierde la página
Backups nativa. Contrato de las tres piezas: `vault/docs/PTERODACTYL.md`.

| Pieza | Dónde | Guía |
|---|---|---|
| Vault | `vault/` | `vault/docs/MIGRACION-v3.md` |
| Panel (Laravel + React) | `Tema2-2-1/Product` (`app/Services/Vault`, `components/server/vault`, `config/vault.php`, migración `vault_servers`) | `.env`: `VAULT_URL`, `VAULT_PANEL_KEY` · `vault:tick` cada minuto |
| Wings | `wings-release-v1.13.2` (`server/vault`, `router/router_server_vault.go`) | `GUIA-WINGS-VAULT.md` · parche completo `wings-tebby.patch` |

**Al actualizar Wings se pierde también el Vault** (no solo el tamaño de carpetas): reaplica
`wings-tebby.patch`, no `wings-directory-size.patch`.

---

## 12. Estadísticas en vivo (consola y panel del servidor)

Las tarjetas CPU/Memoria/Disco (`ServerDetailsBlock`) y las tres gráficas (`StatGraphs`) de
`/server/xxx` y `/server/xxx/console` se mueven en tiempo real y enseñan el valor exacto al
pasar el ratón. Solo frontend: no toca Wings ni el backend.

**Fuente.** Wings emite un evento websocket `stats` por cada frame de Docker (~1/s con el
servidor encendido). La respuesta a `send stats` es una **copia literal** del último frame
(mismo `uptime`): `isRepeat()` la descarta para no pintar la misma lectura dos veces.

| Pieza | Qué hace |
|---|---|
| `console/liveStats.ts` | Parseo del payload, tasa de red, historial (`foldSample`), ventana deslizante, tope del eje |
| `console/statsFormat.ts` | `Intl` cacheado por idioma: `formatPercent`, `formatBytes`, `formatExactBytes`, `formatClock` (hh:mm:ss), `formatDay` |
| `console/frameTicker.ts` | Un único `requestAnimationFrame` compartido, limitado a **20 fps** |
| `console/LiveChart.tsx` | Chart.js directo (ya no usa `react-chartjs-2`): eje X en epoch ms, ventana de 60 s que avanza cada fotograma, tooltip HTML y línea guía |
| `console/ChartHoverCard.tsx` | Tooltip de la gráfica: hora con segundos + fecha, valor de cada serie y detalle exacto |

**Decisiones que no hay que deshacer:**

- **La tasa de red usa el `uptime` de Wings como base de tiempo**, no la hora de llegada. Los
  eventos llegan agrupados (sobre todo al conectar) y dividir por el tiempo de llegada inventaba
  picos de 3–4×.
- **La gráfica va ~1,5 lecturas por detrás del reloj** (`streamDelay`) para que cada punto entre
  deslizándose por la derecha en vez de aparecer de golpe.
- **Eje Y:** con límite, el tope es el límite (crece solo si se supera); sin límite, potencia de 2
  en bytes o 1-2-2,5-5 en %, para que la marca central también sea redonda.
- **Coste medido:** ~5 % de un núcleo con las tres gráficas visibles; se pausan vacías, fuera de
  pantalla (`IntersectionObserver`) y en pestañas ocultas (rAF). Con *reduced motion* no hay desplazamiento continuo.
- **El canvas no sigue las variables CSS solo:** `LiveChart` observa `data-theme` en `<html>` y
  repinta rejilla, líneas y línea guía al cambiar entre claro y oscuro.

**Trampas encontradas al hacerlo:**

- **Nunca interpoles en styled-components un valor que cambia cada segundo** (anchos, posiciones):
  genera una clase CSS por valor y la hoja crece sin fin. Usa `.attrs(() => ({ style }))` o `style`
  (así está `StatTile`'s `Bar`).
- **`Tooltip` compartido** se renderiza en el sitio, no en un portal: necesita `zIndex` o queda
  debajo de los bloques posicionados que vienen después (las gráficas tapaban el de las tarjetas).
- **`ChartBlock`** de Luna ponía el título en blanco al pasar el ratón (`group-hover:text-gray-50`):
  en tema claro desaparecía. Ahora usa `--color-base` (`.chart_title` en `style.module.css`).

Tests de la lógica pura: `liveStats.spec.ts`, `statsFormat.spec.ts`, `frameTicker.spec.ts`,
`elements/ui/motion.spec.ts`.

---

## 13. Integración con FurrGuard (página `/furrguard`)

El panel de FurrGuard (anti-VPN, listas y verificación de staff; repo `FurrGuard/`, otra
máquina) vive dentro del panel como una página propia, al estilo del Vault. Guía completa:
`FurrGuard/docs/INSTALACION_PTERODACTYL.md`; contrato del puente: `FurrGuard/docs/API.md` §9.
Este repo del tema está publicado como la rama **`panel-pterodactyl`** de
`TebTheFurr/SrTeb-FurrGuard` (historia independiente de la de FurrGuard, que va en `master`).

| Pieza | Dónde | Qué hace |
|---|---|---|
| Config | `config/furrguard.php` (`FURRGUARD_URL`, `FURRGUARD_PANEL_KEY`, `FURRGUARD_TIMEOUT`) | Vacías = integración apagada (botón oculto, rutas 404) |
| Permiso por usuario | `users.furrguard_access` (migración `2026_09_15`), `User`, `UserFormRequest`/`NewUserFormRequest`, `admin/users/{view,new}.blade.php` | Selector **FurrGuard** en Admin → Users. También los root admin lo necesitan |
| Cliente firmado | `app/Services/FurrGuard/FurrGuardClient.php` | `POST <url>/api/panel.php` con `X-FurrGuard-Signature` (HMAC como el Vault), `X-FurrGuard-Session`, `X-FurrGuard-Client-IP`, `X-FurrGuard-Actor` |
| Sesión | `app/Services/FurrGuard/FurrGuardSessionStore.php` | El token de FurrGuard solo vive en la sesión de Laravel |
| Login Discord | `Base/FurrGuardAuthController` (`/furrguard/login`, `/furrguard/callback`, `routes/base.php`) | FurrGuard hace el OAuth con SU app de Discord; el panel solo lleva y trae al navegador |
| API de la página | `Api/Client/FurrGuardController` (`/api/client/furrguard`, `/logout`, `/action`) + `RequireFurrGuardAccess` | Proxy de cualquier acción de `docs/API.md` §4.4; errores en formato Pterodactyl con el `code` de FurrGuard |
| Página React | `resources/scripts/components/furrguard/*`, `api/furrguard/*` | Shell con pestañas por sección, 16 vistas, diálogos, `usePagedList` con filtros en la URL, primitivas de `elements/ui/` |
| Botón | `layout/Sidebar.tsx` (`showFurrGuard`, 6 layouts), `DashboardRouter.tsx`, `state/user.ts` (`furrguardAccess`) | Solo con `furrguard_access` |

**Decisiones:** los permisos dentro de la página los dicta el rol de la cuenta de Discord en
FurrGuard (no hay segunda lista); la página es siempre en español (`useFurrGuardTranslation`,
bloque `furrguard` en `lang/{es,en}/dashboard.php`); `route:clear` es obligatorio al desplegar.
**Al actualizar Luna se pierde entera** (como el Vault): reaplicar el paquete y recompilar.
