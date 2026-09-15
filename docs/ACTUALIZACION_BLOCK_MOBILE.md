# Actualizacion: Bloqueo de Conexiones Moviles

> Nueva funcionalidad para bloquear conexiones desde redes moviles (cellular). Disponible a partir de la version **1.6.0**.

---

## Novedades

Se ha anadido un nuevo toggle en el panel de administracion que permite bloquear automaticamente las conexiones identificadas como provenientes de una **red movil** (cellular carrier). Esto sigue el mismo patron que los bloqueos existentes de Proxy, VPN y Hosting.

**Que se considera una "red movil"?**
ip-api.com devuelve un campo `mobile: true` cuando la IP pertenece a una red celular (3G/4G/5G). **No** incluye conexiones WiFi residenciales ni conexiones de datacenter.

**Estado por defecto:** Desactivado (`block_mobile = 0`). Es una funcionalidad opt-in ya que bloquear conexiones moviles es inusual para la mayoria de servidores.

---

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `api/plugin.php` | Logica de bloqueo `block_mobile` + razon `mobile_detected` |
| `admin/api.php` | Clave `block_mobile` anadida a las permitidas en `saveSettings` |
| `admin/src/views/SettingsView.vue` | Toggle UI "Bloquear conexiones desde redes moviles" |
| `FurrGuard-plugin/.../MessageUtil.java` | Mensaje de kick `kick_mobile` |
| `FurrGuard-plugin/.../ConnectionListener.java` | Case `mobile_detected` en switch de kick |
| `FurrGuard-plugin/.../ApiClient.java` | Case `mobile_detected` en switch de reasonLabel |
| `install.sql` | Fila por defecto `('block_mobile', '0')` |

---

## Instrucciones de Actualizacion

### 1. Actualizar archivos PHP

Sube los siguientes archivos al servidor, reemplazando los existentes:

```
api/plugin.php
admin/api.php
```

### 2. Actualizar base de datos

Ejecuta esta consulta SQL en tu base de datos MySQL/MariaDB para anadir la nueva configuracion:

```sql
INSERT INTO `settings` (`key`, `value`) VALUES ('block_mobile', '0')
    ON DUPLICATE KEY UPDATE `value` = `value`;

INSERT INTO `messages` (`key`, `value`, `description`) VALUES
    ('kick_mobile', '&6&l{server_name}\n\n&c✘ &cLas conexiones desde redes móviles no están permitidas &c✘\n\nRazón: &fRed móvil detectada\n\n&7Si crees que fue un error, abre ticket en &b&lDISCORD\n\n&b{discord}\n\n&8ID# {id}', 'Mensaje al detectar red móvil')
    ON DUPLICATE KEY UPDATE `value` = `value`;
```

Esto inserta las nuevas filas si no existen, sin sobrescribir valores si ya estuvieran presentes.

### 3. Actualizar el panel de administracion (Vue)

El frontend ya esta compilado. Si necesitas recompilar:

```bash
cd admin
npm install
npx vite build
```

Luego sube el contenido de `admin/dist/` al servidor en el directorio correspondiente.

Si usas los archivos compilados del repositorio, simplemente sube los archivos de `admin/dist/` al servidor.

### 4. Actualizar el plugin Java

Recompilar el plugin:

```bash
cd FurrGuard-plugin
./gradlew shadowJar
```

El JAR resultante estara en `build/libs/FurrGuard-1.0.0.jar`. Subelo al directorio `plugins/` de tu servidor Velocity y reinicia el proxy.

---

## Verificacion

Despues de actualizar, verifica que todo funciona correctamente:

1. **Panel de administracion:** Accede a **Configuracion** y confirma que aparece el toggle "Bloquear conexiones desde redes moviles" dentro de la tarjeta "Bloqueo de conexiones".

2. **Persistencia:** Activa el toggle, guarda los cambios y recarga la pagina. El toggle debe permanecer activado.

3. **API:** Verifica en la pestana de red del navegador que al guardar se envia `block_mobile: "1"` en la peticion `save_settings`.

4. **Plugin:** Si activas el bloqueo, la proxima conexion desde una IP movil recibira un kick con el mensaje estilizado de "Red Movil".

---

## Rollback

Si necesitas revertir esta funcionalidad:

1. Desactiva el toggle desde el panel de administracion (o ejecuta `UPDATE settings SET value = '0' WHERE \`key\` = 'block_mobile';`)
2. Restaura los archivos PHP y el JAR del plugin a la version anterior
3. La fila en la tabla `settings` no molesta si queda, pero puedes eliminarla con `DELETE FROM settings WHERE \`key\` = 'block_mobile';`
