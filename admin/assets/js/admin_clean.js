/**
 * FurrGuard Admin Panel JavaScript
 *
 * @author GrinchHorizon
 * @copyright SrTeb Limited
 * @website https://srteb.eu
 * @version 1.0.0
 */

const API_URL = 'api.php';
const DISCORD_CLIENT_ID = 'YOUR_DISCORD_CLIENT_ID';
const DISCORD_REDIRECT_URI = encodeURIComponent(window.location.origin + '/admin/callback.php');

let currentSection = 'overview';
let currentUser = null;
let skinViewer = null;

/**
 * Detecta si una UUID pertenece a un jugador offline/no-premium
 * Las UUIDs offline de Minecraft tienen el bit 4 de la versión (position 14) siempre en 0
 * Ejemplo: 0cc4ca21-c5dd-3efa-ad51-7a1bb8d8c657 (nota el '0' después del segundo guion)
 * Las UUIDs premium tienen la versión 4, que es el carácter '4' en esa posición
 * Ejemplo: 123e4567-e89b-12d3-a456-426614174000 (nota el '4' después del segundo guion)
 */
function isOfflineUUID(uuid) {
    if (!uuid || typeof uuid !== 'string') return false;
    // Formato UUID: xxxxxxxx-xxxx-Vxxx-xxxx-xxxxxxxxxxxx
    // V está en la posición 14 (índice 14 en string con guiones)
    // Para UUIDs offline, V es siempre 0, 1, 2, o 3
    // Para UUIDs premium (v4), V es 4
    if (uuid.length >= 15) {
        const versionChar = uuid.charAt(14);
        return versionChar !== '4';
    }
    return false;
}

/**
 * Obtiene el tipo de ban apropiado según si el jugador es premium o no
 * Para jugadores offline/no-premium, usa 'nick' en lugar de 'uuid'
 */
function getBanTypeForPlayer(uuid, nick) {
    if (isOfflineUUID(uuid)) {
        return { type: 'nick', value: nick, isOffline: true };
    }
    return { type: 'uuid', value: uuid, isOffline: false };
}

/**
 * Custom Modal System - Reemplaza nativos alert(), confirm(), prompt()
 */

/**
 * Muestra un modal de confirmación personalizado (reemplazo de confirm())
 * @param {string} message - Mensaje a mostrar
 * @param {string} title - Título del modal (opcional)
 * @param {string} variant - 'danger', 'warning', 'info' (opcional, default: 'danger')
 * @returns {Promise<boolean>} - Resuelve a true si confirma, false si cancela
 */
function showConfirm(message, title = 'Confirmar acción', variant = 'danger') {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const messageEl = document.getElementById('confirmMessage');
        const titleEl = document.getElementById('confirmTitle');
        const okBtn = document.getElementById('confirmOk');
        const cancelBtn = document.getElementById('confirmCancel');

        // Set content
        messageEl.textContent = message;
        titleEl.textContent = title;

        // Set variant
        modal.className = 'modal active';
        if (variant === 'warning') {
            modal.classList.add('warning');
        } else if (variant === 'info') {
            modal.classList.add('info');
        } else {
            modal.classList.add('danger');
        }

        // Handle confirm
        const handleConfirm = () => {
            modal.classList.remove('active');
            resolve(true);
            cleanup();
        };

        // Handle cancel
        const handleCancel = () => {
            modal.classList.remove('active');
            resolve(false);
            cleanup();
        };

        // Cleanup event listeners
        const cleanup = () => {
            okBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            modal.querySelector('.modal-overlay').removeEventListener('click', handleCancel);
        };

        // Add event listeners
        okBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        modal.querySelector('.modal-overlay').addEventListener('click', handleCancel);

        // Focus confirm button
        setTimeout(() => okBtn.focus(), 100);
    });
}

/**
 * Muestra un modal de entrada personalizado (reemplazo de prompt())
 * @param {string} message - Mensaje a mostrar
 * @param {string} defaultValue - Valor por defecto (opcional)
 * @param {string} title - Título del modal (opcional)
 * @param {string} placeholder - Placeholder del input (opcional)
 * @returns {Promise<string|null>} - Resuelve al valor ingresado o null si cancela
 */
function showPrompt(message, defaultValue = '', title = 'Entrada requerida', placeholder = '') {
    return new Promise((resolve) => {
        const modal = document.getElementById('promptModal');
        const messageEl = document.getElementById('promptMessage');
        const titleEl = document.getElementById('promptTitle');
        const inputEl = document.getElementById('promptInput');
        const okBtn = document.getElementById('promptOk');
        const cancelBtn = document.getElementById('promptCancel');

        // Set content
        messageEl.textContent = message;
        titleEl.textContent = title;
        inputEl.value = defaultValue;
        inputEl.placeholder = placeholder || message;

        // Show modal
        modal.classList.add('active');

        // Handle confirm
        const handleConfirm = () => {
            const value = inputEl.value.trim();
            modal.classList.remove('active');
            resolve(value || null);
            cleanup();
        };

        // Handle cancel
        const handleCancel = () => {
            modal.classList.remove('active');
            resolve(null);
            cleanup();
        };

        // Handle Enter key
        const handleKeyPress = (e) => {
            if (e.key === 'Enter') {
                handleConfirm();
            }
        };

        // Cleanup event listeners
        const cleanup = () => {
            okBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            inputEl.removeEventListener('keypress', handleKeyPress);
            modal.querySelector('.modal-overlay').removeEventListener('click', handleCancel);
        };

        // Add event listeners
        okBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);
        inputEl.addEventListener('keypress', handleKeyPress);
        modal.querySelector('.modal-overlay').addEventListener('click', handleCancel);

        // Focus input
        setTimeout(() => inputEl.focus(), 100);
    });
}

/**
 * Muestra un modal de alerta personalizado (reemplazo de alert())
 * @param {string} message - Mensaje a mostrar
 * @param {string} title - Título del modal (opcional)
 * @param {string} variant - 'success', 'warning', 'info', 'danger' (opcional, default: 'info')
 * @returns {Promise<void>}
 */
function showAlert(message, title = 'Información', variant = 'info') {
    return new Promise((resolve) => {
        const modal = document.getElementById('alertModal');
        const messageEl = document.getElementById('alertMessage');
        const titleEl = document.getElementById('alertTitle');
        const okBtn = document.getElementById('alertOk');

        // Set content
        messageEl.textContent = message;
        titleEl.textContent = title;

        // Set variant
        modal.className = 'modal active';
        modal.classList.add(variant);

        // Handle close
        const handleClose = () => {
            modal.classList.remove('active');
            resolve();
            cleanup();
        };

        // Cleanup event listeners
        const cleanup = () => {
            okBtn.removeEventListener('click', handleClose);
            modal.querySelector('.modal-overlay').removeEventListener('click', handleClose);
        };

        // Add event listeners
        okBtn.addEventListener('click', handleClose);
        modal.querySelector('.modal-overlay').addEventListener('click', handleClose);

        // Focus button
        setTimeout(() => okBtn.focus(), 100);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initEventListeners();
});

function checkAuth() {
    const session = localStorage.getItem('furrguard_session');
    if (session) {
        try {
            currentUser = JSON.parse(session);
            showDashboard();
            loadDashboardData();
        } catch (e) {
            localStorage.removeItem('furrguard_session');
            showLogin();
        }
    } else {
        showLogin();
    }
}

function showLogin() {
    document.getElementById('loginContainer').classList.remove('hidden');
    document.getElementById('dashboard').classList.remove('active');
}

function showDashboard() {
    document.getElementById('loginContainer').classList.add('hidden');
    document.getElementById('dashboard').classList.add('active');

    if (currentUser) {
        document.getElementById('userDisplay').textContent = currentUser.username || 'Admin';
        if (currentUser.avatar) {
            document.getElementById('userAvatar').innerHTML = `<img src="https://cdn.discordapp.com/avatars/${currentUser.discord_id}/${currentUser.avatar}.png" alt="Avatar">`;
        }
        const roleDisplay = document.getElementById('userRoleDisplay');
        if (roleDisplay && currentUser.role) {
            const roleLabels = { founder: 'Founder', owner: 'Owner', manager: 'Manager', sradmin: 'SrAdmin', admin: 'Admin' };
            roleDisplay.textContent = roleLabels[currentUser.role] || 'Admin';
        }
        applyRolePermissions();
    }
}

function applyRolePermissions() {
    const role = currentUser?.role;
    if (!role || !window.ROLE_PERMISSIONS) return;

    const allowed = window.ROLE_PERMISSIONS[role] || [];

    document.querySelectorAll('.nav-item[data-section]').forEach(item => {
        const section = item.dataset.section;
        if (section && !allowed.includes(section)) {
            item.style.display = 'none';
        } else {
            item.style.display = '';
        }
    });

    // Hide categories where all children are hidden
    document.querySelectorAll('.nav-category').forEach(cat => {
        const items = cat.querySelectorAll('.nav-item[data-section]');
        const allHidden = Array.from(items).every(item => item.style.display === 'none');
        cat.style.display = allHidden ? 'none' : '';
    });

    if (!allowed.includes(currentSection)) {
        switchSection('overview');
    }
}

function initEventListeners() {
    document.getElementById('discordLoginBtn').addEventListener('click', () => {
        const url = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${DISCORD_REDIRECT_URI}&response_type=code&scope=identify`;
        window.location.href = url;
    });

    document.getElementById('logoutBtn').addEventListener('click', logout);

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            if (section) {
                switchSection(section);
            }
        });
    });

    // Category collapse/expand toggle
    document.querySelectorAll('.nav-category-header').forEach(header => {
        header.addEventListener('click', () => {
            header.closest('.nav-category').classList.toggle('collapsed');
        });
    });

    document.querySelectorAll('[data-goto]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchSection(link.dataset.goto);
        });
    });

    document.getElementById('sidebarToggle').addEventListener('click', () => {
        document.querySelector('.sidebar').classList.toggle('open');
    });

    document.getElementById('refreshBtn').addEventListener('click', refreshData);

    document.getElementById('globalSearch').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performGlobalSearch(e.target.value);
        }
    });

    initFilterListeners();
    initModalListeners();
    initQuickActions();
    initSettingsListeners();
}

function switchSection(section) {
    const role = currentUser?.role;
    if (role && window.ROLE_PERMISSIONS) {
        const allowed = window.ROLE_PERMISSIONS[role] || [];
        if (!allowed.includes(section)) {
            section = 'overview';
        }
    }
    currentSection = section;

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === section);
    });

    // Auto-expand parent category of active section
    const activeNavItem = document.querySelector(`.nav-item[data-section="${section}"]`);
    if (activeNavItem) {
        const parentCategory = activeNavItem.closest('.nav-category');
        if (parentCategory) {
            parentCategory.classList.remove('collapsed');
        }
    }

    document.querySelectorAll('.section').forEach(sec => {
        sec.classList.toggle('active', sec.id === `section-${section}`);
    });

    const titles = {
        'overview': 'Resumen',
        'players': 'Jugadores',
        'connections': 'Conexiones',
        'ips': 'IPs',
        'whitelist': 'Whitelist',
        'blacklist': 'Blacklist',
        'providers': 'Proveedores Bloqueados',
        'countries': 'Países Bloqueados',
        'continents': 'Continentes Bloqueados',
        'sanctions': 'Sanciones',
        'messages': 'Mensajes',
        'logs': 'Logs de Actividad',
        'settings': 'Configuración',
        'users': 'Gestión de Usuarios',
        'modules': 'Módulos'
    };

    document.getElementById('sectionTitle').textContent = titles[section] || section;

    loadSectionData(section);

    document.querySelector('.sidebar').classList.remove('open');
}

async function loadDashboardData() {
    await loadSectionData('overview');
    loadBadgeCounts();
}

async function loadSectionData(section) {
    switch (section) {
        case 'overview':
            await loadOverviewData();
            break;
        case 'players':
            await loadPlayersData();
            break;
        case 'connections':
            await loadConnectionsData();
            break;
        case 'ips':
            await loadIPsData();
            break;
        case 'whitelist':
            await loadWhitelistData();
            break;
        case 'blacklist':
            await loadBlacklistData();
            break;
        case 'sanctions':
            await loadSanctionsData();
            break;
        case 'providers':
            await loadProvidersData();
            break;
        case 'countries':
            await loadCountriesData();
            break;
        case 'continents':
            await loadContinentsData();
            break;
        case 'messages':
            await loadMessagesData();
            break;
        case 'logs':
            await loadLogsData();
            break;
        case 'settings':
            await loadSettingsData();
            break;
        case 'users':
            await loadUsersData();
            break;
    }
}

async function loadOverviewData() {
    try {
        const response = await apiRequest('get_overview');
        if (response.success) {
            document.getElementById('statOnline').textContent = response.data.online_players || 0;
            document.getElementById('statTotalPlayers').textContent = response.data.total_players || 0;
            document.getElementById('statConnections24h').textContent = response.data.connections_24h || 0;
            document.getElementById('statBlocked24h').textContent = response.data.blocked_24h || 0;

            renderRecentConnections(response.data.recent_connections || []);
            renderRecentBlocks(response.data.recent_blocks || []);
        }
    } catch (error) {
        console.error('Error loading overview:', error);
    }
}

async function loadPlayersData(page = 1, filter = 'all', search = '') {
    const tbody = document.getElementById('playersTableBody');
    tbody.innerHTML = '<tr><td colspan="8"><div class="loading-spinner"></div></td></tr>';

    try {
        const response = await apiRequest('get_players', { page, filter, search });
        if (response.success) {
            renderPlayersTable(response.data.players || []);
            renderPagination('playersPagination', response.data.pagination, (p) => loadPlayersData(p, filter, search));
        }
    } catch (error) {
        console.error('Error loading players:', error);
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Error al cargar datos</td></tr>';
    }
}

async function loadConnectionsData(page = 1, filter = 'all', search = '') {
    const tbody = document.getElementById('connectionsTableBody');
    tbody.innerHTML = '<tr><td colspan="8"><div class="loading-spinner"></div></td></tr>';

    try {
        const response = await apiRequest('get_connections', { page, filter, search });
        if (response.success) {
            renderConnectionsTable(response.data.connections || []);
            renderPagination('connectionsPagination', response.data.pagination, (p) => loadConnectionsData(p, filter, search));
        }
    } catch (error) {
        console.error('Error loading connections:', error);
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Error al cargar datos</td></tr>';
    }
}

async function loadIPsData(page = 1, search = '') {
    const tbody = document.getElementById('ipsTableBody');
    tbody.innerHTML = '<tr><td colspan="8"><div class="loading-spinner"></div></td></tr>';

    try {
        const response = await apiRequest('get_ips', { page, search });
        if (response.success) {
            renderIPsTable(response.data.ips || []);
            renderPagination('ipsPagination', response.data.pagination, (p) => loadIPsData(p, search));
        }
    } catch (error) {
        console.error('Error loading IPs:', error);
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Error al cargar datos</td></tr>';
    }
}

async function loadWhitelistData(filter = 'all', search = '') {
    const tbody = document.getElementById('whitelistTableBody');
    tbody.innerHTML = '<tr><td colspan="6"><div class="loading-spinner"></div></td></tr>';

    try {
        const response = await apiRequest('get_whitelist', { filter, search });
        if (response.success) {
            renderWhitelistTable(response.data.entries || []);
        }
    } catch (error) {
        console.error('Error loading whitelist:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Error al cargar datos</td></tr>';
    }
}

async function loadBlacklistData(filter = 'all', search = '') {
    const tbody = document.getElementById('blacklistTableBody');
    tbody.innerHTML = '<tr><td colspan="8"><div class="loading-spinner"></div></td></tr>';

    try {
        const response = await apiRequest('get_blacklist', { filter, search });
        if (response.success) {
            renderBlacklistTable(response.data.entries || []);
        }
    } catch (error) {
        console.error('Error loading blacklist:', error);
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Error al cargar datos</td></tr>';
    }
}

async function loadSanctionsData(page = 1, filter = 'all', search = '') {
    const tbody = document.getElementById('sanctionsTableBody');
    tbody.innerHTML = '<tr><td colspan="8"><div class="loading-spinner"></div></td></tr>';

    try {
        const response = await apiRequest('get_sanctions', { page, filter, search });
        if (response.success) {
            const stats = response.data.stats || {};
            document.getElementById('sanctionStatTotal').textContent = stats.total || 0;
            document.getElementById('sanctionStatActive').textContent = stats.active || 0;
            document.getElementById('sanctionStatPermanent').textContent = stats.permanent || 0;
            document.getElementById('sanctionStatTemporary').textContent = stats.temporary || 0;
            document.getElementById('sanctionStatExpired').textContent = stats.expired || 0;

            renderSanctionsTable(response.data.sanctions || []);
            renderPagination('sanctionsPagination', response.data.pagination, (p) => loadSanctionsData(p, filter, search));
        }
    } catch (error) {
        console.error('Error loading sanctions:', error);
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Error al cargar datos</td></tr>';
    }
}

function renderSanctionsTable(sanctions) {
    const tbody = document.getElementById('sanctionsTableBody');

    if (sanctions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No hay sanciones registradas</td></tr>';
        return;
    }

    tbody.innerHTML = sanctions.map(s => {
        let statusText, statusClass;
        let isExpired = false;
        let durationText = 'Permanente';

        if (s.expires_at) {
            const expiresDate = new Date(s.expires_at);
            const createdDate = new Date(s.created_at);
            const now = new Date();
            const totalMs = expiresDate - createdDate;
            const totalMins = Math.floor(totalMs / 60000);

            if (totalMins < 60) durationText = `${totalMins} minutos`;
            else if (totalMins < 1440) durationText = `${Math.floor(totalMins / 60)} horas`;
            else durationText = `${Math.floor(totalMins / 1440)} días`;

            if (expiresDate <= now) {
                isExpired = true;
                durationText += ' (expirado)';
            } else {
                const remainMs = expiresDate - now;
                const remainMins = Math.floor(remainMs / 60000);
                if (remainMins < 60) durationText += ` (${remainMins}m restantes)`;
                else if (remainMins < 1440) durationText += ` (${Math.floor(remainMins / 60)}h restantes)`;
                else durationText += ` (${Math.floor(remainMins / 1440)}d restantes)`;
            }
        }

        if (!s.active) {
            statusText = 'Revocado';
            statusClass = 'inactive';
        } else if (isExpired) {
            statusText = 'Expirado';
            statusClass = 'inactive';
        } else {
            statusText = 'Activo';
            statusClass = 'active';
        }

        let valueDisplay = `<code>${escapeHtml(s.value)}</code>`;
        if (s.type === 'uuid' && s.minecraft_name) {
            valueDisplay = `<code>${escapeHtml(s.value)}</code><br><small style="color:var(--text-muted)">Nick: ${escapeHtml(s.minecraft_name)}</small>`;
        }

        return `
        <tr>
            <td><code style="color:var(--accent-primary);font-weight:600">#${escapeHtml(s.ban_id || '—')}</code></td>
            <td><span class="type-badge ${s.type}">${s.type.toUpperCase()}</span></td>
            <td>${valueDisplay}</td>
            <td>${escapeHtml(s.reason || 'Sin razón')}</td>
            <td>${escapeHtml(s.added_by)}</td>
            <td>${durationText}</td>
            <td>${formatDate(s.created_at)}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        </tr>
    `;
    }).join('');
}

async function loadProvidersData(page = 1, filter = 'all', search = '') {
    const tbody = document.getElementById('providersTableBody');
    tbody.innerHTML = '<tr><td colspan="7"><div class="loading-spinner"></div></td></tr>';

    try {
        const response = await apiRequest('get_providers', { page, filter, search });
        if (response.success) {
            document.getElementById('provStatHosting').textContent = response.data.stats?.hosting || 0;
            document.getElementById('provStatVPN').textContent = response.data.stats?.vpn || 0;
            document.getElementById('provStatProxy').textContent = response.data.stats?.proxy || 0;

            renderProvidersTable(response.data.providers || []);
            renderPagination('providersPagination', response.data.pagination, (p) => loadProvidersData(p, filter, search));
        }
    } catch (error) {
        console.error('Error loading providers:', error);
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Error al cargar datos</td></tr>';
    }
}

async function loadCountriesData(page = 1, search = '') {
    const tbody = document.getElementById('countriesTableBody');
    tbody.innerHTML = '<tr><td colspan="7"><div class="loading-spinner"></div></td></tr>';

    try {
        const response = await apiRequest('get_countries', { page, search });
        if (response.success) {
            document.getElementById('countryStatTotal').textContent = response.data.stats?.total || 0;
            document.getElementById('countryStatActive').textContent = response.data.stats?.active || 0;
            document.getElementById('countryStatBlocks').textContent = response.data.stats?.total_blocks || 0;

            renderCountriesTable(response.data.countries || []);
            renderPagination('countriesPagination', response.data.pagination, (p) => loadCountriesData(p, search));
        }
    } catch (error) {
        console.error('Error loading countries:', error);
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Error al cargar datos</td></tr>';
    }
}

function getCountryFlag(code) {
    if (!code || code.length !== 2) return '';
    const codePoints = code.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
}

function renderCountriesTable(countries) {
    const tbody = document.getElementById('countriesTableBody');

    if (countries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No hay países bloqueados</td></tr>';
        return;
    }

    tbody.innerHTML = countries.map(c => `
        <tr>
            <td>${getCountryFlag(c.country_code)} ${escapeHtml(c.country_name)}</td>
            <td><code>${escapeHtml(c.country_code)}</code></td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(c.kick_message || 'Por defecto')}">${escapeHtml(c.kick_message || 'Por defecto')}</td>
            <td>${c.block_count}</td>
            <td><span class="status-badge ${c.active == 1 ? 'active' : 'inactive'}">${c.active == 1 ? 'Activo' : 'Inactivo'}</span></td>
            <td>${formatDate(c.created_at)}</td>
            <td>
                <button class="action-btn" onclick="editCountryModal(${c.id}, '${escapeHtml(c.country_name)}', '${escapeHtml(c.kick_message || '')}')">Editar</button>
                ${c.active == 1
                    ? `<button class="action-btn danger" onclick="toggleCountry(${c.id}, false)">Desactivar</button>`
                    : `<button class="action-btn success" onclick="toggleCountry(${c.id}, true)">Activar</button>`
                }
                <button class="action-btn danger" onclick="deleteCountry(${c.id}, '${escapeHtml(c.country_name)}')">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function editCountryModal(id, name, kickMessage) {
    document.getElementById('editCountryId').value = id;
    document.getElementById('editCountryName').value = name;
    document.getElementById('editCountryKickMessage').value = kickMessage;
    document.getElementById('editCountryModal').classList.add('active');
}

async function toggleCountry(id, active) {
    try {
        const response = await apiRequest('toggle_country', { id, active });
        if (response.success) {
            showToast(active ? 'Activado' : 'Desactivado', 'success');
            loadCountriesData();
            loadBadgeCounts();
        }
    } catch (error) {
        showToast('Error', 'error');
    }
}

async function deleteCountry(id, name) {
    if (!await showConfirm(`¿Eliminar el bloqueo de ${name}?`)) return;

    try {
        const response = await apiRequest('delete_country', { id });
        if (response.success) {
            showToast('País desbloqueado', 'success');
            loadCountriesData();
            loadBadgeCounts();
        } else {
            showToast(response.error || 'Error', 'error');
        }
    } catch (error) {
        showToast('Error al eliminar', 'error');
    }
}

async function loadContinentsData() {
    const tbody = document.getElementById('continentsTableBody');
    tbody.innerHTML = '<tr><td colspan="7"><div class="loading-spinner"></div></td></tr>';

    try {
        const response = await apiRequest('get_continents', {});
        if (response.success) {
            document.getElementById('continentStatTotal').textContent = response.data.stats?.total || 0;
            document.getElementById('continentStatActive').textContent = response.data.stats?.active || 0;
            document.getElementById('continentStatBlocks').textContent = response.data.stats?.total_blocks || 0;

            renderContinentsTable(response.data.continents || []);
        }
    } catch (error) {
        console.error('Error loading continents:', error);
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Error al cargar datos</td></tr>';
    }
}

const CONTINENT_ICONS = {
    'AF': '\u{1F30D}', 'AN': '\u{1F9CA}', 'AS': '\u{1F30F}',
    'EU': '\u{1F30D}', 'NA': '\u{1F30E}', 'OC': '\u{1F30F}', 'SA': '\u{1F30E}'
};

function renderContinentsTable(continents) {
    const tbody = document.getElementById('continentsTableBody');

    if (continents.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No hay continentes bloqueados</td></tr>';
        return;
    }

    tbody.innerHTML = continents.map(c => `
        <tr>
            <td>${CONTINENT_ICONS[c.continent_code] || '\u{1F30D}'} ${escapeHtml(c.continent_name)}</td>
            <td><code>${escapeHtml(c.continent_code)}</code></td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(c.kick_message || 'Por defecto')}">${escapeHtml(c.kick_message || 'Por defecto')}</td>
            <td>${c.block_count}</td>
            <td><span class="status-badge ${c.active == 1 ? 'active' : 'inactive'}">${c.active == 1 ? 'Activo' : 'Inactivo'}</span></td>
            <td>${formatDate(c.created_at)}</td>
            <td>
                <button class="action-btn" onclick="editContinentModal(${c.id}, '${escapeHtml(c.continent_name)}', '${escapeHtml(c.kick_message || '')}')">Editar</button>
                ${c.active == 1
                    ? `<button class="action-btn danger" onclick="toggleContinent(${c.id}, false)">Desactivar</button>`
                    : `<button class="action-btn success" onclick="toggleContinent(${c.id}, true)">Activar</button>`
                }
                <button class="action-btn danger" onclick="deleteContinent(${c.id}, '${escapeHtml(c.continent_name)}')">Eliminar</button>
            </td>
        </tr>
    `).join('');
}

function editContinentModal(id, name, kickMessage) {
    document.getElementById('editContinentId').value = id;
    document.getElementById('editContinentName').value = name;
    document.getElementById('editContinentKickMessage').value = kickMessage;
    document.getElementById('editContinentModal').classList.add('active');
}

async function toggleContinent(id, active) {
    try {
        const response = await apiRequest('toggle_continent', { id, active });
        if (response.success) {
            showToast(active ? 'Activado' : 'Desactivado', 'success');
            loadContinentsData();
            loadBadgeCounts();
        }
    } catch (error) {
        showToast('Error', 'error');
    }
}

async function deleteContinent(id, name) {
    if (!await showConfirm(`¿Eliminar el bloqueo de ${name}?`)) return;

    try {
        const response = await apiRequest('delete_continent', { id });
        if (response.success) {
            showToast('Continente desbloqueado', 'success');
            loadContinentsData();
            loadBadgeCounts();
        } else {
            showToast(response.error || 'Error', 'error');
        }
    } catch (error) {
        showToast('Error al eliminar', 'error');
    }
}

function populateCountrySelect() {
    const select = document.getElementById('countrySelect');
    if (select.options.length > 1) return;

    const countries = [
        ["AF","Afganistán"],["AL","Albania"],["DE","Alemania"],["AD","Andorra"],["AO","Angola"],
        ["AG","Antigua y Barbuda"],["SA","Arabia Saudita"],["DZ","Argelia"],["AR","Argentina"],["AM","Armenia"],
        ["AU","Australia"],["AT","Austria"],["AZ","Azerbaiyán"],["BS","Bahamas"],["BD","Bangladés"],
        ["BB","Barbados"],["BH","Baréin"],["BE","Bélgica"],["BZ","Belice"],["BJ","Benín"],
        ["BY","Bielorrusia"],["MM","Birmania"],["BO","Bolivia"],["BA","Bosnia y Herzegovina"],["BW","Botsuana"],
        ["BR","Brasil"],["BN","Brunéi"],["BG","Bulgaria"],["BF","Burkina Faso"],["BI","Burundi"],
        ["BT","Bután"],["CV","Cabo Verde"],["KH","Camboya"],["CM","Camerún"],["CA","Canadá"],
        ["QA","Catar"],["TD","Chad"],["CL","Chile"],["CN","China"],["CY","Chipre"],
        ["CO","Colombia"],["KM","Comoras"],["CG","Congo"],["CD","R.D. del Congo"],["KR","Corea del Sur"],
        ["KP","Corea del Norte"],["CR","Costa Rica"],["CI","Costa de Marfil"],["HR","Croacia"],["CU","Cuba"],
        ["DK","Dinamarca"],["DM","Dominica"],["EC","Ecuador"],["EG","Egipto"],["SV","El Salvador"],
        ["AE","Emiratos Árabes"],["ER","Eritrea"],["SK","Eslovaquia"],["SI","Eslovenia"],["ES","España"],
        ["US","Estados Unidos"],["EE","Estonia"],["SZ","Esuatini"],["ET","Etiopía"],["PH","Filipinas"],
        ["FI","Finlandia"],["FJ","Fiyi"],["FR","Francia"],["GA","Gabón"],["GM","Gambia"],
        ["GE","Georgia"],["GH","Ghana"],["GD","Granada"],["GR","Grecia"],["GT","Guatemala"],
        ["GN","Guinea"],["GQ","Guinea Ecuatorial"],["GW","Guinea-Bisáu"],["GY","Guyana"],["HT","Haití"],
        ["HN","Honduras"],["HU","Hungría"],["IN","India"],["ID","Indonesia"],["IQ","Irak"],
        ["IR","Irán"],["IE","Irlanda"],["IS","Islandia"],["IL","Israel"],["IT","Italia"],
        ["JM","Jamaica"],["JP","Japón"],["JO","Jordania"],["KZ","Kazajistán"],["KE","Kenia"],
        ["KG","Kirguistán"],["KI","Kiribati"],["KW","Kuwait"],["LA","Laos"],["LS","Lesoto"],
        ["LV","Letonia"],["LB","Líbano"],["LR","Liberia"],["LY","Libia"],["LI","Liechtenstein"],
        ["LT","Lituania"],["LU","Luxemburgo"],["MK","Macedonia del Norte"],["MG","Madagascar"],["MY","Malasia"],
        ["MW","Malaui"],["MV","Maldivas"],["ML","Malí"],["MT","Malta"],["MA","Marruecos"],
        ["MU","Mauricio"],["MR","Mauritania"],["MX","México"],["FM","Micronesia"],["MD","Moldavia"],
        ["MC","Mónaco"],["MN","Mongolia"],["ME","Montenegro"],["MZ","Mozambique"],["NA","Namibia"],
        ["NR","Nauru"],["NP","Nepal"],["NI","Nicaragua"],["NE","Níger"],["NG","Nigeria"],
        ["NO","Noruega"],["NZ","Nueva Zelanda"],["OM","Omán"],["NL","Países Bajos"],["PK","Pakistán"],
        ["PW","Palaos"],["PA","Panamá"],["PG","Papúa Nueva Guinea"],["PY","Paraguay"],["PE","Perú"],
        ["PL","Polonia"],["PT","Portugal"],["GB","Reino Unido"],["CF","Rep. Centroafricana"],
        ["CZ","República Checa"],["DO","Rep. Dominicana"],["RW","Ruanda"],["RO","Rumanía"],["RU","Rusia"],
        ["WS","Samoa"],["KN","San Cristóbal y Nieves"],["SM","San Marino"],["VC","San Vicente y Granadinas"],
        ["LC","Santa Lucía"],["ST","Santo Tomé y Príncipe"],["SN","Senegal"],["RS","Serbia"],
        ["SC","Seychelles"],["SL","Sierra Leona"],["SG","Singapur"],["SY","Siria"],["SO","Somalia"],
        ["LK","Sri Lanka"],["ZA","Sudáfrica"],["SD","Sudán"],["SS","Sudán del Sur"],["SE","Suecia"],
        ["CH","Suiza"],["SR","Surinam"],["TH","Tailandia"],["TZ","Tanzania"],["TJ","Tayikistán"],
        ["TL","Timor Oriental"],["TG","Togo"],["TO","Tonga"],["TT","Trinidad y Tobago"],["TN","Túnez"],
        ["TM","Turkmenistán"],["TR","Turquía"],["TV","Tuvalu"],["UA","Ucrania"],["UG","Uganda"],
        ["UY","Uruguay"],["UZ","Uzbekistán"],["VU","Vanuatu"],["VA","Vaticano"],["VE","Venezuela"],
        ["VN","Vietnam"],["YE","Yemen"],["DJ","Yibuti"],["ZM","Zambia"],["ZW","Zimbabue"],
        ["HK","Hong Kong"],["TW","Taiwán"],["PS","Palestina"],["XK","Kosovo"],["EH","Sahara Occidental"],
        ["PR","Puerto Rico"],["CW","Curazao"],["SX","Sint Maarten"],["MO","Macao"]
    ];

    countries.forEach(([code, name]) => {
        const flag = getCountryFlag(code);
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = `${flag} ${name}`;
        select.appendChild(opt);
    });
}

async function loadMessagesData() {
    const container = document.getElementById('messagesEditor');
    container.innerHTML = '<div class="loading-spinner"></div>';

    try {
        const response = await apiRequest('get_messages');
        if (response.success) {
            renderMessagesEditor(response.data.messages || {});
        }
    } catch (error) {
        console.error('Error loading messages:', error);
        container.innerHTML = '<div class="empty-state">Error al cargar mensajes</div>';
    }
}

async function loadLogsData(filter = 'all') {
    const container = document.getElementById('logsContainer');
    container.innerHTML = '<div class="loading-spinner"></div>';

    try {
        const response = await apiRequest('get_logs', { filter });
        if (response.success) {
            renderLogs(response.data.logs || []);
        }
    } catch (error) {
        console.error('Error loading logs:', error);
        container.innerHTML = '<div class="empty-state">Error al cargar logs</div>';
    }
}

async function loadSettingsData() {
    try {
        const response = await apiRequest('get_settings');
        if (response.success) {
            const settings = response.data.settings || {};
            document.getElementById('settingBlockProxy').checked = settings.block_proxy === '1';
            document.getElementById('settingBlockVPN').checked = settings.block_vpn === '1';
            document.getElementById('settingBlockHosting').checked = settings.block_hosting === '1';
            document.getElementById('settingWebhookUrl').value = settings.webhook_url || '';
            document.getElementById('settingNotifyConnections').checked = settings.notify_connections === '1';
            document.getElementById('settingNotifyHispanic').checked = settings.notify_hispanic === '1';
            document.getElementById('settingNotifyBlocks').checked = settings.notify_blocks === '1';
            document.getElementById('settingApiKey').value = settings.api_key || '';
            document.getElementById('settingServerName').value = settings.server_name || '';
            document.getElementById('settingDiscordUrl').value = settings.discord_url || '';
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function loadBadgeCounts() {
    try {
        const response = await apiRequest('get_counts');
        if (response.success) {
            document.getElementById('playersBadge').textContent = response.data.players || 0;
            document.getElementById('whitelistBadge').textContent = response.data.whitelist || 0;
            document.getElementById('blacklistBadge').textContent = response.data.blacklist || 0;
            document.getElementById('providersBadge').textContent = response.data.providers || 0;
            document.getElementById('countriesBadge').textContent = response.data.countries || 0;
            document.getElementById('continentsBadge').textContent = response.data.continents || 0;
        }
    } catch (error) {
        console.error('Error loading counts:', error);
    }
}

function renderPlayersTable(players) {
    const tbody = document.getElementById('playersTableBody');

    if (players.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No se encontraron jugadores</td></tr>';
        return;
    }

    tbody.innerHTML = players.map(player => `
        <tr onclick="showPlayerDetail('${player.uuid}')">
            <td>
                <div class="player-cell">
                    <div class="player-avatar">
                        <img src="https://mineskin.eu/avatar/${player.last_nick}/36.png" alt="${player.last_nick}">
                    </div>
                    <div class="player-info">
                        <span class="player-nick">${escapeHtml(player.last_nick)}</span>
                    </div>
                </div>
            </td>
            <td><code style="font-size:0.75rem;color:var(--text-muted)">${player.uuid}</code></td>
            <td>
                <div class="ip-cell">
                    ${player.last_country_code ? `<img src="https://flagcdn.com/w20/${player.last_country_code.toLowerCase()}.png" class="ip-flag" alt="${player.last_country_code}">` : ''}
                    <span class="ip-address">${player.last_ip || 'N/A'}</span>
                </div>
            </td>
            <td>${player.last_country || 'Desconocido'}</td>
            <td>${player.total_connections}</td>
            <td>${formatDate(player.last_seen)}</td>
            <td>
                ${player.is_online ? '<span class="status-badge online">Online</span>' : '<span class="status-badge offline">Offline</span>'}
                ${player.is_whitelisted ? '<span class="status-badge whitelisted">WL</span>' : ''}
                ${player.is_blacklisted ? '<span class="status-badge blacklisted">BL</span>' : ''}
            </td>
            <td>
                <button class="action-btn" onclick="event.stopPropagation(); showPlayerDetail('${player.uuid}')">Ver</button>
            </td>
        </tr>
    `).join('');
}

function renderConnectionsTable(connections) {
    const tbody = document.getElementById('connectionsTableBody');

    if (connections.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No se encontraron conexiones</td></tr>';
        return;
    }

    tbody.innerHTML = connections.map(conn => `
        <tr class="${conn.blocked ? 'blocked' : ''}">
            <td>
                <div class="player-cell">
                    <div class="player-avatar">
                        <img src="https://mineskin.eu/avatar/${conn.nick}/36.png" alt="${conn.nick}">
                    </div>
                    <span class="player-nick">${escapeHtml(conn.nick)}</span>
                </div>
            </td>
            <td>
                <div class="ip-cell">
                    ${conn.country_code ? `<img src="https://flagcdn.com/w20/${conn.country_code.toLowerCase()}.png" class="ip-flag" alt="${conn.country_code}">` : ''}
                    <div class="ip-info">
                        <span class="ip-address">
                            ${conn.ip}
                            <span class="ip-version ${conn.ip_version}">${conn.ip_version}</span>
                        </span>
                    </div>
                </div>
            </td>
            <td>${conn.country || 'Desconocido'}</td>
            <td>${escapeHtml(conn.isp || 'N/A')}</td>
            <td>${conn.game_version || 'N/A'}</td>
            <td>${formatDate(conn.created_at)}</td>
            <td>
                ${conn.blocked ? `<span class="status-badge blocked">${getBlockReasonLabel(conn.block_reason)}</span>` : '<span class="status-badge allowed">Permitido</span>'}
                ${conn.is_proxy ? '<span class="status-badge proxy">Proxy</span>' : ''}
                ${conn.is_hosting ? '<span class="status-badge hosting">Hosting</span>' : ''}
            </td>
            <td>
                <button class="action-btn" onclick="showConnectionDetail(${conn.id})">Ver</button>
            </td>
        </tr>
    `).join('');
}

function renderIPsTable(ips) {
    const tbody = document.getElementById('ipsTableBody');

    if (ips.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No se encontraron IPs</td></tr>';
        return;
    }

    tbody.innerHTML = ips.map(ip => `
        <tr onclick="showIPDetail('${ip.ip}')">
            <td>
                <div class="ip-cell">
                    ${ip.country_code ? `<img src="https://flagcdn.com/w20/${ip.country_code.toLowerCase()}.png" class="ip-flag" alt="${ip.country_code}">` : ''}
                    <span class="ip-address">${ip.ip}</span>
                </div>
            </td>
            <td>${ip.country || 'Desconocido'}</td>
            <td>
                <div style="display:flex;flex-direction:column;">
                    <span>${escapeHtml(ip.isp || 'N/A')}</span>
                    <small style="color:var(--text-muted)">${ip.asn || ''}</small>
                </div>
            </td>
            <td>${ip.player_count}</td>
            <td>${ip.connection_count}</td>
            <td>${formatDate(ip.first_seen)}</td>
            <td>
                ${ip.is_whitelisted ? '<span class="status-badge whitelisted">Whitelist</span>' : ''}
                ${ip.is_blacklisted ? '<span class="status-badge blacklisted">Blacklist</span>' : ''}
                ${!ip.is_whitelisted && !ip.is_blacklisted ? '<span class="status-badge">Normal</span>' : ''}
            </td>
            <td>
                <button class="action-btn" onclick="event.stopPropagation(); showIPDetail('${ip.ip}')">Ver</button>
            </td>
        </tr>
    `).join('');
}

function renderWhitelistTable(entries) {
    const tbody = document.getElementById('whitelistTableBody');

    if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No hay entradas en whitelist</td></tr>';
        return;
    }

    tbody.innerHTML = entries.map(entry => {
        let valueDisplay = `<code>${escapeHtml(entry.value)}</code>`;
        if (entry.type === 'uuid' && entry.minecraft_name) {
            valueDisplay = `<code>${escapeHtml(entry.value)}</code><br><small style="color:var(--text-muted)">Nick: ${escapeHtml(entry.minecraft_name)}</small>`;
        }

        return `
        <tr>
            <td><span class="type-badge ${entry.type}">${entry.type.toUpperCase()}</span></td>
            <td>${valueDisplay}</td>
            <td>${escapeHtml(entry.reason || 'Sin razón')}</td>
            <td>${escapeHtml(entry.added_by)}</td>
            <td>${formatDate(entry.created_at)}</td>
            <td>
                <button class="action-btn" onclick="editWhitelistEntry(${entry.id}, '${entry.type}', '${escapeHtml(entry.value).replace(/'/g, "\\'")}', '${escapeHtml(entry.reason || '').replace(/'/g, "\\'")}')">Editar</button>
                <button class="action-btn danger" onclick="removeFromWhitelist(${entry.id}, '${entry.type}', '${escapeHtml(entry.value)}')">Eliminar</button>
            </td>
        </tr>
    `;
    }).join('');
}

function renderBlacklistTable(entries) {
    const tbody = document.getElementById('blacklistTableBody');

    if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No hay entradas en blacklist</td></tr>';
        return;
    }

    let rows = '';
    entries.forEach(entry => {
        let expiryText = 'Permanente';
        let isExpired = false;
        if (entry.expires_at) {
            const expiresDate = new Date(entry.expires_at);
            const now = new Date();
            if (expiresDate <= now) {
                expiryText = 'Expirado';
                isExpired = true;
            } else {
                const diffMs = expiresDate - now;
                const diffMins = Math.floor(diffMs / 60000);
                if (diffMins < 60) expiryText = `${diffMins}m restantes`;
                else if (diffMins < 1440) expiryText = `${Math.floor(diffMins / 60)}h restantes`;
                else expiryText = `${Math.floor(diffMins / 1440)}d restantes`;
            }
        }

        let valueDisplay = `<code>${escapeHtml(entry.value)}</code>`;
        if (entry.type === 'uuid' && entry.minecraft_name) {
            valueDisplay = `<code>${escapeHtml(entry.value)}</code><br><small style="color:var(--text-muted)">Nick: ${escapeHtml(entry.minecraft_name)}</small>`;
        }

        // Indicador de IPs manchadas
        const childCount = entry.child_count || 0;
        const childIndicator = childCount > 0
            ? `<br><small style="color:var(--accent-secondary);font-weight:600">+ ${childCount} IP${childCount > 1 ? 's' : ''} asociada${childCount > 1 ? 's' : ''}</small>`
            : '';

        // Mostrar botón "Agregar IP" solo para entradas de tipo uuid o nick
        const canAddIP = entry.type === 'uuid' || entry.type === 'nick';
        const addIpButton = canAddIP
            ? `<button class="action-btn" style="font-size:0.85em;padding:4px 8px" onclick="promptAddIP(${entry.id})">+ IP</button>`
            : '';

        // Fila principal
        rows += `
        <tr class="${childCount > 0 ? 'has-children' : ''}">
            <td><code style="color:var(--accent-primary);font-size:0.85em">#${escapeHtml(entry.ban_id || '—')}</code></td>
            <td><span class="type-badge ${entry.type}">${entry.type.toUpperCase()}</span></td>
            <td>${valueDisplay}${childIndicator}</td>
            <td>${escapeHtml(entry.reason || 'Sin razón')}</td>
            <td>${escapeHtml(entry.added_by)}</td>
            <td>${formatDate(entry.created_at)}</td>
            <td>
                <span class="status-badge ${entry.active && !isExpired ? 'active' : 'inactive'}">${entry.active && !isExpired ? 'Activo' : isExpired ? 'Expirado' : 'Inactivo'}</span>
                <small style="display:block;color:var(--text-muted);margin-top:2px">${expiryText}</small>
            </td>
            <td>
                ${addIpButton}
                <button class="action-btn" onclick="editBlacklistEntry(${entry.id}, '${entry.type}', '${escapeHtml(entry.value).replace(/'/g, "\\'")}', '${escapeHtml(entry.reason || '').replace(/'/g, "\\'")}', '${entry.expires_at || ''}')">Editar</button>
                ${entry.active
            ? `<button class="action-btn danger" onclick="toggleBlacklist(${entry.id}, false)">Desactivar</button>`
            : `<button class="action-btn success" onclick="toggleBlacklist(${entry.id}, true)">Activar</button>`
        }
                <button class="action-btn danger" onclick="removeFromBlacklist(${entry.id})">Eliminar</button>
            </td>
        </tr>
        `;

        // Filas hijas (IPs manchadas)
        if (entry.children && entry.children.length > 0) {
            entry.children.forEach(child => {
                const childExpiryText = child.expires_at ? formatDate(child.expires_at) : 'Permanente';
                rows += `
                <tr class="child-row">
                    <td></td>
                    <td><span class="type-badge ${child.type}" style="opacity:0.7;font-size:0.85em">${child.type.toUpperCase()}</span></td>
                    <td><span style="color:var(--accent-secondary);font-weight:500">${escapeHtml(child.display_value)}</span></td>
                    <td><small style="color:var(--text-muted)">IP asociada</small></td>
                    <td></td>
                    <td></td>
                    <td>
                        <span class="status-badge ${child.active ? 'active' : 'inactive'}" style="font-size:0.85em">${child.active ? 'Activo' : 'Inactivo'}</span>
                    </td>
                    <td>
                        <button class="action-btn danger" style="font-size:0.85em;padding:4px 8px" onclick="removeChildBlacklist(${child.id}, ${entry.id})">Eliminar IP</button>
                    </td>
                </tr>
                `;
            });
        }
    });

    tbody.innerHTML = rows;
}

function renderProvidersTable(providers) {
    const tbody = document.getElementById('providersTableBody');

    if (providers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No hay proveedores bloqueados</td></tr>';
        return;
    }

    tbody.innerHTML = providers.map(prov => `
        <tr>
            <td>${escapeHtml(prov.name)}</td>
            <td><code>${escapeHtml(prov.pattern)}</code></td>
            <td><span class="type-badge ${prov.type}">${prov.type.toUpperCase()}</span></td>
            <td>${prov.block_count}</td>
            <td><span class="status-badge ${prov.active ? 'active' : 'inactive'}">${prov.active ? 'Activo' : 'Inactivo'}</span></td>
            <td>${formatDate(prov.created_at)}</td>
            <td>
                ${prov.active
        ? `<button class="action-btn danger" onclick="toggleProvider(${prov.id}, false)">Desactivar</button>`
        : `<button class="action-btn success" onclick="toggleProvider(${prov.id}, true)">Activar</button>`
    }
            </td>
        </tr>
    `).join('');
}

function renderMessagesEditor(messages) {
    const container = document.getElementById('messagesEditor');

    const messageKeys = Object.keys(messages);
    if (messageKeys.length === 0) {
        container.innerHTML = '<div class="empty-state">No hay mensajes configurados</div>';
        return;
    }

    container.innerHTML = messageKeys.map(key => `
        <div class="message-item">
            <label>${key}</label>
            <p class="message-desc">${getMessageDescription(key)}</p>
            <textarea id="msg_${key}" data-key="${key}">${messages[key] || ''}</textarea>
        </div>
    `).join('');
}

function renderLogs(logs) {
    const container = document.getElementById('logsContainer');

    if (logs.length === 0) {
        container.innerHTML = '<div class="empty-state">No hay logs disponibles</div>';
        return;
    }

    container.innerHTML = logs.map(log => `
        <div class="log-item">
            <div class="log-icon ${getLogIconClass(log.type)}">
                ${getLogIcon(log.type)}
            </div>
            <div class="log-content">
                <div class="log-title">${escapeHtml(log.action)}</div>
                <div class="log-desc">${escapeHtml(log.details || '')}</div>
            </div>
            <div class="log-time">${formatDate(log.created_at)}</div>
        </div>
    `).join('');
}

function renderRecentConnections(connections) {
    const container = document.getElementById('recentConnectionsList');

    if (connections.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Sin conexiones recientes</p></div>';
        return;
    }

    container.innerHTML = connections.slice(0, 5).map(conn => `
        <div class="connection-mini-item" onclick="showPlayerDetail('${conn.uuid}')">
            <div class="player-avatar">
                <img src="https://mineskin.eu/avatar/${conn.nick}/32.png" alt="${conn.nick}">
            </div>
            <div class="info">
                <div class="nick">${escapeHtml(conn.nick)}</div>
                <div class="details">${conn.country || 'Desconocido'} - ${conn.ip}</div>
            </div>
            ${conn.blocked ? '<span class="status-badge blocked">Bloqueado</span>' : '<span class="status-badge allowed">OK</span>'}
            <div class="time">${formatTimeAgo(conn.created_at)}</div>
        </div>
    `).join('');
}

function renderRecentBlocks(blocks) {
    const container = document.getElementById('recentBlocksList');

    if (blocks.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Sin bloqueos recientes</p></div>';
        return;
    }

    container.innerHTML = blocks.slice(0, 5).map(block => {
        let valueDisplay = escapeHtml(block.value);
        if (block.type === 'uuid' && block.minecraft_name) {
            valueDisplay = `${escapeHtml(block.value)}<br><small style="color:var(--text-muted)">Nick: ${escapeHtml(block.minecraft_name)}</small>`;
        }

        return `
        <div class="block-mini-item">
            <span class="type-badge ${block.type}">${block.type}</span>
            <div class="info">
                <div class="value">${valueDisplay}</div>
                <div class="reason">${escapeHtml(block.reason || 'Sin razón')}</div>
            </div>
            <div class="time">${formatTimeAgo(block.created_at)}</div>
        </div>
    `;
    }).join('');
}

function renderPagination(containerId, pagination, callback) {
    const container = document.getElementById(containerId);
    if (!pagination || pagination.total_pages <= 1) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = '';

    function addBtn(label, page, disabled, active) {
        const btn = document.createElement('button');
        btn.textContent = label;
        if (disabled) btn.disabled = true;
        if (active) btn.classList.add('active');
        if (!disabled) btn.addEventListener('click', () => callback(page));
        container.appendChild(btn);
    }

    addBtn('Anterior', pagination.current_page - 1, pagination.current_page === 1);

    for (let i = 1; i <= pagination.total_pages; i++) {
        if (i === 1 || i === pagination.total_pages || (i >= pagination.current_page - 2 && i <= pagination.current_page + 2)) {
            addBtn(i, i, false, i === pagination.current_page);
        } else if (i === pagination.current_page - 3 || i === pagination.current_page + 3) {
            addBtn('...', null, true);
        }
    }

    addBtn('Siguiente', pagination.current_page + 1, pagination.current_page === pagination.total_pages);
}

async function showPlayerDetail(uuid) {
    const modal = document.getElementById('playerModal');
    const content = document.getElementById('playerModalContent');
    const footer = document.getElementById('playerModalFooter');

    modal.classList.add('active');
    content.innerHTML = '<div class="loading-spinner"></div>';
    footer.innerHTML = '';

    try {
        const response = await apiRequest('get_player_detail', { uuid });
        if (response.success) {
            const player = response.data.player;
            const nicks = response.data.nicks || [];
            const ips = response.data.ips || [];

            content.innerHTML = `
                <div class="player-detail">
                    <div class="player-skin-viewer" id="skinViewer"></div>
                    <div class="player-detail-info">
                        <div class="detail-grid">
                            <div class="detail-item">
                                <div class="detail-label">Nick Actual</div>
                                <div class="detail-value">${escapeHtml(player.last_nick)}</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">Estado</div>
                                <div class="detail-value">
                                    ${player.is_online ? '<span class="status-badge online">Online</span>' : '<span class="status-badge offline">Offline</span>'}
                                </div>
                            </div>
                            <div class="detail-item full">
                                <div class="detail-label">UUID</div>
                                <div class="detail-value" style="font-family:monospace;font-size:0.8rem">${player.uuid}</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">Última IP</div>
                                <div class="detail-value">${player.last_ip || 'N/A'}</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">País</div>
                                <div class="detail-value">${player.last_country || 'Desconocido'}</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">Conexiones</div>
                                <div class="detail-value">${player.total_connections}</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">Primera vez</div>
                                <div class="detail-value">${formatDate(player.first_seen)}</div>
                            </div>
                        </div>
                        
                        <div class="detail-section">
                            <h4>Historial de Nicks (${nicks.length})</h4>
                            <div class="history-list">
                                ${nicks.map(n => `
                                    <div class="history-item">
                                        <span class="value">${escapeHtml(n.nick)}</span>
                                        <span class="date">${formatDate(n.first_used)}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div class="detail-section">
                            <h4>Historial de IPs (${ips.length})</h4>
                            <div class="history-list">
                                ${ips.map(ip => `
                                    <div class="history-item">
                                        <span class="value">${ip.ip}</span>
                                        <span>${ip.country || ''}</span>
                                        <span class="date">${formatDate(ip.first_used)}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `;

            setTimeout(() => {
                initSkinViewer(player.last_nick);
            }, 100);

            // Determinar el tipo de ban apropiado según si el jugador es premium o no
            const banInfo = getBanTypeForPlayer(uuid, player.last_nick);
            const wlType = banInfo.type;
            const wlValue = banInfo.value;

            footer.innerHTML = `
                ${!player.is_whitelisted ? `<button class="btn-success" onclick="closeModal('playerModal'); openWhitelistModal('${wlType}', '${wlValue}', true)">Añadir a Whitelist</button>` : `<button class="btn-ghost" onclick="removeFromWhitelistByValue('${wlType}', '${wlValue}')">Quitar de Whitelist</button>`}
                ${!player.is_blacklisted ? `<button class="btn-danger" onclick="closeModal('playerModal'); openBlacklistModal('${wlType}', '${wlValue}', true)">Añadir a Blacklist</button>` : `<button class="btn-ghost" onclick="removeFromBlacklistByValue('${wlType}', '${wlValue}')">Quitar de Blacklist</button>`}
            `;
        }
    } catch (error) {
        console.error('Error loading player detail:', error);
        content.innerHTML = '<div class="empty-state">Error al cargar datos del jugador</div>';
    }
}

function initSkinViewer(nick) {
    const container = document.getElementById('skinViewer');
    if (!container || typeof skinview3d === 'undefined') return;

    if (skinViewer) {
        skinViewer.dispose();
    }

    skinViewer = new skinview3d.SkinViewer({
        canvas: document.createElement('canvas'),
        width: 200,
        height: 300,
        skin: `https://mineskin.eu/skin/${nick}`
    });

    container.innerHTML = '';
    container.appendChild(skinViewer.canvas);

    skinViewer.camera.position.set(0, 18, 45);
    skinViewer.autoRotate = true;
    skinViewer.autoRotateSpeed = 1;

    skinViewer.animation = new skinview3d.WalkingAnimation();
    skinViewer.animation.speed = 0.5;

    skinViewer.controls.enableRotate = true;
    skinViewer.controls.enableZoom = false;
}

async function showIPDetail(ip) {
    const modal = document.getElementById('ipModal');
    const content = document.getElementById('ipModalContent');
    const footer = document.getElementById('ipModalFooter');

    modal.classList.add('active');
    content.innerHTML = '<div class="loading-spinner"></div>';
    footer.innerHTML = '';

    try {
        const response = await apiRequest('get_ip_detail', { ip });
        if (response.success) {
            const ipData = response.data.ip;
            const players = response.data.players || [];

            content.innerHTML = `
                <div class="detail-grid">
                    <div class="detail-item full">
                        <div class="detail-label">IP</div>
                        <div class="detail-value" style="font-family:monospace">${ipData.ip}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">País</div>
                        <div class="detail-value">${ipData.country || 'Desconocido'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">ISP</div>
                        <div class="detail-value">${escapeHtml(ipData.isp || 'N/A')}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">ASN</div>
                        <div class="detail-value">${ipData.asn || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Conexiones</div>
                        <div class="detail-value">${ipData.connection_count}</div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Jugadores que usaron esta IP (${players.length})</h4>
                    <div class="history-list">
                        ${players.map(p => `
                            <div class="history-item" style="cursor:pointer" onclick="showPlayerDetail('${p.uuid}'); closeModal('ipModal');">
                                <img src="https://mineskin.eu/avatar/${p.nick}/24.png" style="width:24px;height:24px;border-radius:4px">
                                <span class="value">${escapeHtml(p.nick)}</span>
                                <span class="date">${formatDate(p.last_used)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;

            footer.innerHTML = `
                ${!ipData.is_whitelisted ? `<button class="btn-success" onclick="closeModal('ipModal'); openWhitelistModal('ip', '${ip}', true)">Añadir a Whitelist</button>` : `<button class="btn-ghost" onclick="removeFromWhitelistByValue('ip', '${ip}')">Quitar de Whitelist</button>`}
                ${!ipData.is_blacklisted ? `<button class="btn-danger" onclick="closeModal('ipModal'); openBlacklistModal('ip', '${ip}', true)">Añadir a Blacklist</button>` : `<button class="btn-ghost" onclick="removeFromBlacklistByValue('ip', '${ip}')">Quitar de Blacklist</button>`}
            `;
        }
    } catch (error) {
        console.error('Error loading IP detail:', error);
        content.innerHTML = '<div class="empty-state">Error al cargar datos de la IP</div>';
    }
}

async function showConnectionDetail(id) {
    const modal = document.getElementById('connectionModal');
    const content = document.getElementById('connectionModalContent');
    const footer = document.getElementById('connectionModalFooter');

    modal.classList.add('active');
    content.innerHTML = '<div class="loading-spinner"></div>';
    footer.innerHTML = '';

    try {
        const response = await apiRequest('get_connection_detail', { id });
        if (response.success) {
            const conn = response.data.connection;

            content.innerHTML = `
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">Jugador</div>
                        <div class="detail-value">
                            <div class="player-cell">
                                ${conn.uuid ? `<img src="https://mineskin.eu/avatar/${conn.nick}/32.png" style="width:32px;height:32px;border-radius:4px;margin-right:8px">` : ''}
                                ${escapeHtml(conn.nick)}
                            </div>
                        </div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">UUID</div>
                        <div class="detail-value" style="font-family:monospace;font-size:0.8rem">${conn.uuid || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">IP</div>
                        <div class="detail-value" style="font-family:monospace">${conn.ip} <span class="ip-version ${conn.ip_version}">${conn.ip_version}</span></div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Estado</div>
                        <div class="detail-value">
                            ${conn.blocked ? `<span class="status-badge blocked">${getBlockReasonLabel(conn.block_reason)}</span>` : '<span class="status-badge allowed">Permitido</span>'}
                        </div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">País</div>
                        <div class="detail-value">
                            ${conn.country_code ? `<img src="https://flagcdn.com/w20/${conn.country_code.toLowerCase()}.png" class="ip-flag" alt="${conn.country_code}">` : ''}
                            ${conn.country || 'Desconocido'} ${conn.city ? '- ' + escapeHtml(conn.city) : ''} ${conn.region ? '(' + escapeHtml(conn.region) + ')' : ''}
                        </div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">ISP</div>
                        <div class="detail-value">${escapeHtml(conn.isp || 'N/A')}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Organización</div>
                        <div class="detail-value">${escapeHtml(conn.org || 'N/A')}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">ASN</div>
                        <div class="detail-value">${escapeHtml(conn.asn || 'N/A')} ${conn.asname ? '(' + escapeHtml(conn.asname) + ')' : ''}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Versión</div>
                        <div class="detail-value">${conn.game_version || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Fecha</div>
                        <div class="detail-value">${formatDate(conn.created_at)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Detección</div>
                        <div class="detail-value">
                            ${conn.is_proxy ? '<span class="status-badge proxy">Proxy</span>' : ''}
                            ${conn.is_vpn ? '<span class="status-badge vpn">VPN</span>' : ''}
                            ${conn.is_hosting ? '<span class="status-badge hosting">Hosting</span>' : ''}
                            ${conn.is_mobile ? '<span class="status-badge">Mobile</span>' : ''}
                            ${!conn.is_proxy && !conn.is_vpn && !conn.is_hosting && !conn.is_mobile ? '<span class="status-badge allowed">Limpio</span>' : ''}
                        </div>
                    </div>
                    ${conn.latitude && conn.longitude ? `
                    <div class="detail-item">
                        <div class="detail-label">Coordenadas</div>
                        <div class="detail-value">${conn.latitude}, ${conn.longitude}</div>
                    </div>` : ''}
                    ${conn.timezone ? `
                    <div class="detail-item">
                        <div class="detail-label">Zona horaria</div>
                        <div class="detail-value">${escapeHtml(conn.timezone)}</div>
                    </div>` : ''}
                </div>
            `;

            footer.innerHTML = conn.uuid ? `<button class="btn-primary" onclick="showPlayerDetail('${conn.uuid}'); closeModal('connectionModal');">Ver Jugador</button>` : '';
        }
    } catch (error) {
        console.error('Error loading connection detail:', error);
        content.innerHTML = '<div class="empty-state">Error al cargar datos de la conexión</div>';
    }
}

function initFilterListeners() {
    document.querySelectorAll('[data-player-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-player-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadPlayersData(1, btn.dataset.playerFilter);
        });
    });

    document.querySelectorAll('[data-conn-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-conn-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadConnectionsData(1, btn.dataset.connFilter);
        });
    });

    document.querySelectorAll('[data-wl-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-wl-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadWhitelistData(btn.dataset.wlFilter);
        });
    });

    document.querySelectorAll('[data-bl-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-bl-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadBlacklistData(btn.dataset.blFilter);
        });
    });

    document.querySelectorAll('[data-sanction-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-sanction-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadSanctionsData(1, btn.dataset.sanctionFilter);
        });
    });

    document.querySelectorAll('[data-prov-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-prov-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadProvidersData(1, btn.dataset.provFilter);
        });
    });

    document.querySelectorAll('[data-log-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-log-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadLogsData(btn.dataset.logFilter);
        });
    });

    document.getElementById('playersSearch')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loadPlayersData(1, 'all', e.target.value);
    });

    document.getElementById('connectionsSearch')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loadConnectionsData(1, 'all', e.target.value);
    });

    document.getElementById('ipsSearch')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loadIPsData(1, e.target.value);
    });

    document.getElementById('whitelistSearch')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loadWhitelistData('all', e.target.value);
    });

    document.getElementById('blacklistSearch')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loadBlacklistData('all', e.target.value);
    });

    document.getElementById('providersSearch')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loadProvidersData(1, 'all', e.target.value);
    });

    document.getElementById('sanctionsSearch')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loadSanctionsData(1, 'all', e.target.value);
    });
}

function initModalListeners() {
    document.querySelectorAll('.modal-overlay, .modal-close, .modal-cancel').forEach(el => {
        el.addEventListener('click', (e) => {
            e.target.closest('.modal').classList.remove('active');
        });
    });

    document.getElementById('addWhitelistBtn')?.addEventListener('click', () => {
        openWhitelistModal();
    });

    document.getElementById('confirmWhitelist')?.addEventListener('click', async () => {
        const type = document.getElementById('wlType').value;
        const value = document.getElementById('wlValue').value.trim();
        const reason = document.getElementById('wlReason').value.trim();

        if (!value) {
            showToast('Introduce un valor', 'error');
            return;
        }

        await addToWhitelist(type, value, reason);
        closeModal('whitelistModal');
    });

    document.getElementById('addBlacklistBtn')?.addEventListener('click', () => {
        openBlacklistModal();
    });

    document.getElementById('blDuration')?.addEventListener('change', () => {
        const custom = document.getElementById('blDuration').value === 'custom';
        document.getElementById('blCustomDurationGroup').style.display = custom ? '' : 'none';
        if (!custom) document.getElementById('blCustomDuration').value = '';
    });

    // Actualizar textos de ayuda según el tipo de blacklist
    document.getElementById('blType')?.addEventListener('change', (e) => {
        const type = e.target.value;
        const typeHelp = document.getElementById('blTypeHelp');
        const valueHelp = document.getElementById('blValueHelp');
        const blValue = document.getElementById('blValue');

        const helpTexts = {
            uuid: {
                type: 'UUID para jugadores premium (con cuenta de Mojang/Microsoft)',
                value: 'UUID del jugador (ej: 123e4567-e89b-12d3-a456-426614174000)',
                placeholder: 'Introduce la UUID...'
            },
            nick: {
                type: 'Nick para jugadores no-premium/offline (sin UUID real)',
                value: 'Nick del jugador (ej: Player123)',
                placeholder: 'Introduce el nick...'
            },
            ip: {
                type: 'Dirección IP específica',
                value: 'Dirección IPv4 o IPv6 (ej: 192.168.1.1)',
                placeholder: 'Introduce la IP...'
            },
            ip_range: {
                type: 'Rango de IPs usando notación CIDR',
                value: 'Rango CIDR (ej: 192.168.1.0/24)',
                placeholder: 'Introduce el rango CIDR...'
            },
            as: {
                type: 'Número de Sistema Autónomo',
                value: 'Número AS (ej: AS12345 o 12345)',
                placeholder: 'Introduce el número AS...'
            }
        };

        if (helpTexts[type]) {
            if (typeHelp) typeHelp.textContent = helpTexts[type].type;
            if (valueHelp) valueHelp.textContent = helpTexts[type].value;
            blValue.placeholder = helpTexts[type].placeholder;
        }
    });

    document.getElementById('confirmBlacklist')?.addEventListener('click', async () => {
        const type = document.getElementById('blType').value;
        const value = document.getElementById('blValue').value.trim();
        const reason = document.getElementById('blReason').value.trim();
        const stainIp = document.getElementById('blStainIp').checked ? 1 : 0;

        if (!value) {
            showToast('Introduce un valor', 'error');
            return;
        }

        let duration = parseInt(document.getElementById('blDuration').value) || 0;
        if (document.getElementById('blDuration').value === 'custom') {
            duration = parseInt(document.getElementById('blCustomDuration').value) || 0;
            if (duration <= 0) {
                showToast('Introduce una duración válida', 'error');
                return;
            }
        }

        await addToBlacklist(type, value, reason, duration, stainIp);
        closeModal('blacklistModal');
    });

    document.getElementById('addProviderBtn')?.addEventListener('click', () => {
        document.getElementById('providerModal').classList.add('active');
        document.getElementById('provName').value = '';
        document.getElementById('provPattern').value = '';
        document.getElementById('provType').value = 'hosting';
    });

    document.getElementById('confirmProvider')?.addEventListener('click', async () => {
        const name = document.getElementById('provName').value.trim();
        const pattern = document.getElementById('provPattern').value.trim();
        const type = document.getElementById('provType').value;

        if (!name || !pattern) {
            showToast('Completa todos los campos', 'error');
            return;
        }

        await addProvider(name, pattern, type);
        closeModal('providerModal');
    });

    document.getElementById('addCountryBtn')?.addEventListener('click', () => {
        populateCountrySelect();
        document.getElementById('countryModal').classList.add('active');
        document.getElementById('countrySelect').value = '';
        document.getElementById('countryKickMessage').value = '';
    });

    document.getElementById('confirmCountry')?.addEventListener('click', async () => {
        const select = document.getElementById('countrySelect');
        const code = select.value;
        const name = select.options[select.selectedIndex]?.text || '';
        const kickMessage = document.getElementById('countryKickMessage').value.trim();

        if (!code) {
            showToast('Selecciona un país', 'error');
            return;
        }

        try {
            const response = await apiRequest('add_country', { country_code: code, country_name: name, kick_message: kickMessage });
            if (response.success) {
                showToast('País bloqueado', 'success');
                closeModal('countryModal');
                loadCountriesData();
                loadBadgeCounts();
            } else {
                showToast(response.error || 'Error', 'error');
            }
        } catch (error) {
            showToast('Error al añadir país', 'error');
        }
    });

    document.getElementById('confirmEditCountry')?.addEventListener('click', async () => {
        const id = document.getElementById('editCountryId').value;
        const name = document.getElementById('editCountryName').value.trim();
        const kickMessage = document.getElementById('editCountryKickMessage').value.trim();

        if (!name) {
            showToast('Introduce un nombre', 'error');
            return;
        }

        try {
            const response = await apiRequest('edit_country', { id: parseInt(id), country_name: name, kick_message: kickMessage });
            if (response.success) {
                showToast('País actualizado', 'success');
                closeModal('editCountryModal');
                loadCountriesData();
            } else {
                showToast(response.error || 'Error', 'error');
            }
        } catch (error) {
            showToast('Error al editar', 'error');
        }
    });

    document.getElementById('countriesSearch')?.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') loadCountriesData(1, e.target.value);
    });

    document.getElementById('addContinentBtn')?.addEventListener('click', () => {
        document.getElementById('continentModal').classList.add('active');
        document.getElementById('continentSelect').value = '';
        document.getElementById('continentKickMessage').value = '';
    });

    document.getElementById('confirmContinent')?.addEventListener('click', async () => {
        const select = document.getElementById('continentSelect');
        const code = select.value;
        const name = select.options[select.selectedIndex]?.text || '';
        const kickMessage = document.getElementById('continentKickMessage').value.trim();

        if (!code) {
            showToast('Selecciona un continente', 'error');
            return;
        }

        try {
            const response = await apiRequest('add_continent', { continent_code: code, continent_name: name, kick_message: kickMessage });
            if (response.success) {
                showToast('Continente bloqueado', 'success');
                closeModal('continentModal');
                loadContinentsData();
                loadBadgeCounts();
            } else {
                showToast(response.error || 'Error', 'error');
            }
        } catch (error) {
            showToast('Error al añadir continente', 'error');
        }
    });

    document.getElementById('confirmEditContinent')?.addEventListener('click', async () => {
        const id = document.getElementById('editContinentId').value;
        const name = document.getElementById('editContinentName').value.trim();
        const kickMessage = document.getElementById('editContinentKickMessage').value.trim();

        if (!name) {
            showToast('Introduce un nombre', 'error');
            return;
        }

        try {
            const response = await apiRequest('edit_continent', { id: parseInt(id), continent_name: name, kick_message: kickMessage });
            if (response.success) {
                showToast('Continente actualizado', 'success');
                closeModal('editContinentModal');
                loadContinentsData();
            } else {
                showToast(response.error || 'Error', 'error');
            }
        } catch (error) {
            showToast('Error al editar', 'error');
        }
    });

    document.getElementById('confirmEditWhitelist')?.addEventListener('click', async () => {
        const id = document.getElementById('editWlId').value;
        const type = document.getElementById('editWlType').value;
        const value = document.getElementById('editWlValue').value.trim();
        const reason = document.getElementById('editWlReason').value.trim();

        if (!value) {
            showToast('Introduce un valor', 'error');
            return;
        }

        try {
            const response = await apiRequest('edit_whitelist', { id: parseInt(id), type, value, reason });
            if (response.success) {
                showToast('Whitelist actualizada', 'success');
                closeModal('editWhitelistModal');
                loadWhitelistData();
            } else {
                showToast(response.error || 'Error', 'error');
            }
        } catch (error) {
            showToast('Error al editar', 'error');
        }
    });

    document.getElementById('editBlDuration')?.addEventListener('change', () => {
        const custom = document.getElementById('editBlDuration').value === 'custom';
        document.getElementById('editBlCustomDurationGroup').style.display = custom ? '' : 'none';
        if (!custom) document.getElementById('editBlCustomDuration').value = '';
    });

    document.getElementById('confirmEditBlacklist')?.addEventListener('click', async () => {
        const id = document.getElementById('editBlId').value;
        const type = document.getElementById('editBlType').value;
        const value = document.getElementById('editBlValue').value.trim();
        const reason = document.getElementById('editBlReason').value.trim();

        if (!value) {
            showToast('Introduce un valor', 'error');
            return;
        }

        let duration = parseInt(document.getElementById('editBlDuration').value);
        if (document.getElementById('editBlDuration').value === 'custom') {
            duration = parseInt(document.getElementById('editBlCustomDuration').value) || 0;
            if (duration <= 0) {
                showToast('Introduce una duración válida', 'error');
                return;
            }
        }

        try {
            const response = await apiRequest('edit_blacklist', { id: parseInt(id), type, value, reason, duration });
            if (response.success) {
                showToast('Blacklist actualizada', 'success');
                closeModal('editBlacklistModal');
                loadBlacklistData();
            } else {
                showToast(response.error || 'Error', 'error');
            }
        } catch (error) {
            showToast('Error al editar', 'error');
        }
    });

    document.getElementById('addAdminUserBtn')?.addEventListener('click', () => {
        document.getElementById('adminUserModal').classList.add('active');
        document.getElementById('adminUserDiscordId').value = '';
        document.getElementById('adminUserRole').value = 'admin';
    });

    document.getElementById('confirmAddAdminUser')?.addEventListener('click', () => {
        addAdminUser();
    });

    // Escape key closes any active modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal.active');
            if (activeModal) {
                activeModal.classList.remove('active');
            }
        }
    });
}

function initQuickActions() {
    document.getElementById('quickAddWhitelist')?.addEventListener('click', () => {
        openWhitelistModal();
    });

    document.getElementById('quickAddBlacklist')?.addEventListener('click', () => {
        openBlacklistModal();
    });

    document.getElementById('quickSearchPlayer')?.addEventListener('click', () => {
        switchSection('players');
        setTimeout(() => document.getElementById('playersSearch')?.focus(), 100);
    });

    document.getElementById('quickExport')?.addEventListener('click', exportData);
}

function initSettingsListeners() {
    document.getElementById('saveSettings')?.addEventListener('click', saveSettings);
    document.getElementById('saveMessages')?.addEventListener('click', saveMessages);

    document.getElementById('toggleApiKey')?.addEventListener('click', () => {
        const input = document.getElementById('settingApiKey');
        input.type = input.type === 'password' ? 'text' : 'password';
    });

    document.getElementById('regenerateApiKey')?.addEventListener('click', async () => {
        if (await showConfirm('¿Seguro que quieres regenerar la API Key? Tendrás que actualizar el plugin.')) {
            try {
                const response = await apiRequest('regenerate_api_key');
                if (response.success) {
                    document.getElementById('settingApiKey').value = response.data.api_key;
                    showToast('API Key regenerada', 'success');
                }
            } catch (error) {
                showToast('Error al regenerar API Key', 'error');
            }
        }
    });
}

async function addToWhitelist(type, value, reason = '') {
    try {
        const response = await apiRequest('add_whitelist', { type, value, reason });
        if (response.success) {
            showToast('Añadido a whitelist', 'success');
            loadWhitelistData();
            loadBadgeCounts();
        } else {
            showToast(response.error || 'Error', 'error');
        }
    } catch (error) {
        showToast('Error al añadir a whitelist', 'error');
    }
}

async function removeFromWhitelist(id, type, value) {
    if (!await showConfirm(`¿Eliminar ${type}: ${value} de whitelist?`)) return;

    try {
        const response = await apiRequest('remove_whitelist', { id });
        if (response.success) {
            showToast('Eliminado de whitelist', 'success');
            loadWhitelistData();
            loadBadgeCounts();
        }
    } catch (error) {
        showToast('Error al eliminar', 'error');
    }
}

async function removeFromWhitelistByValue(type, value) {
    try {
        const response = await apiRequest('remove_whitelist_by_value', { type, value });
        if (response.success) {
            showToast('Eliminado de whitelist', 'success');
            closeAllModals();
        }
    } catch (error) {
        showToast('Error al eliminar', 'error');
    }
}

function openBlacklistModal(prefillType = 'uuid', prefillValue = '', readonly = false) {
    document.getElementById('blacklistModal').classList.add('active');
    document.getElementById('blType').value = prefillType;
    document.getElementById('blValue').value = prefillValue;
    document.getElementById('blReason').value = '';
    document.getElementById('blDuration').value = '0';
    document.getElementById('blCustomDurationGroup').style.display = 'none';
    document.getElementById('blCustomDuration').value = '';
    document.getElementById('blType').disabled = readonly;
    document.getElementById('blValue').readOnly = readonly;
    // Actualizar textos de ayuda según el tipo preseleccionado
    updateBlacklistHelpText(prefillType);
    if (readonly) {
        setTimeout(() => document.getElementById('blReason').focus(), 100);
    }
}

function openWhitelistModal(prefillType = 'uuid', prefillValue = '', readonly = false) {
    document.getElementById('whitelistModal').classList.add('active');
    document.getElementById('wlType').value = prefillType;
    document.getElementById('wlValue').value = prefillValue;
    document.getElementById('wlReason').value = '';
    document.getElementById('wlType').disabled = readonly;
    document.getElementById('wlValue').readOnly = readonly;
    if (readonly) {
        setTimeout(() => document.getElementById('wlReason').focus(), 100);
    }
}

/**
 * Actualiza los textos de ayuda del modal de blacklist según el tipo seleccionado
 */
function updateBlacklistHelpText(type) {
    const typeHelp = document.getElementById('blTypeHelp');
    const valueHelp = document.getElementById('blValueHelp');
    const blValue = document.getElementById('blValue');

    const helpTexts = {
        uuid: {
            type: 'UUID para jugadores premium (con cuenta de Mojang/Microsoft)',
            value: 'UUID del jugador (ej: 123e4567-e89b-12d3-a456-426614174000)',
            placeholder: 'Introduce la UUID...'
        },
        nick: {
            type: 'Nick para jugadores no-premium/offline (sin UUID real)',
            value: 'Nick del jugador (ej: Player123)',
            placeholder: 'Introduce el nick...'
        },
        ip: {
            type: 'Dirección IP específica',
            value: 'Dirección IPv4 o IPv6 (ej: 192.168.1.1)',
            placeholder: 'Introduce la IP...'
        },
        ip_range: {
            type: 'Rango de IPs usando notación CIDR',
            value: 'Rango CIDR (ej: 192.168.1.0/24)',
            placeholder: 'Introduce el rango CIDR...'
        },
        as: {
            type: 'Número de Sistema Autónomo',
            value: 'Número AS (ej: AS12345 o 12345)',
            placeholder: 'Introduce el número AS...'
        }
    };

    if (helpTexts[type]) {
        typeHelp.textContent = helpTexts[type].type;
        valueHelp.textContent = helpTexts[type].value;
        blValue.placeholder = helpTexts[type].placeholder;
    }
}

async function addToBlacklist(type, value, reason = '', duration = 0, stainIp = 1) {
    try {
        const response = await apiRequest('add_blacklist', { type, value, reason, duration, stain_ip: stainIp });
        if (response.success) {
            showToast('Añadido a blacklist', 'success');
            loadBlacklistData();
            loadBadgeCounts();
        } else {
            showToast(response.error || 'Error', 'error');
        }
    } catch (error) {
        showToast('Error al añadir a blacklist', 'error');
    }
}

async function removeFromBlacklist(id) {
    if (!await showConfirm('¿Eliminar de blacklist? Las IPs asociadas también se eliminarán.')) return;

    try {
        const response = await apiRequest('remove_blacklist', { id });
        if (response.success) {
            showToast('Eliminado de blacklist', 'success');
            loadBlacklistData();
            loadBadgeCounts();
        }
    } catch (error) {
        showToast('Error al eliminar', 'error');
    }
}

async function removeChildBlacklist(childId, parentId) {
    if (!await showConfirm('¿Eliminar esta IP de la blacklist?')) return;

    try {
        const response = await apiRequest('remove_blacklist', { id: childId });
        if (response.success) {
            showToast('IP eliminada de blacklist', 'success');
            loadBlacklistData();
            loadBadgeCounts();
        }
    } catch (error) {
        showToast('Error al eliminar', 'error');
    }
}

async function promptAddIP(parentId) {
    const ip = await showPrompt('Introduce la dirección IP a añadir:', '', 'Añadir IP', 'ej: 192.168.1.1');
    if (!ip) return;

    const ipTrimmed = ip.trim();

    // Validación básica de formato IP
    const ipPattern = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/;
    if (!ipPattern.test(ipTrimmed)) {
        showToast('Formato de IP inválido', 'error');
        return;
    }

    try {
        const response = await apiRequest('add_blacklist_ip', { parent_id: parentId, ip: ipTrimmed });
        if (response.success) {
            showToast('IP añadida a blacklist', 'success');
            loadBlacklistData();
            loadBadgeCounts();
        } else {
            showToast(response.error || 'Error al añadir IP', 'error');
        }
    } catch (error) {
        showToast('Error al añadir IP', 'error');
    }
}

async function removeFromBlacklistByValue(type, value) {
    try {
        const response = await apiRequest('remove_blacklist_by_value', { type, value });
        if (response.success) {
            showToast('Eliminado de blacklist', 'success');
            closeAllModals();
        }
    } catch (error) {
        showToast('Error al eliminar', 'error');
    }
}

async function toggleBlacklist(id, active) {
    try {
        const response = await apiRequest('toggle_blacklist', { id, active });
        if (response.success) {
            showToast(active ? 'Activado' : 'Desactivado', 'success');
            loadBlacklistData();
        }
    } catch (error) {
        showToast('Error', 'error');
    }
}

function editWhitelistEntry(id, type, value, reason) {
    document.getElementById('editWlId').value = id;
    document.getElementById('editWlType').value = type;
    document.getElementById('editWlValue').value = value;
    document.getElementById('editWlReason').value = reason;
    document.getElementById('editWhitelistModal').classList.add('active');
}

function editBlacklistEntry(id, type, value, reason, expiresAt) {
    document.getElementById('editBlId').value = id;
    document.getElementById('editBlType').value = type;
    document.getElementById('editBlValue').value = value;
    document.getElementById('editBlReason').value = reason;
    document.getElementById('editBlDuration').value = '-1';
    document.getElementById('editBlCustomDurationGroup').style.display = 'none';
    document.getElementById('editBlCustomDuration').value = '';
    document.getElementById('editBlacklistModal').classList.add('active');
}

async function addProvider(name, pattern, type) {
    try {
        const response = await apiRequest('add_provider', { name, pattern, type });
        if (response.success) {
            showToast('Proveedor añadido', 'success');
            loadProvidersData();
            loadBadgeCounts();
        } else {
            showToast(response.error || 'Error', 'error');
        }
    } catch (error) {
        showToast('Error al añadir proveedor', 'error');
    }
}

async function toggleProvider(id, active) {
    try {
        const response = await apiRequest('toggle_provider', { id, active });
        if (response.success) {
            showToast(active ? 'Activado' : 'Desactivado', 'success');
            loadProvidersData();
        }
    } catch (error) {
        showToast('Error', 'error');
    }
}

async function saveSettings() {
    const settings = {
        block_proxy: document.getElementById('settingBlockProxy').checked ? '1' : '0',
        block_vpn: document.getElementById('settingBlockVPN').checked ? '1' : '0',
        block_hosting: document.getElementById('settingBlockHosting').checked ? '1' : '0',
        webhook_url: document.getElementById('settingWebhookUrl').value,
        notify_connections: document.getElementById('settingNotifyConnections').checked ? '1' : '0',
        notify_hispanic: document.getElementById('settingNotifyHispanic').checked ? '1' : '0',
        notify_blocks: document.getElementById('settingNotifyBlocks').checked ? '1' : '0',
        server_name: document.getElementById('settingServerName').value,
        discord_url: document.getElementById('settingDiscordUrl').value
    };

    try {
        const response = await apiRequest('save_settings', { settings });
        if (response.success) {
            showToast('Configuración guardada', 'success');
        } else {
            showToast('Error al guardar', 'error');
        }
    } catch (error) {
        showToast('Error al guardar configuración', 'error');
    }
}

async function saveMessages() {
    const messages = {};
    document.querySelectorAll('#messagesEditor textarea').forEach(textarea => {
        messages[textarea.dataset.key] = textarea.value;
    });

    try {
        const response = await apiRequest('save_messages', { messages });
        if (response.success) {
            showToast('Mensajes guardados', 'success');
        } else {
            showToast('Error al guardar', 'error');
        }
    } catch (error) {
        showToast('Error al guardar mensajes', 'error');
    }
}

async function exportData() {
    try {
        const response = await apiRequest('export_data');
        if (response.success) {
            const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `furrguard_export_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Datos exportados', 'success');
        }
    } catch (error) {
        showToast('Error al exportar', 'error');
    }
}

async function performGlobalSearch(query) {
    if (!query.trim()) return;

    switchSection('players');
    document.getElementById('playersSearch').value = query;
    await loadPlayersData(1, 'all', query);
}

function refreshData() {
    const btn = document.getElementById('refreshBtn');
    btn.classList.add('refreshing');

    loadSectionData(currentSection).finally(() => {
        setTimeout(() => btn.classList.remove('refreshing'), 600);
    });

    loadBadgeCounts();
}

function logout() {
    localStorage.removeItem('furrguard_session');
    currentUser = null;
    window.location.href = '../index.php';
}

async function apiRequest(action, data = {}) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action, ...data })
    });

    if (response.status === 401) {
        // Sesión expirada o inválida - hacer logout automático
        localStorage.removeItem('furrguard_session');
        window.location.href = 'index.php?error=session_expired';
        throw new Error('Session expired');
    }

    if (response.status === 403) {
        showToast('Sin permisos para esta acción', 'error');
        throw new Error('Forbidden');
    }

    if (!response.ok) {
        throw new Error('Network error');
    }

    return await response.json();
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}

/**
 * Escapa caracteres HTML para prevenir XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Muestra una notificación tipo pop-up con estilo glassmorphism
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo de notificación: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duración en ms (default: 3500)
 */
function showToast(message, type = 'success', duration = 3500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    // Iconos según tipo
    const icons = {
        success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
        error: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
        warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
        info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
    };

    // Crear elemento toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            ${icons[type] || icons.info}
        </svg>
        <span class="toast-message">${escapeHtml(message)}</span>
        <button class="toast-close" aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
        </button>
        <div class="shimmer"></div>
    `;

    // Añadir al contenedor
    container.appendChild(toast);

    // Forzar reflow para animación
    toast.offsetHeight;
    toast.classList.add('show');

    // Botón de cerrar
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => removeToast(toast));

    // Auto remover después de la duración
    const timeout = setTimeout(() => removeToast(toast), duration);

    // Pausar animación al hover
    toast.addEventListener('mouseenter', () => {
        clearTimeout(timeout);
        toast.style.animationPlayState = 'paused';
        const progressBar = toast.querySelector('.toast::after');
        if (progressBar) progressBar.style.animationPlayState = 'paused';
    });

    toast.addEventListener('mouseleave', () => {
        setTimeout(() => removeToast(toast), 500);
    });
}

/**
 * Remueve un toast con animación
 */
function removeToast(toast) {
    if (!toast || !toast.parentElement) return;

    toast.classList.add('hiding');
    toast.addEventListener('transitionend', () => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, { once: true });
}

/**
 * Cierra todas las notificaciones activas
 */
function closeAllToasts() {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toasts = container.querySelectorAll('.toast');
    toasts.forEach((toast, index) => {
        setTimeout(() => removeToast(toast), index * 50);
    });
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatTimeAgo(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'Ahora';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
}

// === Admin Users Management ===
async function loadUsersData() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5"><div class="loading-spinner"></div></td></tr>';

    try {
        const response = await apiRequest('get_admin_users');
        if (response.success) {
            renderUsersTable(response.data.users || []);
        } else {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center">${response.error || 'Error al cargar usuarios'}</td></tr>`;
        }
    } catch (error) {
        console.error('Error loading users:', error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Error al cargar usuarios</td></tr>';
    }
}

function renderUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!users.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay usuarios</td></tr>';
        return;
    }

    const roleColors = { founder: '#f59e0b', owner: '#ef4444', manager: '#8b5cf6', sradmin: '#3b82f6', admin: '#6b7280' };
    const roleLabels = { founder: 'Founder', owner: 'Owner', manager: 'Manager', sradmin: 'SrAdmin', admin: 'Admin' };

    tbody.innerHTML = users.map(u => `
        <tr>
            <td><code>${u.discord_id}</code></td>
            <td><span class="role-badge" style="background:${roleColors[u.role] || '#6b7280'}20;color:${roleColors[u.role] || '#6b7280'};border:1px solid ${roleColors[u.role] || '#6b7280'}40">${roleLabels[u.role] || u.role}</span></td>
            <td>${u.created_by || 'Sistema'}</td>
            <td>${u.created_at ? new Date(u.created_at).toLocaleDateString('es-ES') : '-'}</td>
            <td>${u.role !== 'founder' ? `<button class="btn-sm btn-danger" onclick="removeAdminUser(${u.id})">Eliminar</button>` : '<span style="color:var(--text-tertiary)">-</span>'}</td>
        </tr>
    `).join('');
}

async function addAdminUser() {
    const discordId = document.getElementById('adminUserDiscordId').value.trim();
    const role = document.getElementById('adminUserRole').value;

    if (!discordId) {
        showToast('Introduce un Discord ID', 'error');
        return;
    }

    try {
        const response = await apiRequest('add_admin_user', { discord_id: discordId, role });
        if (response.success) {
            showToast('Usuario añadido correctamente');
            closeModal('adminUserModal');
            document.getElementById('adminUserDiscordId').value = '';
            loadUsersData();
        } else {
            showToast(response.error || 'Error al añadir usuario', 'error');
        }
    } catch (error) {
        showToast('Error de conexión', 'error');
    }
}

async function removeAdminUser(id) {
    if (!await showConfirm('¿Estás seguro de eliminar este usuario?')) return;

    try {
        const response = await apiRequest('remove_admin_user', { id });
        if (response.success) {
            showToast('Usuario eliminado');
            loadUsersData();
        } else {
            showToast(response.error || 'Error al eliminar', 'error');
        }
    } catch (error) {
        showToast('Error de conexión', 'error');
    }
}

function getBlockReasonLabel(reason) {
    const labels = {
        'proxy_detected': 'Proxy',
        'vpn_detected': 'VPN',
        'hosting_detected': 'Hosting',
        'blacklisted': 'Blacklist',
        'blocked_provider': 'ISP Bloqueado'
    };
    return labels[reason] || reason || 'Bloqueado';
}

function getMessageDescription(key) {
    const descriptions = {
        'prefix': 'Prefijo que aparece antes de todos los mensajes',
        'kick_proxy': 'Mensaje al detectar conexión desde proxy',
        'kick_vpn': 'Mensaje al detectar conexión desde VPN',
        'kick_hosting': 'Mensaje al detectar conexión desde hosting/datacenter',
        'kick_blacklisted': 'Mensaje cuando el jugador está en blacklist',
        'kick_blocked_provider': 'Mensaje cuando el ISP está bloqueado',
        'whitelist_added': 'Confirmación al añadir a whitelist',
        'whitelist_removed': 'Confirmación al quitar de whitelist',
        'blacklist_added': 'Confirmación al añadir a blacklist',
        'blacklist_removed': 'Confirmación al quitar de blacklist',
        'player_allowed': 'Log cuando un jugador es permitido',
        'player_blocked': 'Log cuando un jugador es bloqueado',
        'no_permission': 'Sin permisos para comando',
        'reload_success': 'Recarga exitosa',
        'command_usage': 'Uso incorrecto de comando',
        'player_not_found': 'Jugador no encontrado',
        'invalid_type': 'Tipo inválido en comando'
    };
    return descriptions[key] || '';
}

function getLogIconClass(type) {
    const classes = {
        'whitelist': 'green',
        'blacklist': 'red',
        'connection': 'blue',
        'settings': 'orange'
    };
    return classes[type] || 'blue';
