import { ref } from 'vue'

/** Última miga de la barra superior en las fichas (p. ej. el nick del jugador). Se limpia al navegar. */
export const detailCrumb = ref<string | null>(null)
