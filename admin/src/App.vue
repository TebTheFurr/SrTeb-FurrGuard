<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import ConfirmHost from '@/components/ui/ConfirmHost.vue'
import ToastHost from '@/components/ui/ToastHost.vue'
import { useSession } from '@/stores/session'

const AppShell = defineAsyncComponent(() => import('@/components/shell/AppShell.vue'))
const LoginScreen = defineAsyncComponent(() => import('@/components/shell/LoginScreen.vue'))

const session = useSession()
</script>

<template>
  <AppShell v-if="session.user" />
  <LoginScreen v-else />
  <ToastHost />
  <ConfirmHost />
</template>
