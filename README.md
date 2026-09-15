# FurrGuard

Seguridad para redes de Minecraft (Velocity + Paper): detección de proxy, VPN, hosting y redes
móviles, whitelist y blacklist unificadas, bloqueos por país, continente y proveedor, detección de
cuentas comprometidas, verificación del staff con Discord (FurrSecurity) y protección de los comandos
de permisos (FurrPerms). Todo se gestiona desde un panel web con inicio de sesión de Discord.

Software propietario de **Tebby Services S.L.** (<https://tebby.lgbt>). Versión 2.0.0.

## Estructura del monorepo

| Carpeta | Contenido |
|---|---|
| `api/` | APIs de plugins: `plugin.php` (FurrGuard y FurrPerms) y `furrsecurity.php` |
| `admin/` | Panel: SPA Vue 3 en `src/`, entradas PHP (`index.php`, `api.php`, `callback.php`) y acciones en `admin/api/` |
| `public/` | SPA de la landing y de la verificación de staff (la sirven `index.php` y `verify.php`) |
| `shared/ui/` | Estilos, fuentes, imágenes y componentes comunes de las dos SPAs |
| `includes/` | Lógica PHP: seguridad, sesión del panel, geolocalización, baneos, detección, FurrSecurity, FurrPerms |
| `config/` | Carga de `.env` y conexión a la base de datos (`config.php` en la raíz arranca las páginas web) |
| `database/` | Migraciones (`migrations/`) y datos iniciales (`data/providers.tsv`) |
| `bin/` | Comandos: `migrate.php`, `cleanup.php`, `geoip-update.php` |
| `storage/` | Datos en tiempo de ejecución (sesiones, límites, bases GeoIP); su contenido no se versiona |
| `tests/php/` | Tests PHPUnit (`Unit` e `Integration`) |
| `libs/furrguard-common/` | Librería Java común: cliente HTTP de la API, YAML, JSON, texto seguro, normalización de comandos |
| `FurrGuard-plugin/` | Plugin de Velocity |
| `modulos/furrsecurity-module/` | FurrSecurity (un jar para Velocity y Paper) |
| `modulos/furrperms-module/` | FurrPerms (Velocity) |
| `deploy/` | Archivos de sistema de la instalación sin panel (nginx, PHP-FPM, systemd) y ejemplos de `config.yml` de los plugins; nunca se sirven |
| `docs/` | Contrato de la API y guías de instalación y actualización |

## Requisitos

- PHP 8.2+ con Composer 2 y MariaDB 10.3+ / MySQL 5.7+.
- Node 22 LTS o 24 LTS (20.19+ basta para compilar; los tests de `public/` piden 22.12+).
- JDK 21 para ejecutar Gradle y un JDK 17 instalado (toolchain del plugin). Los jars necesitan Java
  17 en Velocity, salvo FurrSecurity, que necesita Java 21 en Velocity y en Paper 1.21.4+.

## Compilar y probar

**PHP** (desde la raíz):

```bash
composer install
composer test          # PHPUnit: Unit + Integration
composer test:unit     # solo Unit
composer analyse       # PHPStan
```

Los tests de integración usan la MariaDB de pruebas de `phpunit.xml.dist` (variables `FG_TEST_DB_*`;
por defecto `127.0.0.1:3307`, base `furrguard_test`). Si no hay conexión, se omiten.

**Panel y landing:**

```bash
(cd admin  && npm ci && npm run build && npm test)   # también: npm run typecheck
(cd public && npm ci && npm run build && npm test)
```

`npm run build` comprueba tipos con `vue-tsc` y deja el resultado en `dist/`. `npm run dev` arranca Vite
en el puerto 5173; el panel reenvía `api.php` y `callback.php` a `http://127.0.0.1:8000`
(`php -S 127.0.0.1:8000` en la raíz, con `APP_ENV=development`).

**Java** (cada proyecto con su wrapper de Gradle 8.14.4; la librería común entra con `includeBuild`):

```bash
(cd libs/furrguard-common && ./gradlew test)
(cd FurrGuard-plugin && ./gradlew build)
(cd modulos/furrsecurity-module && ./gradlew build)
(cd modulos/furrperms-module && ./gradlew build)
```

`build` ejecuta los tests y genera:

- `FurrGuard-plugin/build/libs/FurrGuard-2.0.0.jar` y `FurrGuard-2.0.0-obfuscated.jar`
- `modulos/furrsecurity-module/build/libs/FurrSecurity-2.0.0.jar`
- `modulos/furrperms-module/build/libs/furrperms-module-2.0.0.jar`

## Despliegue

| Guía | Para |
|---|---|
| [`docs/INSTALACION.md`](docs/INSTALACION.md) | Instalación nueva en Ubuntu 24.04 / Debian 12 sin panel: nginx, PHP-FPM, MariaDB y timers de systemd, y el plugin y los módulos paso a paso |
| [`docs/INSTALACION_CLOUDPANEL.md`](docs/INSTALACION_CLOUDPANEL.md) | Servidor con CloudPanel: vhost, cron y configuración del plugin y los módulos |
| [`docs/ACTUALIZACION_2.0.md`](docs/ACTUALIZACION_2.0.md) | Actualizar una instalación 1.x en producción |

Archivos de `deploy/` que usa la instalación sin panel:

| Archivo | Destino |
|---|---|
| `deploy/furrguard-nginx.conf` | `/etc/nginx/sites-available/furrguard` |
| `deploy/furrguard-php-fpm.conf` | `/etc/php/<versión>/fpm/pool.d/furrguard.conf` |
| `deploy/furrguard-cleanup.service` · `.timer` | `/etc/systemd/system/`: limpieza cada hora |
| `deploy/furrguard-geoip.service` · `.timer` | `/etc/systemd/system/`: bases GeoLite2 los martes y viernes |
| `deploy/furrguard-backup.service` · `.timer` | `/etc/systemd/system/`: copia diaria de la base de datos (opcional) |
| `deploy/plugins/*.example.yml` | `config.yml` de FurrGuard, FurrPerms y FurrSecurity (Velocity y Paper) |

## Documentación

- [`docs/API.md`](docs/API.md): contrato v2 entre la web, el plugin, los módulos y las SPAs.
- Guías de instalación y actualización: ver [Despliegue](#despliegue).
