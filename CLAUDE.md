# Luna Pterodactyl Theme — personalización Tebby Services S.L.

Tema Luna 2.2.1 (Buzz Development) para el panel Pterodactyl de **tebby.lgbt**, con
una capa de personalización propia encima. Servidor de Minecraft.

> **Este directorio NO es el panel en producción.** Es la copia de trabajo desde la
> que se generan los paquetes que se despliegan en `/var/www/pterodactyl`.

---

## 1. Arquitectura

`Product/` mapea 1:1 con la raíz del panel (`Product/app/…` → `/var/www/pterodactyl/app/…`).

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
| `StatTile` | Métrica: icono + etiqueta + usado/total + barra de progreso + niveles de alarma |
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

## 5. Despliegue

### Generar el paquete

```bash
cd /c/Users/grinc/Downloads/luna-pterodactyl-theme-2-2-1
git diff 0c5e279 HEAD -- Product > luna-panel-changes.patch
git diff --name-only 0c5e279 HEAD -- Product | sed 's|^Product/||' > /tmp/files.txt
cd Product && tar --format=ustar -czf ../luna-panel-changes.tar.gz -T /tmp/files.txt
```

`0c5e279` es el commit baseline (Luna 2.2.1 sin modificar).

### Desplegar

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
| `public/themes/…` (CSS/JS admin) | Nada |
| Migraciones | `php artisan migrate --force` |

### Verificar que el build entró

Las claves i18n son literales en el JSX y **sobreviven a la minificación**:

```bash
grep -l "allocations_title" public/assets/*.js
```

Si no devuelve nada, el build no incluye los cambios (o los archivos no llegaron —
comprueba `ls resources/scripts/components/elements/ui/`, deben ser 7 archivos).

---

## 6. Trampas conocidas

**El instalador de Luna borra estos cambios.** `install_script/updateManifest.json` reemplaza
`app/`, `resources/`, `public/`, `database/migrations/` y `package.json` **enteros**. Tras cada
actualización de Luna: corre su `install.sh`, comprueba el parche con `git apply --check`, y
reaplica el tar + rebuild.

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

## 7. Convenciones

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

No hay PHP instalado localmente: `php -l` no es posible. El build del servidor es la
verificación real.

---

## 8. Estado y pendientes

**47 archivos, +2.708 / −553 líneas.** 12 archivos nuevos. Baseline en `0c5e279`.

### Pendiente

- **`Sidebar.tsx`** (137 KB, 45 bloques inline) — la navegación del cliente. El mayor salto
  visual que queda; merece sesión propia.
- **`ServerDashboardContainer`** — sus `Card`/`CardHeader` locales aún no usan `Panel`. Es la
  **página de aterrizaje real** de un servidor (`/server/xxx`), no la consola (`/server/xxx/console`).
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
