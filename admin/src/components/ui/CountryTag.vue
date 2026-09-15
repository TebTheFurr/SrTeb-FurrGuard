<script setup lang="ts">
withDefaults(defineProps<{ code: string | null | undefined; name?: string | null; showName?: boolean }>(), {
  name: null,
  showName: false,
})
</script>

<template>
  <span v-if="code || name" class="pais" :title="name ?? undefined">
    <span class="codigo">{{ code || '??' }}</span>
    <span v-if="showName && name" class="nombre">{{ name }}</span>
  </span>
  <span v-else class="faint">—</span>
</template>

<style scoped>
.pais { display: inline-flex; align-items: center; gap: 7px; min-width: 0; }
.codigo {
  display: inline-grid;
  place-items: center;
  min-width: 26px;
  height: 18px;
  padding: 0 4px;
  border: 1px solid var(--rule-2);
  border-radius: 4px;
  font-family: var(--mono);
  font-size: 10px;
  color: var(--ink-2);
  background: var(--surface-2);
}
.nombre { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
