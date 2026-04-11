# Vue 3 Frontend Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the FurrGuard admin panel from vanilla JS/PHP SPA to Vue 3.5 + Vite 8 + Tailwind CSS v4.2 + GSAP, keeping the PHP backend completely unchanged.

**Architecture:** Component-per-section approach with Vue Router 4 (hash mode) for navigation, Pinia 3 stores for state, Axios for API calls, and GSAP for animations. The entry point remains `index.php` to inject PHP session data into Vue via `window.__FURRGUARD_USER__`.

**Tech Stack:** Vue 3.5, Vite 8, TypeScript 5, Vue Router 4, Pinia 3, Tailwind CSS v4.2 (Vite plugin), GSAP 3, Axios 1, Lucide Vue Next, skinview3d 3

**Spec:** `docs/superpowers/specs/2026-04-11-vue3-frontend-migration-design.md`

---

## Phase 1: Project Scaffolding & Foundation

### Task 1: Initialize Vite + Vue 3 project

**Files:**
- Create: `admin/package.json`
- Create: `admin/vite.config.ts`
- Create: `admin/tsconfig.json`
- Create: `admin/tsconfig.app.json`
- Create: `admin/index.php` (new version, replaces old)

- [ ] **Step 1: Create package.json with all dependencies**

```json
{
  "name": "furrguard-admin",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "vue": "^3.5.0",
    "vue-router": "^4.5.0",
    "pinia": "^3.0.0",
    "axios": "^1.9.0",
    "gsap": "^3.12.0",
    "lucide-vue-next": "^0.475.0",
    "skinview3d": "^3.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.2.0",
    "@tailwindcss/vite": "^4.2.0",
    "tailwindcss": "^4.2.0",
    "typescript": "^5.7.0",
    "vue-tsc": "^2.2.0",
    "vite": "^6.0.0",  // Note: use latest stable; spec says Vite 8.x — adjust after npm view vite version
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 2: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  base: '/admin/',
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
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

- [ ] **Step 3: Create tsconfig.json and tsconfig.app.json**

```json
// tsconfig.json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }]
}
```

```json
// tsconfig.app.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "preserve",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "noEmit": true,
    "paths": { "@/*": ["./src/*"] },
    "baseUrl": "."
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue", "env.d.ts"]
}
```

- [ ] **Step 4: Create env.d.ts**

```typescript
// admin/env.d.ts
/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface Window {
  __FURRGUARD_USER__?: {
    discord_id: string
    username: string
    avatar: string | null
    role: 'founder' | 'owner' | 'manager' | 'sradmin' | 'admin'
    session_token: string
    expires_at: string
  }
  __ROLE_PERMISSIONS__?: Record<string, string[]>
}
```

- [ ] **Step 5: Create new admin/index.php**

```php
<?php
require_once __DIR__ . '/../config.php';

// Logout handler
if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: ../index.php');
    exit;
}

// DB check — use db() helper from config/database.php (loaded by config.php)
try {
    $db = db();
} catch (Exception $e) {
    echo '<!DOCTYPE html><html><body style="background:#0a0a0f;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:Inter,sans-serif"><div><h1>Error de Base de Datos</h1><p>No se puede conectar a la base de datos.</p></div></body></html>';
    exit;
}

// Auth validation — config.php already started session via configureSecureSession() + session_start()
$isAuthenticated = false;
$user = null;
$rolePermissions = [];

if (isset($_SESSION['furrguard_admin'])) {
    validateSessionIntegrity();
    $admin = $_SESSION['furrguard_admin'];
    if (!empty($admin['discord_id']) && !empty($admin['expires_at'])) {
        if (strtotime($admin['expires_at']) > time()) {
            $isAuthenticated = true;
            $user = $admin;
            $rolePermissions = defined('ROLE_PERMISSIONS') ? ROLE_PERMISSIONS : [];
        }
    }
}

$nonce = base64_encode(random_bytes(16));
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FurrGuard Admin</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
</head>
<body class="bg-dark-900 text-white font-body antialiased">
    <div id="app"></div>
    <script type="module" src="/admin/src/main.ts"></script>
    <?php if ($isAuthenticated && $user): ?>
    <script nonce="<?php echo $nonce; ?>">
        window.__FURRGUARD_USER__ = <?php echo json_encode($user); ?>;
        window.__ROLE_PERMISSIONS__ = <?php echo json_encode($rolePermissions); ?>;
    </script>
    <?php endif; ?>
</body>
</html>
```

- [ ] **Step 6: Install dependencies**

Run: `cd admin && npm install`

- [ ] **Step 7: Verify Vite dev server starts**

Run: `cd admin && npx vite --host`
Expected: Server starts without errors

- [ ] **Step 8: Commit**

```bash
git add admin/package.json admin/vite.config.ts admin/tsconfig.json admin/tsconfig.app.json admin/env.d.ts admin/index.php
git commit -m "feat: initialize Vue 3 + Vite 8 project scaffolding"
```

---

### Task 2: TypeScript types and constants

**Files:**
- Create: `admin/src/types/index.ts`
- Create: `admin/src/lib/constants.ts`

- [ ] **Step 1: Create TypeScript interfaces**

Read `admin/api.php` to verify exact field names returned by each API action, then create `admin/src/types/index.ts` with all interfaces from the spec Section 11 plus any additional fields discovered.

Key interfaces: `User`, `Player`, `Connection`, `WhitelistEntry`, `BlacklistEntry`, `Country`, `Continent`, `Provider`, `LogEntry`, `PlayerMessage`, `PaginationData`, `ApiResponse<T>`, `AdminUser`, `FurrPermsEntry`, `FurrSecurityStaff`, `FurrSecuritySession`, `BadgeCounts`, `DashboardStats`.

- [ ] **Step 2: Create constants file**

```typescript
// admin/src/lib/constants.ts
export const ROLE_HIERARCHY = ['admin', 'sradmin', 'manager', 'owner', 'founder'] as const
export type Role = (typeof ROLE_HIERARCHY)[number]

export const SIDEBAR_SECTIONS = [
  { id: 'overview', label: 'Dashboard', icon: 'LayoutDashboard' },
  {
    category: 'Gestion',
    items: [
      { id: 'players', label: 'Jugadores', icon: 'Users' },
      { id: 'connections', label: 'Conexiones', icon: 'Link' },
      { id: 'ips', label: 'Direcciones IP', icon: 'Globe' },
    ],
  },
  {
    category: 'Seguridad',
    items: [
      { id: 'whitelist', label: 'Whitelist', icon: 'ShieldCheck' },
      { id: 'blacklist', label: 'Blacklist', icon: 'ShieldOff' },
      { id: 'sanctions', label: 'Sanciones', icon: 'Gavel' },
      { id: 'providers', label: 'Proveedores VPN', icon: 'ShieldAlert' },
    ],
  },
  // ... etc
] as const
```

- [ ] **Step 3: Commit**

```bash
git add admin/src/types/ admin/src/lib/constants.ts
git commit -m "feat: add TypeScript types and constants"
```

---

### Task 3: API layer (Axios)

**Files:**
- Create: `admin/src/lib/api.ts`
- Create: `admin/src/composables/useApi.ts`

- [ ] **Step 1: Create Axios instance**

```typescript
// admin/src/lib/api.ts
import axios from 'axios'

const api = axios.create({
  baseURL: '/admin/api.php',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/admin/index.php?logout=1'
    }
    return Promise.reject(error)
  }
)

export async function apiRequest<T = any>(
  action: string,
  params: Record<string, any> = {}
): Promise<T> {
  const { data } = await api.post('', { action, ...params })
  return data
}

export default api
```

- [ ] **Step 2: Create useApi composable**

```typescript
// admin/src/composables/useApi.ts
export { apiRequest } from '@/lib/api'
```

(Wraps apiRequest for future extension — loading state, error handling, etc.)

- [ ] **Step 3: Commit**

```bash
git add admin/src/lib/api.ts admin/src/composables/useApi.ts
git commit -m "feat: add Axios API layer with session-aware interceptor"
```

---

### Task 4: Tailwind CSS v4.2 theme

**Files:**
- Create: `admin/src/style.css`

- [ ] **Step 1: Create Tailwind theme replicating current design**

Read `admin/assets/css/admin.css` to extract ALL CSS custom properties (colors, fonts, radii, shadows, transitions), then create `admin/src/style.css` with the full `@import "tailwindcss"` + `@theme` block + `@keyframes` + custom utilities.

Must include:
- All dark background colors (#0a0a0f through #3a3a4a)
- Purple/magenta/pink accent colors
- Glass effect colors (rgba)
- Font families (Inter, Space Grotesk, JetBrains Mono)
- Border radius scale
- Shimmer, float, glow animations
- Glassmorphism utility classes (`.glass-card`, `.glass-sidebar`, `.glass-modal`)
- Gradient background shapes CSS
- Responsive breakpoints

- [ ] **Step 2: Commit**

```bash
git add admin/src/style.css
git commit -m "feat: add Tailwind CSS v4.2 theme with glassmorphism design tokens"
```

---

### Task 5: Auth store and router

**Files:**
- Create: `admin/src/stores/auth.ts`
- Create: `admin/src/router/index.ts`
- Create: `admin/src/composables/usePermissions.ts`

- [ ] **Step 1: Create auth store**

```typescript
// admin/src/stores/auth.ts
import { defineStore } from 'pinia'
import type { User } from '@/types'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    permissions: {} as Record<string, string[]>,
    isAuthenticated: false,
  }),
  actions: {
    initialize() {
      if (window.__FURRGUARD_USER__) {
        this.user = window.__FURRGUARD_USER__
        this.permissions = window.__ROLE_PERMISSIONS__ || {}
        this.isAuthenticated = true
      }
    },
    logout() {
      this.user = null
      this.permissions = {}
      this.isAuthenticated = false
      window.location.href = '/admin/index.php?logout=1'
    },
  },
})
```

- [ ] **Step 2: Create usePermissions composable**

```typescript
// admin/src/composables/usePermissions.ts
import { useAuthStore } from '@/stores/auth'
import { ROLE_HIERARCHY, type Role } from '@/lib/constants'

export function usePermissions() {
  const auth = useAuthStore()

  function can(section: string): boolean {
    if (!auth.user) return false
    const perms = auth.permissions[auth.user.role] || []
    return perms.includes(section) || perms.includes('modules') && ['furrperms', 'furrsecurity'].includes(section)
  }

  function isFounder(): boolean {
    return auth.user?.role === 'founder'
  }

  function minRole(role: Role): boolean {
    if (!auth.user) return false
    return ROLE_HIERARCHY.indexOf(auth.user.role) >= ROLE_HIERARCHY.indexOf(role)
  }

  return { can, isFounder, minRole }
}
```

- [ ] **Step 3: Create Vue Router with all routes and guards**

Create `admin/src/router/index.ts` with:
- Hash mode (`createWebHashHistory()`)
- All 18 routes from spec Section 4 (1 login + 17 authenticated including /players/:uuid)
- `beforeEach` guard checking `authStore.isAuthenticated`
- Lazy-loaded views via `() => import('@/views/...')`

- [ ] **Step 4: Commit**

```bash
git add admin/src/stores/auth.ts admin/src/router/index.ts admin/src/composables/usePermissions.ts
git commit -m "feat: add auth store, router with guards, and permissions composable"
```

---

### Task 6: App entry point and root component

**Files:**
- Create: `admin/src/main.ts`
- Create: `admin/src/App.vue`
- Create: `admin/src/views/LoginView.vue` (placeholder)
- Create: `admin/src/views/DashboardView.vue` (placeholder)

- [ ] **Step 1: Create main.ts**

```typescript
// admin/src/main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)

// Initialize auth from PHP-injected globals
import { useAuthStore } from './stores/auth'
const auth = useAuthStore()
auth.initialize()

app.mount('#app')
```

- [ ] **Step 2: Create App.vue with GSAP route transitions and toast container**

- [ ] **Step 3: Create placeholder LoginView.vue** with Discord OAuth button

- [ ] **Step 4: Create placeholder DashboardView.vue** with "Hello from Vue" text

- [ ] **Step 5: Verify app boots**

Run: `cd admin && npx vite --host`
Expected: Open browser, see placeholder content. Login redirect works.

- [ ] **Step 6: Commit**

```bash
git add admin/src/main.ts admin/src/App.vue admin/src/views/LoginView.vue admin/src/views/DashboardView.vue
git commit -m "feat: add Vue app entry point, root component, and placeholder views"
```

---

## Phase 2: Layout & Shared Components

### Task 7: UI store (toast, modal state)

**Files:**
- Create: `admin/src/stores/ui.ts`
- Create: `admin/src/composables/useToast.ts`

- [ ] **Step 1: Create ui store** with toast queue, active modal state, sidebar collapsed state, global loading flag

- [ ] **Step 2: Create useToast composable** wrapping ui store toast actions

- [ ] **Step 3: Commit**

```bash
git add admin/src/stores/ui.ts admin/src/composables/useToast.ts
git commit -m "feat: add UI store for toast notifications and modal state"
```

---

### Task 8: Layout components (Sidebar, Header, Footer)

**Files:**
- Create: `admin/src/components/layout/AppSidebar.vue`
- Create: `admin/src/components/layout/AppHeader.vue`
- Create: `admin/src/components/layout/AppFooter.vue`

- [ ] **Step 1: Create AppSidebar.vue**

Read `admin/index.php` sidebar HTML (find the `<aside class="sidebar">` section) and `admin/assets/css/admin.css` sidebar styles, then recreate with:
- Collapsible categories with GSAP animation
- Navigation items with Lucide icons
- Role-based visibility via `usePermissions`
- Active route highlighting
- Badge counts
- Collapse toggle button

- [ ] **Step 2: Create AppHeader.vue**

Recreate the header with search bar, refresh button, user avatar + name + role badge, logout button.

- [ ] **Step 3: Create AppFooter.vue**

Simple footer with branding and links matching current design.

- [ ] **Step 4: Create DashboardLayout.vue** (optional wrapper combining sidebar + header + router-view + footer)

- [ ] **Step 5: Update App.vue** to use DashboardLayout for authenticated routes

- [ ] **Step 6: Verify layout renders correctly**

Run: `cd admin && npx vite --host`
Expected: Sidebar + header + footer visible, navigation between placeholder views works

- [ ] **Step 7: Commit**

```bash
git add admin/src/components/layout/ admin/src/App.vue
git commit -m "feat: add sidebar, header, footer layout components"
```

---

### Task 9: Shared UI components

**Files:**
- Create: `admin/src/components/shared/BaseModal.vue`
- Create: `admin/src/components/shared/DataTable.vue`
- Create: `admin/src/components/shared/PaginationBar.vue`
- Create: `admin/src/components/shared/SearchInput.vue`
- Create: `admin/src/components/shared/FilterTabs.vue`
- Create: `admin/src/components/shared/ToggleSwitch.vue`
- Create: `admin/src/components/shared/StatusBadge.vue`
- Create: `admin/src/components/shared/StatCard.vue`
- Create: `admin/src/components/shared/EmptyState.vue`
- Create: `admin/src/components/shared/LoadingSkeleton.vue`
- Create: `admin/src/components/shared/ToastNotification.vue`
- Create: `admin/src/components/shared/CountryFlag.vue`
- Create: `admin/src/components/shared/PlayerAvatar.vue`
- Create: `admin/src/components/shared/PlayerCell.vue`
- Create: `admin/src/components/shared/IPCell.vue`

- [ ] **Step 1: Create BaseModal.vue** — GSAP-animated modal with v-model, overlay, escape-to-close, teleport

- [ ] **Step 2: Create DataTable.vue** — Generic table with loading/empty states, stagger animation

- [ ] **Step 3: Create PaginationBar.vue** — Page navigation component

- [ ] **Step 4: Create SearchInput.vue** — Debounced search with Lucide icon

- [ ] **Step 5: Create FilterTabs.vue** — Tab-based filter component

- [ ] **Step 6: Create remaining shared components** (ToggleSwitch, StatusBadge, StatCard, EmptyState, LoadingSkeleton, ToastNotification, CountryFlag, PlayerAvatar, PlayerCell, IPCell)

- [ ] **Step 7: Commit**

```bash
git add admin/src/components/shared/
git commit -m "feat: add all shared UI components"
```

---

## Phase 3: Stores + Views (Core Sections)

Each store+view task follows the same pattern:
1. Create Pinia store with all API actions
2. Create the Vue view component consuming the store
3. Verify it renders and fetches data

### Task 10: Overview store + DashboardView

**Files:**
- Create: `admin/src/stores/overview.ts`
- Modify: `admin/src/views/DashboardView.vue`

- [ ] **Step 1: Create overview store** — `fetchOverview()` (calls `get_overview`), `fetchCounts()` (calls `get_counts`). State: stats, recentConnections, recentBlocks, badgeCounts, loading.

- [ ] **Step 2: Build DashboardView** — 4 stat cards with GSAP counter animation, recent connections table, recent blocks table, quick action buttons. Read current `loadOverviewData()` in `admin/assets/js/admin.js` for exact data structure.

- [ ] **Step 3: Verify dashboard loads data**

Run: `cd admin && npx vite --host`
Expected: Dashboard shows stat cards and recent activity tables

- [ ] **Step 4: Commit**

```bash
git add admin/src/stores/overview.ts admin/src/views/DashboardView.vue
git commit -m "feat: add overview store and dashboard view with GSAP animations"
```

---

### Task 11: Players store + PlayersView

**Files:**
- Create: `admin/src/stores/players.ts`
- Create: `admin/src/views/PlayersView.vue`

- [ ] **Step 1: Create players store** — `fetchPlayers()`, `fetchPlayer(uuid)`, `lookupPlayer()`, `getNameHistory()`. State: players, pagination, filters, currentPlayer, lookedUpPlayer, nameHistory.

- [ ] **Step 2: Build PlayersView** — Filter tabs, search, DataTable with PlayerCell, pagination, row click navigation

- [ ] **Step 3: Commit**

```bash
git add admin/src/stores/players.ts admin/src/views/PlayersView.vue
git commit -m "feat: add players store and players view"
```

---

### Task 12: Connections store + ConnectionsView

**Files:**
- Create: `admin/src/stores/connections.ts`
- Create: `admin/src/views/ConnectionsView.vue`
- Create: `admin/src/components/modals/ConnectionModal.vue`

- [ ] **Step 1: Create connections store** — `fetchConnections()`, `fetchConnection(id)`

- [ ] **Step 2: Build ConnectionsView** — Filter tabs (all/allowed/blocked/proxy/vpn/hosting), DataTable, pagination

- [ ] **Step 3: Build ConnectionModal** — Detail view for single connection

- [ ] **Step 4: Commit**

```bash
git add admin/src/stores/connections.ts admin/src/views/ConnectionsView.vue admin/src/components/modals/ConnectionModal.vue
git commit -m "feat: add connections store and view"
```

---

### Task 13: IPs store + IPsView

**Files:**
- Create: `admin/src/stores/ips.ts`
- Create: `admin/src/views/IPsView.vue`
- Create: `admin/src/components/modals/IPModal.vue`

- [ ] **Step 1: Create IPs store + view + modal** — Same pattern as connections

- [ ] **Step 2: Commit**

```bash
git add admin/src/stores/ips.ts admin/src/views/IPsView.vue admin/src/components/modals/IPModal.vue
git commit -m "feat: add IPs store and view"
```

---

### Task 14: Whitelist store + WhitelistView

**Files:**
- Create: `admin/src/stores/whitelist.ts`
- Create: `admin/src/views/WhitelistView.vue`
- Create: `admin/src/components/modals/WhitelistModal.vue`

- [ ] **Step 1: Create whitelist store** — `fetch()`, `add()`, `edit()`, `remove()`, `removeByValue()`

- [ ] **Step 2: Build WhitelistView** — Type filters (uuid/nick/ip/ip_range/as), DataTable, add/edit modal

- [ ] **Step 3: Build WhitelistModal** — Dual mode (add/edit) via `mode` prop

- [ ] **Step 4: Commit**

```bash
git add admin/src/stores/whitelist.ts admin/src/views/WhitelistView.vue admin/src/components/modals/WhitelistModal.vue
git commit -m "feat: add whitelist store, view, and dual-mode modal"
```

---

### Task 15: Blacklist store + BlacklistView + SanctionsView

**Files:**
- Create: `admin/src/stores/blacklist.ts`
- Create: `admin/src/views/BlacklistView.vue`
- Create: `admin/src/views/SanctionsView.vue`
- Create: `admin/src/components/modals/BlacklistModal.vue`

- [ ] **Step 1: Create blacklist store** — `fetch()`, `add()`, `addUnified()`, `addIP()`, `edit()`, `remove()`, `removeByValue()`, `toggle()`

- [ ] **Step 2: Build BlacklistView** — Type filters, DataTable, toggle active, BlacklistModal with variant (player/ip/unified)

- [ ] **Step 3: Build SanctionsView** — Stats cards (total/active/permanent/temporary/expired), sanctions table

- [ ] **Step 4: Commit**

```bash
git add admin/src/stores/blacklist.ts admin/src/views/BlacklistView.vue admin/src/views/SanctionsView.vue admin/src/components/modals/BlacklistModal.vue
git commit -m "feat: add blacklist store, view, sanctions view, and modal"
```

---

### Task 16: Providers store + ProvidersView

**Files:**
- Create: `admin/src/stores/providers.ts`
- Create: `admin/src/views/ProvidersView.vue`
- Create: `admin/src/components/modals/ProviderModal.vue`

- [ ] **Step 1: Create providers store** — `fetch()`, `add()`, `toggle()`

- [ ] **Step 2: Build ProvidersView + ProviderModal**

- [ ] **Step 3: Commit**

```bash
git add admin/src/stores/providers.ts admin/src/views/ProvidersView.vue admin/src/components/modals/ProviderModal.vue
git commit -m "feat: add providers store and view"
```

---

### Task 17: Countries store + CountriesView

**Files:**
- Create: `admin/src/stores/countries.ts`
- Create: `admin/src/views/CountriesView.vue`
- Modify: `admin/src/components/modals/CountryModal.vue` (dual add/edit)

- [ ] **Step 1: Create countries store** — `fetch()`, `add()`, `edit()`, `toggle()`, `remove()`

- [ ] **Step 2: Build CountriesView** — Table with CountryFlag, kick message, toggle, CountryModal (add/edit)

- [ ] **Step 3: Commit**

```bash
git add admin/src/stores/countries.ts admin/src/views/CountriesView.vue admin/src/components/modals/CountryModal.vue
git commit -m "feat: add countries store and view"
```

---

### Task 18: Continents store + ContinentsView

**Files:**
- Create: `admin/src/stores/continents.ts`
- Create: `admin/src/views/ContinentsView.vue`
- Create: `admin/src/components/modals/ContinentModal.vue`

- [ ] **Step 1: Create continents store + view + modal** — Same pattern as countries

- [ ] **Step 2: Commit**

```bash
git add admin/src/stores/continents.ts admin/src/views/ContinentsView.vue admin/src/components/modals/ContinentModal.vue
git commit -m "feat: add continents store and view"
```

---

### Task 19: FurrPerms store + FurrPermsView

**Files:**
- Create: `admin/src/stores/furrperms.ts`
- Create: `admin/src/views/FurrPermsView.vue`
- Create: `admin/src/components/modals/FurrPermsModal.vue`

- [ ] **Step 1: Create furrperms store** — `fetchWhitelist()`, `addToWhitelist()`, `removeFromWhitelist()`, `fetchLogs()`, `clearLogs()`, `fetchStats()`

- [ ] **Step 2: Build FurrPermsView** — Two tabs (Whitelist + Logs), stats bar, search, FurrPermsModal

- [ ] **Step 3: Commit**

```bash
git add admin/src/stores/furrperms.ts admin/src/views/FurrPermsView.vue admin/src/components/modals/FurrPermsModal.vue
git commit -m "feat: add FurrPerms store and view"
```

---

### Task 20: FurrSecurity store + FurrSecurityView

**Files:**
- Create: `admin/src/stores/furrsecurity.ts`
- Create: `admin/src/views/FurrSecurityView.vue`
- Create: `admin/src/components/modals/FurrSecurityModal.vue`

- [ ] **Step 1: Create furrsecurity store** — Staff/sessions/logs/stats with search state

- [ ] **Step 2: Build FurrSecurityView** — Three tabs (Staff + Sessions + Logs), stats, FurrSecurityModal

- [ ] **Step 3: Commit**

```bash
git add admin/src/stores/furrsecurity.ts admin/src/views/FurrSecurityView.vue admin/src/components/modals/FurrSecurityModal.vue
git commit -m "feat: add FurrSecurity store and view"
```

---

### Task 21: Messages store + MessagesView

**Files:**
- Create: `admin/src/stores/messages.ts`
- Create: `admin/src/views/MessagesView.vue`

- [ ] **Step 1: Create messages store** — `fetch()`, `save()`

- [ ] **Step 2: Build MessagesView** — Message categories, Minecraft color code editor, variable insertion, save button

- [ ] **Step 3: Commit**

```bash
git add admin/src/stores/messages.ts admin/src/views/MessagesView.vue
git commit -m "feat: add messages store and view"
```

---

### Task 22: Logs store + LogsView

**Files:**
- Create: `admin/src/stores/logs.ts`
- Create: `admin/src/views/LogsView.vue`

- [ ] **Step 1: Create logs store** — `fetch()` with type filter

- [ ] **Step 2: Build LogsView** — Type filter tabs, DataTable, pagination

- [ ] **Step 3: Commit**

```bash
git add admin/src/stores/logs.ts admin/src/views/LogsView.vue
git commit -m "feat: add logs store and view"
```

---

### Task 23: Settings store + SettingsView

**Files:**
- Create: `admin/src/stores/settings.ts`
- Create: `admin/src/views/SettingsView.vue`

- [ ] **Step 1: Create settings store** — `fetch()`, `save()`, `regenerateApiKey()`, `exportData()`, `migrateBlacklist()`, `migratePlayers()`

- [ ] **Step 2: Build SettingsView** — Toggle switches, API key display, migration tools (founder only)

- [ ] **Step 3: Commit**

```bash
git add admin/src/stores/settings.ts admin/src/views/SettingsView.vue
git commit -m "feat: add settings store and view"
```

---

### Task 24: Users store + UsersView

**Files:**
- Create: `admin/src/stores/users.ts`
- Create: `admin/src/views/UsersView.vue`
- Create: `admin/src/components/modals/AdminUserModal.vue`

- [ ] **Step 1: Create users store** — `fetch()`, `add()`, `remove()`

- [ ] **Step 2: Build UsersView + AdminUserModal** — Admin user table with add/remove, role assignment

- [ ] **Step 3: Commit**

```bash
git add admin/src/stores/users.ts admin/src/views/UsersView.vue admin/src/components/modals/AdminUserModal.vue
git commit -m "feat: add users store, view, and admin user modal"
```

---

## Phase 4: Player Detail & Auth Views

### Task 25: PlayerDetailView (replaces player.php)

**Files:**
- Create: `admin/src/views/PlayerDetailView.vue`
- Create: `admin/src/components/shared/SkinViewer.vue`

- [ ] **Step 1: Read current `admin/player.php` fully** to understand exact layout and all features

- [ ] **Step 2: Create SkinViewer.vue** — skinview3d wrapper component using `ref` + `onMounted`, loads from npm

- [ ] **Step 3: Build PlayerDetailView** — Two-column layout: sticky sidebar (SkinViewer + player info) + main content with stacked sections (Account Status, General Info, Name History, IP History, Recent Connections). Inline whitelist/blacklist modals.

- [ ] **Step 4: Verify player detail renders**

Navigate to `/players/{uuid}` with a real UUID, verify all sections load

- [ ] **Step 5: Commit**

```bash
git add admin/src/views/PlayerDetailView.vue admin/src/components/shared/SkinViewer.vue
git commit -m "feat: add player detail view with skin viewer (replaces player.php)"
```

---

### Task 26: LoginView with Discord OAuth

**Files:**
- Modify: `admin/src/views/LoginView.vue`

- [ ] **Step 1: Build LoginView** — Read current login HTML from `admin/index.php` (the `#loginContainer` section). Recreate with animated background, glass card, Discord button. Login URL comes from PHP via a data attribute or inline script.

- [ ] **Step 2: Verify login flow works** — Click Discord button → OAuth → callback → redirect back → Vue shows dashboard

- [ ] **Step 3: Commit**

```bash
git add admin/src/views/LoginView.vue
git commit -m "feat: add login view with Discord OAuth"
```

---

### Task 27: Utility modals (Confirm, Prompt, Alert)

**Files:**
- Create: `admin/src/components/modals/ConfirmModal.vue`
- Create: `admin/src/components/modals/PromptModal.vue`
- Create: `admin/src/components/modals/AlertModal.vue`
- Create: `admin/src/components/modals/PlayerModal.vue` (quick view)

- [ ] **Step 1: Build ConfirmModal, PromptModal, AlertModal** — Extend BaseModal with specific content/actions

- [ ] **Step 2: Build PlayerModal** — Quick player detail popup (read from `admin.js` `showPlayerModal`)

- [ ] **Step 3: Commit**

```bash
git add admin/src/components/modals/ConfirmModal.vue admin/src/components/modals/PromptModal.vue admin/src/components/modals/AlertModal.vue admin/src/components/modals/PlayerModal.vue
git commit -m "feat: add utility modals (confirm, prompt, alert, player quick view)"
```

---

## Phase 5: GSAP Animations & Polish

### Task 28: GSAP animations composable

**Files:**
- Create: `admin/src/composables/useAnimations.ts`
- Modify: `admin/src/App.vue` (route transitions)

- [ ] **Step 1: Create useAnimations composable** — Stagger reveal, counter animation, scroll reveal (IntersectionObserver)

- [ ] **Step 2: Add GSAP route transitions to App.vue** — fadeIn + translateY on route change

- [ ] **Step 3: Add GSAP animations to views** — Stagger on table rows, counters on stat cards, glow follow-cursor on cards

- [ ] **Step 4: Commit**

```bash
git add admin/src/composables/useAnimations.ts admin/src/App.vue
git commit -m "feat: add GSAP animations composable and route transitions"
```

---

### Task 29: Responsive design & mobile layout

**Files:**
- Modify: `admin/src/components/layout/AppSidebar.vue`
- Modify: `admin/src/style.css` (responsive utilities)
- Modify: All views as needed

- [ ] **Step 1: Add responsive breakpoints** — Sidebar collapses to hamburger on mobile, tables stack, grids adapt

- [ ] **Step 2: Test on mobile viewport** — Verify all sections usable at 768px and below

- [ ] **Step 3: Commit**

```bash
git add -u
git commit -m "feat: add responsive design for mobile and tablet"
```

---

## Phase 6: Cleanup & Deployment

### Task 30: Remove old frontend files

**Files:**
- Delete: `admin/assets/js/admin.js`
- Delete: `admin/assets/js/admin.js.backup`
- Delete: `admin/assets/js/admin.js.tmp`
- Delete: `admin/assets/js/admin.js.new`
- Delete: `admin/assets/css/admin.css`
- Delete: `admin/assets/css/animations.css`
- Delete: `admin/assets/css/furrperms.css`
- Delete: `admin/assets/css/furrsecurity.css`
- Delete: `admin/player.php`

- [ ] **Step 1: Verify all features work in Vue app** before deleting old files

- [ ] **Step 2: Delete old frontend files**

- [ ] **Step 3: Commit**

```bash
git rm admin/assets/js/admin.js admin/assets/js/admin.js.backup admin/assets/js/admin.js.tmp admin/assets/js/admin.js.new
git rm admin/assets/css/admin.css admin/assets/css/animations.css admin/assets/css/furrperms.css admin/assets/css/furrsecurity.css
git rm admin/player.php
git commit -m "chore: remove old vanilla JS/CSS frontend files replaced by Vue app"
```

---

### Task 31: Production build & deployment config

**Files:**
- Modify: `admin/vite.config.ts` (build optimization)
- Create: `admin/.htaccess` (Apache fallback)
- Create: `admin/.gitignore`

- [ ] **Step 1: Add .gitignore for admin/**

```
node_modules/
dist/
*.local
```

- [ ] **Step 2: Create .htaccess** per spec Section 14

- [ ] **Step 3: Run production build**

Run: `cd admin && npm run build`
Expected: `dist/` folder created with bundled assets

- [ ] **Step 4: Verify production build works** — Serve dist/ + index.php together

- [ ] **Step 5: Commit**

```bash
git add admin/.gitignore admin/.htaccess
git commit -m "feat: add deployment config and production build setup"
```

---

### Task 32: Final integration test

- [ ] **Step 1: Test all 16 sections** — Navigate to each, verify data loads, actions work

- [ ] **Step 2: Test all modals** — Open add/edit/confirm/prompt/alert modals, verify data submission

- [ ] **Step 3: Test auth flow** — Login → use app → logout → redirect to login

- [ ] **Step 4: Test player detail** — Navigate from players list, verify skin viewer, name history, inline actions

- [ ] **Step 5: Test responsive** — Check mobile, tablet, desktop breakpoints

- [ ] **Step 6: Final commit**

```bash
git add -u
git commit -m "chore: final integration testing and cleanup"
```
