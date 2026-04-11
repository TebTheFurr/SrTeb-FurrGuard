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
| Fonts | Inter, Space Grotesk, JetBrains Mono | Google Fonts |

---

## 3. Project Structure

```
admin/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html                      # Vite entry point
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
│   │   │   ├── WhitelistModal.vue  # Add/edit whitelist entry
│   │   │   ├── BlacklistModal.vue  # Add/edit blacklist entry
│   │   │   ├── ProviderModal.vue   # Add provider
│   │   │   ├── CountryModal.vue    # Add/edit country block
│   │   │   ├── ContinentModal.vue  # Add/edit continent block
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
│   │   └── usePermissions.ts       # Role-based permission checks
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
- After login (callback.php redirect), Vue reads user data from `localStorage('furrguard_session')` and populates `authStore`.
- Role-based: Sidebar nav items filtered by `ROLE_PERMISSIONS`. Routes accessible but content hidden based on role.

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
| `overviewStore` | stats, recentConnections, recentBlocks | fetchOverview() |
| `playersStore` | players, pagination, filters, currentPlayer | fetchPlayers(), fetchPlayer(uuid), lookupPlayer() |
| `connectionsStore` | connections, pagination, filters | fetchConnections(), fetchConnection(id) |
| `ipsStore` | ips, pagination, currentIp | fetchIPs(), fetchIP(id) |
| `whitelistStore` | entries, filters | fetch(), add(), edit(), remove() |
| `blacklistStore` | entries, filters, sanctions | fetch(), add(), edit(), remove(), toggle() |
| `providersStore` | providers | fetch(), add(), toggle() |
| `countriesStore` | countries | fetch(), add(), edit(), toggle(), remove() |
| `continentsStore` | continents | fetch(), add(), edit(), toggle(), remove() |
| `furrpermsStore` | whitelist, logs | fetchWhitelist(), addToWhitelist(), removeFromWhitelist(), fetchLogs(), clearLogs() |
| `furrsecurityStore` | staff, sessions, logs, stats | fetchStaff(), addStaff(), removeStaff(), fetchSessions(), fetchLogs(), revokeSession(), fetchStats() |
| `messagesStore` | messages | fetch(), save() |
| `logsStore` | logs, filters, pagination | fetch() |
| `settingsStore` | settings | fetch(), save(), regenerateApiKey() |
| `usersStore` | users | fetch(), add(), remove() |
| `uiStore` | toasts[], activeModal, sidebarCollapsed, globalLoading | showToast(), hideToast(), openModal(), closeModal() |

---

## 6. Authentication Flow

### Unchanged Server-Side

PHP handles all Discord OAuth2 logic:
1. Login button links to Discord authorize URL (built by PHP)
2. Discord redirects to `callback.php`
3. `callback.php` exchanges code, validates state, creates session
4. Sets `$_SESSION` and redirects to `index.php`

### Vue Integration

**Current flow (PHP injects):**
```php
<script nonce>
  localStorage.setItem('furrguard_session', JSON.stringify($user));
  window.ROLE_PERMISSIONS = <?php echo json_encode(ROLE_PERMISSIONS); ?>;
</script>
```

**New flow:**
- `callback.php` sets `localStorage` then redirects to the Vue app
- Vue `authStore` reads `localStorage('furrguard_session')` on mount
- API requests include session cookie (PHP session) — no additional auth headers needed for admin API
- `ROLE_PERMISSIONS` stored in `localStorage('furrguard_role_permissions')` by `callback.php`

### Session Validation

- PHP session cookie (`PHPSESSID`) continues to authenticate API calls
- `api.php` validates session server-side on every request (unchanged)
- Vue detects 401 responses via Axios interceptor → clears auth state → redirects to login

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
- Player header: avatar, name, UUID, status
- 5-tab interface: Connections, IPs, Whitelist, Blacklist, Actions
- skinview3d integration for 3D Minecraft skin viewer
- Blacklist/whitelist quick-add buttons

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
      '/admin/api.php': '../admin/api.php',
      '/admin/callback.php': '../admin/callback.php',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
```

---

## 13. Migration Strategy

### What Changes
- `admin/index.php` → `admin/index.html` (Vite entry, empty `<div id="app">`)
- `admin/player.php` → Merged into `PlayerDetailView.vue`
- `admin/assets/js/admin.js` → Deleted (logic distributed across Vue components/stores)
- `admin/assets/css/*.css` → Deleted (replaced by Tailwind theme)
- `admin/assets/js/admin.js.backup|tmp|new` → Deleted

### What Stays Unchanged
- `admin/api.php` — All 45+ API actions untouched
- `admin/callback.php` — Discord OAuth callback untouched (with minor addition: set localStorage)
- `config.php`, `config/database.php`, `includes/` — Untouched
- `api/plugin.php` — Plugin-facing API untouched
- `install.sql` — Untouched
- `modulos/` — Java module untouched
- `FurrGuard-plugin/` — Velocity plugin untouched

### Callback.php Minor Change

`callback.php` needs a small addition before redirecting: write user session and role permissions to `localStorage` so Vue can read them. This can be done by redirecting to an intermediate PHP page that injects the data and then redirects to the Vue app.

Alternatively: `callback.php` sets `$_SESSION` (already does) and redirects to `index.html`. Vue checks for PHP session cookie and makes an initial API call to validate the session.

**Chosen approach:** Keep callback.php unchanged. Instead, create a small `admin/auth.php` endpoint that returns the current user session data. Vue calls this on mount. If the PHP session is valid, it returns user data; if not, Vue shows login.

---

## 14. Success Criteria

1. All 16 sections functional with identical behavior to current SPA
2. All 17 modals functional
3. All ~45 API endpoints working with zero PHP changes
4. Visual design identical (dark purple glassmorphism theme)
5. GSAP animations matching current CSS animations
6. Discord OAuth login/logout flow working
7. Role-based access control enforced
8. Player detail page (player.php) merged into Vue route
9. Responsive design maintained (mobile, tablet, desktop)
10. TypeScript throughout with proper typing
