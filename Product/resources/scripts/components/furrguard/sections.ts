import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
    faArchive,
    faBan,
    faBuilding,
    faClipboardCheck,
    faCog,
    faCommentAlt,
    faGamepad,
    faGlobe,
    faGlobeEurope,
    faLock,
    faMap,
    faPlug,
    faScroll,
    faShieldAlt,
    faTachometerAlt,
    faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { Section, SECTIONS } from '@/api/furrguard/types';

/*
 * The sixteen sections of the FurrGuard panel (docs/API.md §4.3), grouped as its own
 * sidebar groups them, with the path each one has under /furrguard.
 */

export interface SectionInfo {
    section: Section;
    label: string;
    path: string;
    icon: IconDefinition;
    description: string;
}

export interface SectionGroup {
    title: string;
    items: SectionInfo[];
}

export const GROUPS: SectionGroup[] = [
    {
        title: 'General',
        items: [{ section: 'overview', label: 'Resumen', path: '', icon: faTachometerAlt, description: 'Estado de la red en las últimas 24 horas.' }],
    },
    {
        title: 'Jugadores',
        items: [
            { section: 'players', label: 'Jugadores', path: 'jugadores', icon: faGamepad, description: 'Todos los jugadores que han pasado por la red. Busca por nick, UUID o IP.' },
            { section: 'connections', label: 'Conexiones', path: 'conexiones', icon: faPlug, description: 'Cada intento de entrada con su geolocalización y el resultado de las reglas.' },
            { section: 'ips', label: 'IPs', path: 'ips', icon: faGlobe, description: 'Direcciones vistas en la red, con cuántos jugadores y conexiones comparten cada una.' },
        ],
    },
    {
        title: 'Protección',
        items: [
            { section: 'whitelist', label: 'Whitelist', path: 'whitelist', icon: faClipboardCheck, description: 'Exime de la detección automática y de la cuenta comprometida. Un baneo gana siempre a la whitelist.' },
            { section: 'blacklist', label: 'Blacklist', path: 'blacklist', icon: faBan, description: 'Baneos por UUID, nick, IP, rango o AS. Desactivar un baneo desactiva también sus IPs manchadas.' },
            { section: 'sanctions', label: 'Sanciones', path: 'sanciones', icon: faArchive, description: 'Historial de todos los baneos, incluidos los temporales ya expirados y los desactivados.' },
        ],
    },
    {
        title: 'Filtros',
        items: [
            { section: 'providers', label: 'Proveedores', path: 'proveedores', icon: faBuilding, description: 'Patrones de ISP u organización que se bloquean aunque el proveedor de IP no los marque.' },
            { section: 'countries', label: 'Países', path: 'paises', icon: faMap, description: 'Conexiones desde estos países se expulsan con su mensaje (o el genérico si no tiene).' },
            { section: 'continents', label: 'Continentes', path: 'continentes', icon: faGlobeEurope, description: 'Bloqueo por continente: se evalúa después de proveedores y países.' },
        ],
    },
    {
        title: 'Módulos',
        items: [
            { section: 'furrperms', label: 'FurrPerms', path: 'furrperms', icon: faLock, description: 'Solo los jugadores de esta lista pueden usar los comandos sensibles de la red.' },
            { section: 'furrsecurity', label: 'FurrSecurity', path: 'furrsecurity', icon: faShieldAlt, description: 'El staff debe verificar con su Discord desde la misma IP antes de jugar. La sesión queda atada a esa IP.' },
        ],
    },
    {
        title: 'Sistema',
        items: [
            { section: 'messages', label: 'Mensajes', path: 'mensajes', icon: faCommentAlt, description: 'Textos que muestran el plugin y los módulos. Admiten códigos de color & y §.' },
            { section: 'logs', label: 'Registro', path: 'registro', icon: faScroll, description: 'Auditoría del panel: accesos, cambios de listas, ajustes, mensajes, módulos y acciones automáticas de seguridad.' },
            { section: 'settings', label: 'Ajustes', path: 'ajustes', icon: faCog, description: 'Configuración global de FurrGuard. Solo se envían los valores que cambies.' },
            { section: 'users', label: 'Usuarios', path: 'usuarios', icon: faUsers, description: 'Quién puede entrar al panel de FurrGuard y con qué rol.' },
        ],
    },
];

export const ALL_SECTIONS: SectionInfo[] = GROUPS.flatMap((group) => group.items);

const BY_SECTION = new Map(ALL_SECTIONS.map((item) => [item.section, item] as const));

export const sectionInfo = (section: Section): SectionInfo => BY_SECTION.get(section) ?? ALL_SECTIONS[0];

export const BASE_PATH = '/furrguard';

/** Absolute path of a section page (`/furrguard/jugadores`). */
export const sectionPath = (section: Section): string => {
    const info = sectionInfo(section);

    return info.path ? `${BASE_PATH}/${info.path}` : BASE_PATH;
};

export const playerPath = (uuid: string): string => `${BASE_PATH}/jugadores/${encodeURIComponent(uuid)}`;

/** Only the sections the contract knows (§4.3); anything else in the list is ignored. */
export const sanitizeSections = (raw: unknown): Section[] =>
    Array.isArray(raw) ? SECTIONS.filter((section) => raw.includes(section)) : [];

export const groupsFor = (permissions: readonly Section[]): SectionGroup[] =>
    GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => permissions.includes(item.section)) })).filter(
        (group) => group.items.length > 0
    );

export const firstSection = (permissions: readonly Section[]): Section | null => groupsFor(permissions)[0]?.items[0]?.section ?? null;
