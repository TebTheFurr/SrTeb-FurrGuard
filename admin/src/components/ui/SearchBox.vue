<script setup lang="ts">
import { useId } from 'vue'
import IconSearch from '~icons/lucide/search'

withDefaults(defineProps<{ label?: string; placeholder?: string }>(), {
  label: 'Buscar',
  placeholder: 'Buscar…',
})
const model = defineModel<string>({ required: true })
const id = useId()
</script>

<template>
  <div class="buscador">
    <label :for="id" class="sr-only">{{ label }}</label>
    <IconSearch aria-hidden="true" />
    <input
      :id="id"
      v-model="model"
      class="input"
      type="search"
      :placeholder="placeholder"
      autocomplete="off"
      spellcheck="false"
      maxlength="100"
    >
  </div>
</template>
