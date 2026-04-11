# FurrGuard Vue 3 Frontend Migration Design

**Date:** 2026-04-11
**Status:** Draft
**Scope:** Admin panel frontend only — PHP backend unchanged

---

## 1. Overview

Migrate the FurrGuard admin panel from a vanilla JS SPA (1 HTML file, 1 JS file, 4 CSS files) to a modern Vue 3.5 application while preserving the existing dark purple/magenta glassmorphism design and all PHP backend endpoints.

### Current State
- `admin/index.php` — 2,264-line SPA with 16 sections, login screen, 17 modals
- `admin/player.php` — ~2,500-line standalone player detail page
- `admin/assets/js/admin.js` — 4,096 lines vanilla JS (innerHTML templating)
- `admin/assets/css/` — 4 CSS files totaling ~7,300 lines (hand-written)
- Authentication: Discord OAuth2 via PHP sessions
- API: POST-based `action` parameter to `api.php` (~45 actions)

### Target State
- Vue 3.5 + Vite 8 + TypeScript SPA in `admin/`
- Vue Router 4 (hash mode), Pinia 3 state management
- Tailwind CSS v4.2 full rewrite of styles
- GSAP animations, Axios HTTP client, Lucide Vue Next icons
- PHP backend completely unchanged

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Vue | 3.5.x |
| Build tool | Vite | 8.x |
| Language | TypeScript | 5.x |
| Router | Vue Router | 4.x |
| State | Pinia | 3.x |
| CSS | Tailwind CSS | v4.2 (Vite plugin) |
| Animations | GSAP | 3.x |
| HTTP | Axios | 1.x |
| Icons | Lucide Vue Next | latest |
| 3D Viewer | skinview3d | 3.x (npm) |
| Fonts | Inter, Space Grotesk, JetBrains Mono | Google Fonts |

---

## 3. Project Structure

```
admin/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.php                       # Vite entry point (PHP for session injection)
├── src/
│   ├── main.ts                     # App bootstrap, plugins
│   ├── App.vue                     # Root (router-view + toast container)
│   ├── style.css                   # Tailwind @import + @theme tokens
│   │
│   ├── router/
│   │   └── index.ts                # Routes + navigation guards
│   │
│   ├── stores/
│   │   ├── auth.ts                 # User session, role, permissions
│   │   ├── overview.ts             # Dashboard stats
│   │   ├── players.ts              # Player list + detail
│   │   ├── connections.ts          # Connection history
│   │   ├── ips.ts                  # IP address management
│   │   ├── whitelist.ts            # Whitelist CRUD
│   │   ├── blacklist.ts            # Blacklist CRUD + sanctions
│   │   ├── providers.ts            # VPN provider blocklist
│   │   ├── countries.ts            # Country geoblocking
│   │   ├── continents.ts           # Continent geoblocking
│   │   ├── furrperms.ts            # FurrPerms whitelist + logs
│   │   ├── furrsecurity.ts         # FurrSecurity staff + sessions
│   │   ├── messages.ts             # Plugin messages
│   │   ├── logs.ts                 # Activity logs
│   │   ├── settings.ts             # System settings
│   │   ├── users.ts                # Admin user management
│   │   └── ui.ts                   # Toast, modals, sidebar, loading
│   │
│   ├── views/
│   │   ├── LoginView.vue           # Discord OAuth login
│   │   ├── DashboardView.vue       # Overview stats + recent activity
│   │   ├── PlayersView.vue         # Player table
│   │   ├── PlayerDetailView.vue    # Full player detail (replaces player.php)
│   │   ├── ConnectionsView.vue     # Connection history
│   │   ├── IPsView.vue             # IP address table
│   │   ├── WhitelistView.vue       # Whitelist management
│   │   ├── BlacklistView.vue       # Blacklist management
│   │   ├── SanctionsView.vue       # Sanctions history
│   │   ├── ProvidersView.vue       # VPN provider blocklist
│   │   ├── CountriesView.vue       # Country geoblocking
│   │   ├── ContinentsView.vue      # Continent geoblocking
│   │   ├── FurrPermsView.vue       # FurrPerms module
│   │   ├── FurrSecurityView.vue    # FurrSecurity module
│   │   ├── MessagesView.vue        # Plugin message editor
│   │   ├── LogsView.vue            # Activity logs
│   │   ├── SettingsView.vue        # System settings
│   │   └── UsersView.vue           # Admin user management
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppSidebar.vue      # Collapsible nav with categories
│   │   │   ├── AppHeader.vue       # Search bar, refresh, user menu
│   │   │   └── AppFooter.vue       # Footer
│   │   │
│   │   ├── modals/
│   │   │   ├── BaseModal.vue       # GSAP-animated modal base
│   │   │   ├── ConfirmModal.vue    # Yes/No confirmation
│   │   │   ├── PromptModal.vue     # Text input prompt
│   │   │   ├── AlertModal.vue      # Info alert
│   │   │   ├── WhitelistModal.vue  # Add OR edit whitelist entry (mode prop)
│   │   │   ├── BlacklistModal.vue  # Add OR edit blacklist entry (mode prop, unified/IP variants)
│   │   │   ├── ProviderModal.vue   # Add provider
│   │   │   ├── CountryModal.vue    # Add OR edit country block (mode prop)
│   │   │   ├── ContinentModal.vue  # Add OR edit continent block (mode prop)
│   │   │   ├── PlayerModal.vue     # Player detail quick view
│   │   │   ├── IPModal.vue         # IP detail quick view
│   │   │   ├── ConnectionModal.vue # Connection detail
│   │   │   ├── AdminUserModal.vue  # Add admin user
│   │   │   ├── FurrPermsModal.vue  # Add FurrPerms whitelist entry
│   │   │   └── FurrSecurityModal.vue # Add FurrSecurity staff
│   │   │
│   │   └── shared/
│   │       ├── DataTable.vue       # Generic data table
│   │       ├── PaginationBar.vue   # Page navigation
│   │       ├── StatusBadge.vue     # Status indicator
│   │       ├── PlayerCell.vue      # Avatar + name + UUID
│   │       ├── IPCell.vue          # IP + flag + ISP
│   │       ├── ToastNotification.vue # GSAP toast
│   │       ├── SearchInput.vue     # Debounced search
│   │       ├── FilterTabs.vue      # Tab-based filter
│   │       ├── ToggleSwitch.vue    # Settings toggle
│   │       ├── StatCard.vue        # Dashboard stat with counter
│   │       ├── EmptyState.vue      # Empty placeholder
│   │       ├── LoadingSkeleton.vue # Shimmer skeleton
│   │       ├── CountryFlag.vue     # Flag image from flagcdn
│   │       └── PlayerAvatar.vue    # Minecraft head avatar
│   │
│   ├── composables/
│   │   ├── useApi.ts               # API request wrapper
│   │   ├── useToast.ts             # Toast notification helper
│   │   ├── usePagination.ts        # Pagination state helper
│   │   ├── useAnimations.ts        # GSAP animation helpers
│   │   └── usePermissions.ts       # Role checks: can(section), minRole(role), isFounder()
│   │
│   ├── lib/
│   │   ├── api.ts                  # Axios instance + interceptors
│   │   └── constants.ts            # ROLE_PERMISSIONS, filter options, routes config
│   │
│   └── types/
│       └── index.ts                # TypeScript interfaces for all entities
│
├── api.php                          # UNCHANGED — PHP backend API
├── callback.php                     # UNCHANGED — Discord OAuth callback
├── install.sql                      # UNCHANGED
└── dist/                            # Vite build output
```

---

## 4. Routing

Vue Router in **hash mode** (required because PHP serves the app from `/admin/`).

### Routes

| Path | View | Auth | Description |
|------|------|------|-------------|
| `/login` | LoginView | No | Discord OAuth login screen |
| `/` | DashboardView | Yes | Overview stats |
| `/players` | PlayersView | Yes | Player list |
| `/players/:uuid` | PlayerDetailView | Yes | Player detail (replaces player.php) |
| `/connections` | ConnectionsView | Yes | Connection history |
| `/ips` | IPsView | Yes | IP addresses |
| `/whitelist` | WhitelistView | Yes | Whitelist management |
| `/blacklist` | BlacklistView | Yes | Blacklist management |
| `/sanctions` | SanctionsView | Yes | Sanctions registry |
| `/providers` | ProvidersView | Yes | VPN providers |
| `/countries` | CountriesView | Yes | Country blocks |
| `/continents` | ContinentsView | Yes | Continent blocks |
| `/furrperms` | FurrPermsView | Yes | FurrPerms module |
| `/furrsecurity` | FurrSecurityView | Yes | FurrSecurity module |
| `/messages` | MessagesView | Yes | Message editor |
| `/logs` | LogsView | Yes | Activity logs |
| `/settings` | SettingsView | Yes | System settings |
| `/users` | UsersView | Yes | Admin users |

### Navigation Guards

- `beforeEach`: Check `authStore.isAuthenticated`. Redirect to `/login` if not.
- `index.php` (PHP entry point) injects user session and role permissions into a `<script>` tag on every page load, identical to the current pattern. Vue reads `window.__FURRGUARD_USER__` and `window.__ROLE_PERMISSIONS__` on boot.
- Role-based: Sidebar nav items filtered by `ROLE_PERMISSIONS`. Routes accessible but content hidden based on role.
- The `modules` permission in `ROLE_PERMISSIONS` is an umbrella that grants access to both `/furrperms` and `/furrsecurity`. Individual `furrperms`/`furrsecurity` permissions also exist for granular control. The sidebar shows "Modulos" category when either individual or umbrella permission is present.

### Lazy Loading

All view components loaded via `() => import('./views/...')` for code splitting.

---

## 5. State Management (Pinia)

### Store Design Principles

- One store per domain entity
- Each store manages its own loading/error states
- API calls centralized in `src/lib/api.ts`, called from stores
- Stores expose actions matching the current API action names for 1:1 mapping

### Stores

| Store | State | Actions |
|-------|-------|---------|
| `authStore` | user, role, permissions, isAuthenticated | login(), logout(), checkAuth() |
| `overviewStore` | stats, recentConnections, recentBlocks, badgeCounts | fetchOverview(), fetchCounts() |
| `playersStore` | players, pagination, filters, currentPlayer, lookedUpPlayer, nameHistory | fetchPlayers(), fetchPlayer(uuid), lookupPlayer(), getNameHistory(uuid) |
| `connectionsStore` | connections, pagination, filters | fetchConnections(), fetchConnection(id) |
| `ipsStore` | ips, pagination, currentIp | fetchIPs(), fetchIP(id) |
| `whitelistStore` | entries, filters | fetch(), add(), edit(), remove(), removeByValue() |
| `blacklistStore` | entries, filters, sanctions | fetch(), add(), addUnified(), addIP(), edit(), remove(), removeByValue(), toggle() |
| `providersStore` | providers | fetch(), add(), toggle() |
| `countriesStore` | countries | fetch(), add(), edit(), toggle(), remove() |
| `continentsStore` | continents | fetch(), add(), edit(), toggle(), remove() |
| `furrpermsStore` | whitelist, logs, stats (allowed/blocked counts) | fetchWhitelist(), addToWhitelist(), removeFromWhitelist(), fetchLogs(), clearLogs(), fetchStats() |
| `furrsecurityStore` | staff, staffSearch, sessions, sessionsSearch, logs, logsSearch, stats | fetchStaff(), addStaff(), removeStaff(), fetchSessions(), fetchLogs(), revokeSession(), fetchStats() |
| `messagesStore` | messages | fetch(), save() |
| `logsStore` | logs, filters, pagination | fetch() |
| `settingsStore` | settings | fetch(), save(), regenerateApiKey(), exportData(), migrateBlacklist(), migratePlayers() |
| `usersStore` | users | fetch(), add(), remove() |
| `uiStore` | toasts[], activeModal, sidebarCollapsed, globalLoading | showToast(), hideToast(), openModal(), closeModal() |

---

## 6. Authentication Flow

### Server-Side (Unchanged)

PHP handles all Discord OAuth2 logic:
1. Login button links to Discord authorize URL (built by PHP)
2. Discord redirects to `callback.php`
3. `callback.php` exchanges code, validates state, creates session
4. Sets `$_SESSION` and redirects to `index.php`

### Vue Integration — PHP-Injected Entry Point

The entry point remains `index.php` (not `index.html`). This preserves the current PHP session injection pattern without creating new PHP files.

**`admin/index.php`** (replaces current SPA HTML):
```php
<?php
require_once '../config.php';
require_once '../includes/security.php';

startSecureSession();
$user = null;
$rolePermissions = [];
$isAuthenticated = false;

if (isset($_SESSION['furrguard_admin'])) {
    $isAuthenticated = true;
    $user = $_SESSION['furrguard_admin'];
    $rolePermissions = defined('ROLE_PERMISSIONS') ? ROLE_PERMISSIONS : [];
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FurrGuard Admin</title>
</head>
<body>
    <div id="app"></div>
    <script type="module" src="/admin/src/main.ts"></script>
    <?php if ($isAuthenticated): ?>
    <script nonce="<?php echo $nonce ?? ''; ?>">
        window.__FURRGUARD_USER__ = <?php echo json_encode($user); ?>;
        window.__ROLE_PERMISSIONS__ = <?php echo json_encode($rolePermissions); ?>;
    </script>
    <?php endif; ?>
</body>
</html>
```

**How it works:**
- PHP validates the session on every page load (same as current)
- If authenticated, injects `window.__FURRGUARD_USER__` and `window.__ROLE_PERMISSIONS__`
- Vue `authStore` reads these globals on boot — zero API calls needed for initial auth
- API requests include PHP session cookie via `withCredentials: true` — no additional auth headers
- No new PHP files needed. `callback.php` is completely unchanged.

### Session Validation

- PHP session cookie (`PHPSESSID`) continues to authenticate API calls
- `api.php` validates session server-side on every request (unchanged)
- Vue detects 401 responses via Axios interceptor → clears auth state → redirects to login
- Initial load shows a loading splash while `index.php` renders; no flash of login screen

---

## 7. API Layer

### Axios Instance (`src/lib/api.ts`)

```typescript
// POST-based action API matching current pattern
const api = axios.create({
  baseURL: '/admin/api.php',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) authStore.logout()
    return Promise.reject(error)
  }
)

export async function apiRequest(action: string, params: Record<string, any> = {}): Promise<any> {
  const { data } = await api.post('', { action, ...params })
  return data
}
```

This 1:1 maps to the current `apiRequest()` function in `admin.js`, ensuring zero changes to `api.php`.

---

## 8. Tailwind CSS v4.2 Theme

### Custom Theme (`src/style.css`)

Tailwind v4.2 uses `@theme` directive for design tokens. The full glassmorphism purple/magenta theme is replicated:

```css
@import "tailwindcss";

@theme {
  /* Colors — dark purple/magenta palette */
  --color-dark-900: #0a0a0f;
  --color-dark-800: #0f0f17;
  --color-dark-700: #12121a;
  --color-dark-600: #1a1a24;
  --color-dark-500: #222230;
  --color-dark-400: #2a2a3a;
  --color-dark-300: #3a3a4a;

  --color-purple-500: #8b5cf6;
  --color-purple-400: #a78bfa;
  --color-purple-600: #7c3aed;

  --color-magenta-500: #c026d3;
  --color-pink-500: #db2777;

  /* Glass effects */
  --color-glass: rgba(255, 255, 255, 0.05);
  --color-glass-border: rgba(255, 255, 255, 0.1);

  /* Typography */
  --font-display: 'Space Grotesk', sans-serif;
  --font-body: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Border radius */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;

  /* Animations */
  --animate-shimmer: shimmer 2s linear infinite;
  --animate-float: float 6s ease-in-out infinite;
  --animate-glow: glow 3s ease-in-out infinite;
}
```

### Glassmorphism Utilities

Custom Tailwind utilities for the glass effect pattern:
- `.glass-card` — `bg-glass backdrop-blur-xl border border-glass-border rounded-lg`
- `.glass-sidebar` — Darker glass variant for sidebar
- `.glass-modal` — Elevated glass with shadow for modals

### Background Effects

Animated gradient background shapes kept as CSS `@keyframes` (GPU-accelerated with `will-change: transform`).

---

## 9. Animations (GSAP)

### Route Transitions

```vue
<RouterView v-slot="{ Component }">
  <Transition
    @before-enter="onBeforeEnter"
    @enter="onEnter"
    @leave="onLeave"
  >
    <component :is="Component" />
  </Transition>
</RouterView>
```

GSAP `fadeIn` + slight `translateY` on route change.

### Component Animations

| Animation | GSAP Method | Used In |
|-----------|-------------|---------|
| Stagger reveal | `gsap.from(children, { stagger })` | Table rows, stat cards |
| Counter | `gsap.to(counter, { val, onUpdate })` | Dashboard stat numbers |
| Modal enter | `gsap.fromTo(el, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1 })` | All modals |
| Modal leave | `gsap.to(el, { scale: 0.95, opacity: 0 })` | All modals |
| Toast slide | `gsap.from(el, { x: 100, opacity: 0 })` | Toast notifications |
| Sidebar collapse | `gsap.to(sidebar, { width: collapsed ? '80px' : '280px' })` | Sidebar toggle |
| Card hover glow | `gsap.to(card, { boxShadow })` on mousemove | Stat cards |
| Skeleton shimmer | CSS `@keyframes shimmer` | LoadingSkeleton component |

### Scroll Animations

`IntersectionObserver` composable (`useAnimations.ts`) triggers GSAP reveals when elements enter viewport.

---

## 10. Component Details

### Layout Components

**AppSidebar.vue:**
- Collapsible categories (Gestion, Seguridad, Geolocalizacion, Modulos, Sistema)
- Badge counts for players, whitelist, blacklist (fetched via `uiStore`)
- Active route highlighting via `router.currentRoute`
- Role-based visibility using `usePermissions` composable
- GSAP collapse animation

**AppHeader.vue:**
- Global search with debounced `performGlobalSearch()`
- Refresh button (re-fetches current section data)
- User avatar + name + role badge
- Logout button

### Key View Components

**DashboardView.vue:**
- 4 stat cards with GSAP counter animation
- Recent connections table (last 10)
- Recent blocks table (last 10)
- Quick action buttons

**PlayersView.vue:**
- Filter tabs: All / Online / Whitelisted / Blacklisted
- Search input with debounce
- DataTable with PlayerCell, StatusBadge, IPCell
- PaginationBar
- Click row → navigate to `/players/:uuid`

**PlayerDetailView.vue (replaces player.php):**
- Back button to `/players`
- Two-column layout: sticky sidebar (skinview3d 3D skin viewer + player info) + main content
- Player header: avatar, name, UUID, account status (premium/offline detection via `isOfflineUUID()`)
- Stacked vertical sections (not tabs), matching current player.php UX:
  - Account Status card (online/offline, whitelisted/blacklisted badges)
  - General Info card (country, ISP, ASN, first/last seen)
  - Name History card (from `get_name_history` Mojang API, premium players only)
  - IP History card (all IPs associated with player)
  - Recent Connections card (last connections with detail modal)
- Inline whitelist/blacklist add modals (unified blacklist with Mojang lookup)
- skinview3d loaded as npm dependency, initialized via `ref` + `onMounted`

**SettingsView.vue:**
- Toggle switches for proxy/VPN/hosting blocking
- Country change detection toggle
- Notification settings
- API key display with regenerate button
- Migration tools (founder only)

### Shared Components

**DataTable.vue:**
- Props: `columns`, `rows`, `loading`, `empty-message`
- Emits: `row-click`, `sort`
- Renders LoadingSkeleton or EmptyState when appropriate
- Stagger animation on row appearance

**BaseModal.vue:**
- Props: `modelValue` (v-model), `title`, `size`
- Teleports to body
- GSAP enter/leave transitions
- Click overlay to close
- Escape key to close
- Slot: default (body content)

### Modal Dual-Mode Pattern

WhitelistModal, BlacklistModal, CountryModal, and ContinentModal each handle both **add** and **edit** modes via a `mode` prop (`'add' | 'edit'`) and an optional `entry` prop for pre-populating fields. This matches the current app which has separate add/edit modals per entity but consolidates them into single components.

**BlacklistModal** additionally supports a `variant` prop (`'player' | 'ip' | 'unified'`) to match the current tabbed add modal (player vs IP/AS/CIDR).

---

## 11. TypeScript Types

```typescript
interface User {
  discord_id: string
  username: string
  avatar: string
  role: 'founder' | 'owner' | 'manager' | 'sradmin' | 'admin'
}

interface Player {
  uuid: string
  nick: string
  last_ip: string
  country: string
  country_name: string
  isp: string
  asn: string
  is_online: boolean
  is_whitelisted: boolean
  is_blacklisted: boolean
  last_seen: string
  total_connections: number
}

interface Connection {
  id: number
  uuid: string
  nick: string
  ip: string
  country: string
  isp: string
  proxy: boolean
  vpn: boolean
  hosting: boolean
  blocked: boolean
  reason: string
  timestamp: string
}

interface WhitelistEntry {
  id: number
  type: 'uuid' | 'nick' | 'ip' | 'ip_range' | 'as'
  value: string
  reason: string
  added_by: string
  created_at: string
}

interface BlacklistEntry {
  id: number
  type: 'uuid' | 'nick' | 'ip' | 'asn' | 'cidr'
  value: string
  reason: string
  duration: string
  is_permanent: boolean
  is_active: boolean
  added_by: string
  created_at: string
  expires_at: string | null
}

interface Country {
  code: string
  name: string
  kick_message: string
  is_active: boolean
}

interface PaginationData {
  page: number
  per_page: number
  total: number
  total_pages: number
}

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  pagination?: PaginationData
}
```

---

## 12. Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  base: '/admin/',
  plugins: [
    vue(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/admin/api.php': 'http://localhost:80',
      '/admin/callback.php': 'http://localhost:80',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
```

> **Note:** In dev mode, Vite proxies PHP requests to a local PHP server (e.g., `php -S localhost:80`). In production, the web server (Nginx/Apache) routes `.php` requests to PHP-FPM and serves Vite's built assets for everything else.

---

## 13. Migration Strategy

### What Changes
- `admin/index.php` — Replaced with new PHP file that loads the Vue app (keeps `.php` extension for session injection, see Section 6)
- `admin/player.php` — Merged into `PlayerDetailView.vue` (file deleted)
- `admin/assets/js/admin.js` — Deleted (logic distributed across Vue components/stores)
- `admin/assets/css/*.css` — Deleted (replaced by Tailwind theme)
- `admin/assets/js/admin.js.backup|tmp|new` — Deleted

### What Stays Unchanged
- `admin/api.php` — All 45+ API actions untouched
- `admin/callback.php` — Discord OAuth callback completely untouched
- `config.php`, `config/database.php`, `includes/` — Untouched
- `api/plugin.php` — Plugin-facing API untouched
- `install.sql` — Untouched
- `modulos/` — Java module untouched
- `FurrGuard-plugin/` — Velocity plugin untouched

### New Files Added
- `admin/package.json`, `admin/vite.config.ts`, `admin/tsconfig.json`
- `admin/src/` — Entire Vue application source tree
- No new PHP files needed

---

## 14. Deployment

### Production Build

```bash
cd admin && npm run build
```

Outputs static assets to `admin/dist/`. The `index.php` remains at `admin/index.php` and loads from `dist/`.

### Nginx Configuration

```nginx
location /admin/ {
    # PHP files → PHP-FPM
    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }

    # Vue built assets
    location /admin/dist/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback: all other /admin/* routes serve index.php
    try_files $uri $uri/ /admin/index.php?$query_string;
}
```

### Apache (.htaccess)

```apache
# admin/.htaccess
RewriteEngine On

# PHP files pass through normally
RewriteRule ^(api|callback)\.php$ - [L]

# Built assets
RewriteRule ^dist/ - [L]

# Everything else → index.php (Vue SPA entry)
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^(.*)$ index.php [QSA,L]
```

---

## 15. Composables API

### `usePermissions.ts`

```typescript
// Returns reactive permission helpers based on authStore
export function usePermissions() {
  const auth = useAuthStore()
  return {
    can(section: string): boolean      // Check if user can access a section
    isFounder(): boolean               // Check if user is founder
    minRole(role: Role): boolean       // Check if user's role >= specified role
  }
}
```

---

## 16. Success Criteria

1. All 16 sections functional with identical behavior to current SPA
2. All 17 modals functional (including dual add/edit mode)
3. All ~45 API endpoints working with zero PHP changes
4. Visual design identical (dark purple glassmorphism theme)
5. GSAP animations matching current CSS animations
6. Discord OAuth login/logout flow working
7. Role-based access control enforced (including `modules` umbrella permission)
8. Player detail page (player.php) merged into Vue route with skinview3d
9. Responsive design maintained (mobile, tablet, desktop)
10. TypeScript throughout with proper typing
