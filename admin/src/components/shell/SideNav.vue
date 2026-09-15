<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import type { Section } from '@/api/types'
import { firstSection, navFor } from '@/lib/permissions'
import { useSession } from '@/stores/session'

const session = useSession()
const route = useRoute()
const groups = computed(() => navFor(session.permissions))
const home = computed(() => firstSection(session.permissions) ?? 'overview')

const isActive = (section: Section): boolean => route.name === section || route.meta.parent === section

const status = computed(() => {
  switch (session.tone) {
    case 'ok': return { tone: 'ok', text: 'Todo en orden' }
    case 'warn': return { tone: 'warn', text: 'Funcionando con avisos' }
    case 'down': return { tone: 'down', text: 'Requiere atención' }
    default: return { tone: '', text: 'Comprobando estado…' }
  }
})
</script>

<template>
  <aside class="lado" aria-label="Barra lateral">
    <RouterLink class="lado-marca" :to="{ name: home }">
      <img src="@shared/ui/img/furrguard-64.webp" width="32" height="32" alt="">
      <span class="nombre">
        <b>Furr<span>Guard</span></b>
        <span class="label"><span class="baliza viva" />Panel de administración</span>
      </span>
    </RouterLink>

    <nav class="lado-nav" aria-label="Secciones del panel">
      <div v-for="group in groups" :key="group.title" class="nav-grupo">
        <span class="label">{{ group.title }}</span>
        <ul>
          <li v-for="item in group.items" :key="item.section">
            <RouterLink :to="{ name: item.section }" class="nav-item" :aria-current="isActive(item.section) ? 'page' : undefined">
              <component :is="item.icon" aria-hidden="true" />
              <span class="texto">{{ item.label }}</span>
            </RouterLink>
          </li>
        </ul>
      </div>
    </nav>

    <div class="lado-pie">
      <component
        :is="session.can('overview') ? 'RouterLink' : 'span'"
        :to="session.can('overview') ? { name: 'overview' } : undefined"
        class="lado-estado"
        :class="status.tone"
      >
        <span class="baliza" :class="{ viva: status.tone === 'down' }" />
        <span class="texto">{{ status.text }}</span>
      </component>
      <span class="label">FurrGuard {{ session.boot?.version ? `v${session.boot.version}` : '' }}</span>
    </div>
  </aside>
</template>
