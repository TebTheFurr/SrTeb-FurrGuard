/*
 * Textos de la landing. Todo sale de lo que hace el producto (docs/API.md):
 * nada de cifras de marketing. Los valores "por defecto" son los del §7.
 * Iconos: pixelarticons (24 px) para cada concepto.
 */
import type { Component } from 'vue'
import IconArticle from '~icons/pixelarticons/article'
import IconBellRing from '~icons/pixelarticons/bell-ring'
import IconBuilding from '~icons/pixelarticons/building'
import IconCancel from '~icons/pixelarticons/cancel'
import IconChartBar from '~icons/pixelarticons/chart-bar'
import IconCheckboxOn from '~icons/pixelarticons/checkbox-on'
import IconClipboardNote from '~icons/pixelarticons/clipboard-note'
import IconCloseBox from '~icons/pixelarticons/close-box'
import IconDiscord from '~icons/pixelarticons/discord'
import IconEarth from '~icons/pixelarticons/earth'
import IconEye from '~icons/pixelarticons/eye'
import IconGlobe from '~icons/pixelarticons/globe'
import IconKey from '~icons/pixelarticons/key'
import IconLink from '~icons/pixelarticons/link'
import IconListBox from '~icons/pixelarticons/list-box'
import IconLock from '~icons/pixelarticons/lock'
import IconMapPin from '~icons/pixelarticons/map-pin'
import IconNotes from '~icons/pixelarticons/notes'
import IconPlug from '~icons/pixelarticons/plug'
import IconScriptText from '~icons/pixelarticons/script-text'
import IconShield from '~icons/pixelarticons/shield'
import IconSliders from '~icons/pixelarticons/sliders'
import IconSnowflake from '~icons/pixelarticons/snowflake'
import IconSync from '~icons/pixelarticons/sync'
import IconUser from '~icons/pixelarticons/user'
import IconUserX from '~icons/pixelarticons/user-x'
import IconZap from '~icons/pixelarticons/zap'

export const DISCORD_URL = 'https://discord.gg/srteb'
export const PANEL_URL = '/admin/'

export interface NavLink { id: string; label: string }

export const NAV: readonly NavLink[] = [
  { id: 'como-funciona', label: 'Cómo funciona' },
  { id: 'modulos', label: 'Módulos' },
  { id: 'staff', label: 'Staff' },
  { id: 'panel', label: 'Panel' },
]

export interface Fact { icon: Component; text: string }

export const HERO_FACTS: readonly Fact[] = [
  { icon: IconEarth, text: 'País y ASN aunque ip-api caiga' },
  { icon: IconZap, text: 'Cambios del panel aplicados en segundos' },
  { icon: IconLock, text: 'Staff verificado con Discord' },
]

export interface Step { icon: Component; title: string; text: string; order?: readonly string[] }

/** Orden real de check_player (§1.3). */
export const FLOW: readonly Step[] = [
  {
    icon: IconPlug,
    title: 'Llega la conexión',
    text: 'Velocity consulta a FurrGuard con el UUID, el nick y la IP antes de dejar pasar al jugador.',
  },
  {
    icon: IconMapPin,
    title: 'Geolocalización',
    text: 'ip-api aporta ISP, proxy, hosting y red móvil. El espejo local de MaxMind GeoLite2 garantiza país, continente y ASN aunque ip-api no responda.',
  },
  {
    icon: IconCloseBox,
    title: 'Blacklist',
    text: 'Un baneo gana siempre, también a la whitelist.',
    order: ['uuid', 'nick', 'asn', 'ip', 'rango'],
  },
  {
    icon: IconCheckboxOn,
    title: 'Whitelist',
    text: 'Libra de las reglas automáticas y de la detección de cuenta comprometida. Nunca de un baneo.',
  },
  {
    icon: IconUserX,
    title: 'Cuenta comprometida',
    text: 'Si una cuenta aparece de golpe desde un país distinto al habitual, se bloquea.',
  },
  {
    icon: IconSliders,
    title: 'Reglas automáticas',
    text: 'Se aplican en orden y la primera que coincide decide.',
    order: ['proxy', 'vpn', 'hosting', 'móvil', 'proveedor', 'país', 'continente'],
  },
]

export interface Module { icon: Component; title: string; text: string; tags?: readonly string[] }

export const MODULES: readonly Module[] = [
  {
    icon: IconShield,
    title: 'Proxy, VPN y hosting',
    text: 'Detecta proxys, VPN, IPs de centros de datos y redes móviles, y decides qué tipo bloquear. La red móvil viene permitida por defecto.',
    tags: ['proxy', 'vpn', 'hosting', 'móvil'],
  },
  {
    icon: IconListBox,
    title: 'Whitelist y blacklist unificadas',
    text: 'Por UUID, nick, IP, rango CIDR o ASN. Baneos temporales o permanentes con su ID, e IPs vinculadas que caen junto al baneo principal.',
    tags: ['uuid', 'nick', 'ip', 'cidr', 'asn'],
  },
  {
    icon: IconGlobe,
    title: 'Países y continentes',
    text: 'Cierra el paso a países o continentes enteros. Con el espejo de MaxMind sigue funcionando aunque ip-api esté caído.',
  },
  {
    icon: IconBuilding,
    title: 'Proveedores',
    text: 'Bloquea proveedores por nombre de ISP, organización o ASN y clasifícalos como hosting, VPN o proxy.',
  },
  {
    icon: IconUserX,
    title: 'Cuenta comprometida',
    text: 'Aprende desde dónde se conecta cada jugador y frena los cambios bruscos de país o de continente, con umbrales ajustables.',
  },
  {
    icon: IconSync,
    title: 'Sincronización con Velocity y Paper',
    text: 'Cuando cambias algo en el panel, los servidores lo recogen y revisan a los conectados: si un baneo o una regla nueva les afecta, salen.',
  },
]

export const DEGRADED_NOTE =
  'Si ip-api no responde, FurrGuard entra en modo degradado: sigue aplicando país, continente, ASN y proveedores con MaxMind.'

export const SECURITY_STEPS: readonly Step[] = [
  { icon: IconSnowflake, title: 'Entra y queda congelado', text: 'No puede moverse, usar comandos, abrir el inventario ni cambiar de servidor. Cada bloqueo se puede desactivar.' },
  { icon: IconLink, title: 'Recibe un enlace personal', text: 'Válido 3 minutos por defecto. Si pide otro desde otra IP, el anterior deja de valer.' },
  { icon: IconEye, title: 'Confirma su IP', text: 'La web le enseña la IP, el país y la hora de la solicitud antes de seguir.' },
  { icon: IconDiscord, title: 'Entra con Discord', text: 'Si la cuenta coincide, queda verificado: 8 horas por defecto, atado a su IP.' },
]

export const SECURITY_NOTES: readonly Fact[] = [
  { icon: IconMapPin, text: 'Si cambia de IP, vuelve a verificarse.' },
  { icon: IconCancel, text: 'Demasiados intentos fallidos terminan en baneo automático.' },
  { icon: IconBellRing, text: 'Avisos en el juego antes de que caduque la sesión.' },
]

export const PERMS_COMMANDS: readonly string[] = ['op', 'deop', 'lp', 'luckperms', 'lpv', 'perms', 'permissions']

export const PERMS_NOTES: readonly Fact[] = [
  { icon: IconClipboardNote, text: 'Solo quien está en su whitelist (nick y UUID) puede usarlos.' },
  { icon: IconLock, text: 'Puede exigir además una sesión de FurrSecurity válida.' },
  { icon: IconScriptText, text: 'Los intentos permitidos y bloqueados quedan registrados en el panel.' },
]

export const PANEL_FEATURES: readonly Fact[] = [
  { icon: IconChartBar, text: 'Resumen con jugadores en línea, conexiones y bloqueos de las últimas 24 h y el estado de ip-api y MaxMind.' },
  { icon: IconUser, text: 'Ficha de cada jugador: nicks, IPs, conexiones, listas y sanciones.' },
  { icon: IconArticle, text: 'Sanciones, proveedores, países, continentes y mensajes de expulsión.' },
  { icon: IconNotes, text: 'Registro de actividad: cada cambio de listas, ajustes o mensajes deja traza.' },
  { icon: IconKey, text: 'Acceso con Discord y sesiones atadas a la IP de quien entra.' },
]

export interface Role { name: string; tone: 'gold' | 'fox' | 'accent' | 'tenue'; sections: number; text: string }

/** Secciones por rol según §4.3. */
export const ROLES: readonly Role[] = [
  { name: 'founder', tone: 'gold', sections: 16, text: 'Todo, incluidos ajustes, proveedores y usuarios del panel.' },
  { name: 'owner', tone: 'fox', sections: 13, text: 'Listas, países, mensajes, registros, FurrPerms y FurrSecurity.' },
  { name: 'manager', tone: 'accent', sections: 7, text: 'Jugadores, conexiones, IPs, listas y sanciones.' },
  { name: 'sradmin', tone: 'tenue', sections: 5, text: 'Jugadores, listas y sanciones, sin ver IPs.' },
  { name: 'admin', tone: 'tenue', sections: 5, text: 'Jugadores, listas y sanciones, sin ver IPs.' },
]
