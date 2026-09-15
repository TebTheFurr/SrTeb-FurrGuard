<script setup lang="ts">
/** Tipo + valor de una entrada de whitelist/blacklist con ayuda de formato y validación por tipo. */
import { computed, useId } from 'vue'
import type { EntryType } from '@/api/types'
import { ENTRY_TYPES, entryInfo, validateEntry } from '@/lib/entries'

const props = withDefaults(defineProps<{ touched?: boolean; lockType?: boolean }>(), { touched: false, lockType: false })
const type = defineModel<EntryType>('type', { required: true })
const value = defineModel<string>('value', { required: true })

const typeId = useId()
const valueId = useId()
const helpId = useId()
const info = computed(() => entryInfo(type.value))
const problem = computed(() => (props.touched || value.value ? validateEntry(type.value, value.value) : null))
</script>

<template>
  <div class="formulario">
    <div class="campo">
      <label :for="typeId">Tipo</label>
      <select :id="typeId" v-model="type" class="select" :disabled="lockType">
        <option v-for="option in ENTRY_TYPES" :key="option.value" :value="option.value">{{ option.label }}</option>
      </select>
    </div>
    <div class="campo">
      <label :for="valueId">Valor</label>
      <input
        :id="valueId"
        v-model.trim="value"
        class="input mono"
        :placeholder="info?.placeholder"
        :aria-invalid="problem ? 'true' : undefined"
        :aria-describedby="helpId"
        autocomplete="off"
        spellcheck="false"
        maxlength="255"
        required
        autofocus
      >
      <p :id="helpId" class="ayuda">{{ info?.help }}</p>
      <p v-if="problem" class="error" role="alert">{{ problem }}</p>
    </div>
  </div>
</template>
