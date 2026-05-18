# Actualizacion: Mensajes Completos y Modulos

> Sincronizacion completa de mensajes entre el plugin FurrGuard, los modulos FurrPerms y FurrSecurity, y el panel de administracion web. Version **1.7.0**.

---

## Novedades

### Mensajes de Kick de Error (FurrGuard)

Se anadieron 4 mensajes de kick para los casos de error durante la verificacion de conexion. Antes estos mensajes tenian solo un fallback hardcoded, ahora son configurables desde la web:

| Key | Descripcion |
|-----|-------------|
| `kick_interrupted` | Verificacion interrumpida |
| `kick_execution_error` | Error interno de ejecucion |
| `kick_completion_error` | Error de completitud |
| `kick_unknown_error` | Error generico inesperado |

### Nuevos Tipos de Bloqueo (FurrGuard)

Dos nuevos motivos de bloqueo con mensajes configurables:

| Key | Descripcion | Variables |
|-----|-------------|-----------|
| `kick_compromised_account` | Cuenta marcada como comprometida | `{id}`, `{server_name}`, `{discord}` |
| `kick_blocked_continent` | Continente bloqueado | `{id}`, `{continent}`, `{server_name}`, `{discord}` |

Tambien se anadieron las notificaciones de admin correspondientes: `notify_continent_blocked` y `notify_compromised_account`.

### Mensajes Faltantes del Plugin Principal

| Key | Descripcion |
|-----|-------------|
| `kick_default` | Kick generico (sin razon especifica) |
| `kick_api_error` | Error al conectar con la API |
| `kick_timeout` | Tiempo de espera agotado |
| `command_usage` | Ayuda de uso del comando /fg |
| `player_allowed` | Feedback: jugador permitido |
| `player_blocked` | Feedback: jugador bloqueado |

### Modulo FurrPerms (5 mensajes nuevos)

Primeros mensajes del modulo FurrPerms configurables desde la web:

| Key | Descripcion | Variables |
|-----|-------------|-----------|
| `fur_perms_no_permission` | Sin permisos para ejecutar | - |
| `fur_perms_command_blocked` | Comando restringido por FurrPerms | - |
| `fur_perms_logged` | Intento registrado | - |
| `fur_perms_notify_blocked` | Notificacion: comando bloqueado | `{player}`, `{command}` |
| `fur_perms_notify_allowed` | Notificacion: comando permitido | `{player}`, `{command}` |

### Modulo FurrSecurity (25 mensajes nuevos)

Todos los mensajes del modulo FurrSecurity ahora son configurables desde la web. Las keys usan el prefijo `furr_security_` para evitar colisiones:

**Verificacion:**
| Key | Descripcion | Variables |
|-----|-------------|-----------|
| `furr_security_verification_required` | Debe verificar identidad | - |
| `furr_security_verification_link` | Link de verificacion | `{url}` |
| `furr_security_verification_proxy_mode` | Verificar en proxy | - |
| `furr_security_verification_success` | Verificacion exitosa | - |
| `furr_security_verification_failed` | Verificacion fallida | - |
| `furr_security_verification_timeout` | Link expirado | - |

**Sesiones:**
| Key | Descripcion | Variables |
|-----|-------------|-----------|
| `furr_security_session_expired` | Sesion expirada | - |
| `furr_security_session_expiring` | Sesion expirando pronto | `{time}` |
| `furr_security_already_verified` | Ya verificado | - |
| `furr_security_not_staff` | No es staff | - |

**Bloqueos (lock):**
| Key | Descripcion |
|-----|-------------|
| `furr_security_locked_movement` | Movimiento bloqueado |
| `furr_security_locked_command` | Comandos bloqueados |
| `furr_security_locked_inventory` | Inventario bloqueado |
| `furr_security_locked_chat` | Chat bloqueado |
| `furr_security_locked_server_switch` | Cambio de servidor bloqueado |

**Kick:**
| Key | Descripcion |
|-----|-------------|
| `furr_security_kick_unverified` | No verifico a tiempo |
| `furr_security_kick_blacklisted` | Blacklist por seguridad |
| `furr_security_auto_blacklisted` | Auto-blacklist (3 intentos) |

**Admin / Sistema:**
| Key | Descripcion | Variables |
|-----|-------------|-----------|
| `furr_security_prefix` | Prefijo del plugin | - |
| `furr_security_admin_notification` | Notificacion admin | `{player}` |
| `furr_security_reload_success` | Config recargada | - |
| `furr_security_no_permission` | Sin permisos | - |
| `furr_security_player_not_found` | Jugador no encontrado | - |
| `furr_security_stats_header` | Header estadisticas | - |
| `furr_security_stats_line` | Linea estadisticas | `{key}`, `{value}` |

### Toggle de Visibilidad de IPs

Se agrego un boton de ojo (`Eye`/`EyeOff`) en el header del panel de administracion, junto al boton de recargar. Permite mostrar/ocultar todas las IPs del panel con un solo click. Las IPs estan borrosas por defecto y se revelan al activar el toggle.

---

## Archivos Modificados

### Plugin FurrGuard (Java)

| Archivo | Cambio |
|---------|--------|
| `MessageUtil.java` | 13 mensajes default nuevos (kick de error, compromised, continent, command_usage, player_allowed/blocked) |
| `ConnectionListener.java` | Cases `blocked_continent` y `compromised_account` en switch de kick y notify |
| `CheckPlayerResponse.java` | Campo `continent` + getter/setter |

### Modulo FurrPerms (Java)

| Archivo | Cambio |
|---------|--------|
| Ya cargaba de la API | Solo se agregaron labels en la web |

### Modulo FurrSecurity (Java)

| Archivo | Cambio |
|---------|--------|
| `MessageUtil.java` | Keys con prefijo `furr_security_`, `get()` con fallback, `loadApiMessages()` |
| `ApiClient.java` | Metodo `getMessages()` para cargar mensajes desde la API |
| `FurrSecurity.java` | Llamada a `loadApiMessages()` en `onEnable()` |

### Panel de Administracion (Vue)

| Archivo | Cambio |
|---------|--------|
| `MessagesView.vue` | 2 categorias nuevas (FurrPerms, FurrSecurity), labels y variables para 30+ mensajes |
| `AppHeader.vue` | Boton toggle de visibilidad de IPs (Eye/EyeOff) |
| `stores/ui.ts` | Estado `ipsRevealed` + accion `toggleIpsRevealed()` |
| `IPCell.vue` | Blur controlado por store global en lugar de hover |

---

## Instrucciones de Actualizacion

### 1. Actualizar base de datos

Ejecuta estas consultas SQL para insertar los nuevos mensajes. Usa `ON DUPLICATE KEY UPDATE` para no sobrescribir valores existentes:

```sql
-- FurrGuard: Kick de error
INSERT INTO `messages` (`key`, `value`, `description`) VALUES
('kick_default', '&8╔════════════════════════════════════╗\n&8║  &6&l{server_name}&8                    ║\n&8║                                    ║\n&8║     &c&l✘ CONEXIÓN DENEGADA ✘&8        ║\n&8║                                    ║\n&8║   &7No se permite tu conexión      ║\n&8║   &7a este servidor.               ║\n&8║                                    ║\n&8║   &7Si crees que es un error,       ║\n&8║   &fcontacta con la administración. ║\n&8║                                    ║\n&8║   &8Discord: &b{discord}&8\n&8║   &8ID: &7{id}&8                       ║\n&8╚════════════════════════════════════╝', 'Kick genérico sin razón específica')
ON DUPLICATE KEY UPDATE `value` = `value`;

INSERT INTO `messages` (`key`, `value`, `description`) VALUES
('kick_api_error', '&8╔════════════════════════════════════╗\n&8║     &c&l✘ ERROR DE VERIFICACIÓN ✘&8   ║\n&8║                                    ║\n&8║   &7No se pudo verificar tu        ║\n&8║   &7conexión en este momento.       ║\n&8║                                    ║\n&8║   &7Por favor, inténtalo de nuevo.  ║\n&8║                                    ║\n&8║   &8ID: &7{id}&8                       ║\n&8╚════════════════════════════════════╝', 'Error al conectar con la API')
ON DUPLICATE KEY UPDATE `value` = `value`;

INSERT INTO `messages` (`key`, `value`, `description`) VALUES
('kick_timeout', '&8╔════════════════════════════════════╗\n&8║     &c&l✘ TIEMPO DE ESPERA AGOTADO ✘&8 ║\n&8║                                    ║\n&8║   &7La verificación tardó demasiado║\n&8║   &7en completarse.                 ║\n&8║                                    ║\n&8║   &7Por favor, inténtalo de nuevo.  ║\n&8║                                    ║\n&8║   &8ID: &7{id}&8                       ║\n&8╚════════════════════════════════════╝', 'Timeout de verificación')
ON DUPLICATE KEY UPDATE `value` = `value`;

INSERT INTO `messages` (`key`, `value`, `description`) VALUES
('kick_interrupted', '&8╔════════════════════════════════════╗\n&8║     &c&l✘ ERROR DE VERIFICACIÓN ✘&8   ║\n&8║                                    ║\n&8║   &7La verificación fue             ║\n&8║   &7interrumpida.                   ║\n&8║                                    ║\n&8║   &7Por favor, inténtalo de nuevo.  ║\n&8║                                    ║\n&8║   &8ID: &7{id}&8                       ║\n&8╚════════════════════════════════════╝', 'Verificación interrumpida')
ON DUPLICATE KEY UPDATE `value` = `value`;

INSERT INTO `messages` (`key`, `value`, `description`) VALUES
('kick_execution_error', '&8╔════════════════════════════════════╗\n&8║     &c&l✘ ERROR DE VERIFICACIÓN ✘&8   ║\n&8║                                    ║\n&8║   &7Error interno al verificar      ║\n&8║   &7tu conexión.                    ║\n&8║                                    ║\n&8║   &7Por favor, inténtalo de nuevo.  ║\n&8║                                    ║\n&8║   &8ID: &7{id}&8                       ║\n&8╚════════════════════════════════════╝', 'Error de ejecución')
ON DUPLICATE KEY UPDATE `value` = `value`;

INSERT INTO `messages` (`key`, `value`, `description`) VALUES
('kick_completion_error', '&8╔════════════════════════════════════╗\n&8║     &c&l✘ ERROR DE VERIFICACIÓN ✘&8   ║\n&8║                                    ║\n&8║   &7Error al completar la           ║\n&8║   &7verificación de conexión.       ║\n&8║                                    ║\n&8║   &7Por favor, inténtalo de nuevo.  ║\n&8║                                    ║\n&8║   &8ID: &7{id}&8                       ║\n&8╚════════════════════════════════════╝', 'Error de completitud')
ON DUPLICATE KEY UPDATE `value` = `value`;

INSERT INTO `messages` (`key`, `value`, `description`) VALUES
('kick_unknown_error', '&8╔════════════════════════════════════╗\n&8║     &c&l✘ ERROR DE VERIFICACIÓN ✘&8   ║\n&8║                                    ║\n&8║   &7Error inesperado al verificar   ║\n&8║   &7tu conexión.                    ║\n&8║                                    ║\n&8║   &7Por favor, inténtalo de nuevo.  ║\n&8║                                    ║\n&8║   &8ID: &7{id}&8                       ║\n&8╚════════════════════════════════════╝', 'Error desconocido')
ON DUPLICATE KEY UPDATE `value` = `value`;

-- FurrGuard: Nuevos tipos de bloqueo
INSERT INTO `messages` (`key`, `value`, `description`) VALUES
('kick_compromised_account', '&8╔════════════════════════════════════╗\n&8║  &6&l{server_name}&8                    ║\n&8║                                    ║\n&8║     &c&l✘ CUENTA COMPROMETIDA ✘&8      ║\n&8║                                    ║\n&8║   &7Tu cuenta ha sido marcada como  ║\n&8║   &c&lcomprometida&7 por seguridad.    ║\n&8║                                    ║\n&8║   &7Contacta con la administración  ║\n&8║   &7para resolver este problema.    ║\n&8║                                    ║\n&8║   &8Discord: &b{discord}&8\n&8║   &8ID: &7{id}&8                       ║\n&8╚════════════════════════════════════╝', 'Kick por cuenta comprometida')
ON DUPLICATE KEY UPDATE `value` = `value`;

INSERT INTO `messages` (`key`, `value`, `description`) VALUES
('kick_blocked_continent', '&8╔════════════════════════════════════╗\n&8║  &6&l{server_name}&8                    ║\n&8║                                    ║\n&8║     &c&l✘ CONEXIÓN DENEGADA ✘&8        ║\n&8║                                    ║\n&8║   &7Tu continente está &c&lbloqueado&7. ║\n&8║                                    ║\n&8║   &eContinente:&f {continent}&8\n&8║                                    ║\n&8║   &7Disculpa las molestias.        ║\n&8║                                    ║\n&8║   &8Discord: &b{discord}&8\n&8║   &8ID: &7{id}&8                       ║\n&8╚════════════════════════════════════╝', 'Kick por continente bloqueado')
ON DUPLICATE KEY UPDATE `value` = `value`;

-- FurrGuard: Comandos faltantes
INSERT INTO `messages` (`key`, `value`, `description`) VALUES
('command_usage', '&x&0&0&F&F&A&A&l? &7Uso: &f/fg <check|status|cache|reload|stats|help>', 'Ayuda de uso del comando'),
('player_allowed', '&x&0&0&F&F&A&A&l✔ &7Jugador &f{player} &7permitido.', 'Jugador permitido'),
('player_blocked', '&c&l✘ &7Jugador &f{player} &7bloqueado.', 'Jugador bloqueado')
ON DUPLICATE KEY UPDATE `value` = `value`;

-- FurrGuard: Notificaciones faltantes
INSERT INTO `messages` (`key`, `value`, `description`) VALUES
('notify_continent_blocked', '&c&l🛡 &c{player} &7bloqueado &8• &f{ip} &8• &cContinente: &f{continent}', 'Notificación: continente bloqueado'),
('notify_compromised_account', '&c&l🛡 &c{player} &7bloqueado &8• &f{ip} &8• &cCuenta comprometida', 'Notificación: cuenta comprometida')
ON DUPLICATE KEY UPDATE `value` = `value`;

-- FurrPerms: Mensajes del modulo
INSERT INTO `messages` (`key`, `value`, `description`) VALUES
('fur_perms_no_permission', '&c✘ &cNo tienes permiso para ejecutar este comando.', 'Sin permisos FurrPerms'),
('fur_perms_command_blocked', '&c✘ &cEl comando está restringido por FurrPerms.', 'Comando bloqueado por FurrPerms'),
('fur_perms_logged', '&c✘ &cTu intento ha sido registrado.', 'Intento registrado FurrPerms'),
('fur_perms_notify_blocked', '&c⚠ &f{player} &7intentó ejecutar &f{command}', 'Notificación: comando bloqueado'),
('fur_perms_notify_allowed', '&a✔ &f{player} &7ejecutó &f{command}', 'Notificación: comando permitido')
ON DUPLICATE KEY UPDATE `value` = `value`;

-- FurrSecurity: Mensajes del modulo
INSERT INTO `messages` (`key`, `value`, `description`) VALUES
('furr_security_prefix', '&c&lFurrSecurity &8| &7', 'Prefijo FurrSecurity'),
('furr_security_verification_required', '&cDebes verificar tu identidad para continuar.', 'Verificación requerida'),
('furr_security_verification_link', '&eHaz click para verificar: &b{url}', 'Link de verificación'),
('furr_security_verification_proxy_mode', '&eVerifica tu identidad en el proxy para continuar.', 'Verificación en proxy'),
('furr_security_verification_success', '&aVerificacion completada. Ahora puedes jugar.', 'Verificación exitosa'),
('furr_security_verification_failed', '&cVerificacion fallida. Contacta a un administrador.', 'Verificación fallida'),
('furr_security_session_expired', '&cTu sesion ha expirado. Por favor, verifica nuevamente.', 'Sesión expirada'),
('furr_security_session_expiring', '&eTu sesion expira en &c{time}&e. Verifica nuevamente.', 'Sesión expirando'),
('furr_security_not_staff', '&7No necesitas verificacion (no eres staff).', 'No es staff'),
('furr_security_already_verified', '&aYa estas verificado.', 'Ya verificado'),
('furr_security_locked_movement', '&cEstas bloqueado hasta verificar tu identidad.', 'Bloqueo: movimiento'),
('furr_security_locked_command', '&cNo puedes ejecutar comandos hasta verificar.', 'Bloqueo: comandos'),
('furr_security_locked_inventory', '&cNo puedes interactuar con inventarios hasta verificar.', 'Bloqueo: inventario'),
('furr_security_locked_chat', '&cNo puedes enviar mensajes hasta verificar.', 'Bloqueo: chat'),
('furr_security_locked_server_switch', '&cNo puedes cambiar de servidor hasta verificar.', 'Bloqueo: cambio servidor'),
('furr_security_admin_notification', '&c[FurrSecurity] &7{player} &erequiere verificacion.', 'Notificación admin'),
('furr_security_reload_success', '&aConfiguracion recargada.', 'Config recargada'),
('furr_security_no_permission', '&cNo tienes permiso para esto.', 'Sin permisos'),
('furr_security_player_not_found', '&cJugador no encontrado.', 'Jugador no encontrado'),
('furr_security_stats_header', '&8&m------------------&c FurrSecurity &8&m------------------', 'Header stats'),
('furr_security_stats_line', '&7{key}: &f{value}', 'Línea stats'),
('furr_security_kick_unverified', '&cNo completaste la verificacion a tiempo.\n&7Por favor, vuelve a entrar e intenta de nuevo.', 'Kick: no verificado'),
('furr_security_kick_blacklisted', '&cHas sido añadido a la lista negra por seguridad.\n&7Contacta a un administrador.', 'Kick: blacklist seguridad'),
('furr_security_verification_timeout', '&eTu enlace de verificacion ha expirado. Saliendo...', 'Link expirado'),
('furr_security_auto_blacklisted', '&cHas sido añadido a la blacklist automaticamente por 3 intentos fallidos.', 'Auto-blacklist')
ON DUPLICATE KEY UPDATE `value` = `value`;
```

### 2. Actualizar archivos PHP

Sube los archivos modificados al servidor:

```
api/plugin.php
admin/api.php
```

### 3. Actualizar el panel de administracion (Vue)

Recompilar:

```bash
cd admin
npm install
npx vite build
```

Sube el contenido de `admin/dist/` al servidor.

### 4. Actualizar el plugin Java (FurrGuard)

```bash
cd FurrGuard-plugin
./gradlew shadowJar
```

Sube `build/libs/FurrGuard-1.0.0.jar` al directorio `plugins/` de Velocity y reinicia el proxy.

### 5. Actualizar modulos

Recompila cada modulo y sube los JARs actualizados:

```bash
# FurrPerms
cd modulos/furrperms-module
./gradlew shadowJar

# FurrSecurity (usar el build system correspondiente)
cd modulos/furrsecurity-module
```

---

## Verificacion

1. **Panel web:** Ve a **Mensajes** y verifica que aparecen las categorias "FurrPerms" (5 mensajes) y "FurrSecurity" (25 mensajes).

2. **Toggle de IPs:** En el header del panel, el boton con el icono de ojo debe alternar la visibilidad de todas las IPs.

3. **Plugin:** Ejecuta `/fg reload` en la consola de Velocity para recargar los mensajes desde la API.

4. **FurrSecurity:** Reinicia el servidor para que cargue los mensajes con prefijo `furr_security_` desde la API.

---

## Rollback

1. Restaura los archivos PHP, JARs y el build de Vue a la version anterior
2. Los mensajes nuevos en la tabla `messages` no molestan si quedan (el plugin usa defaults si no los encuentra)
3. Si quieres limpiar:
```sql
DELETE FROM messages WHERE `key` IN (
  'kick_default', 'kick_api_error', 'kick_timeout', 'kick_interrupted',
  'kick_execution_error', 'kick_completion_error', 'kick_unknown_error',
  'kick_compromised_account', 'kick_blocked_continent',
  'command_usage', 'player_allowed', 'player_blocked',
  'notify_continent_blocked', 'notify_compromised_account',
  'fur_perms_no_permission', 'fur_perms_command_blocked', 'fur_perms_logged',
  'fur_perms_notify_blocked', 'fur_perms_notify_allowed'
);
DELETE FROM messages WHERE `key` LIKE 'furr_security_%';
```
