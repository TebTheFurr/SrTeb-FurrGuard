<script setup lang="ts">
import { computed } from 'vue'
import VerifyCard from '@/components/verify/VerifyCard.vue'
import VerifyError from '@/components/verify/VerifyError.vue'
import VerifySuccess from '@/components/verify/VerifySuccess.vue'

const data = computed(() => window.__VERIFY_DATA__ ?? { state: 'error' as const, title: 'Error', message: 'No se recibieron datos de verificacion.' })
</script>

<template>
  <div
    class="min-h-screen flex items-center justify-center p-5"
    style="background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)"
  >
    <div class="w-full max-w-md">
      <VerifyCard
        v-if="data.state === 'form'"
        :minecraft-nick="data.minecraft_nick ?? ''"
        :discord-login-url="data.discord_login_url ?? ''"
        :expires-at="data.expires_at ?? ''"
      />
      <VerifyError
        v-else-if="data.state === 'error'"
        :title="data.title ?? 'Error'"
        :message="data.message ?? ''"
      />
      <VerifySuccess
        v-else-if="data.state === 'success'"
        :title="data.title ?? ''"
        :message="data.message ?? ''"
      />
    </div>
  </div>
</template>
