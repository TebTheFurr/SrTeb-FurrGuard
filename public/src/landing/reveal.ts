import type { Directive } from 'vue'

/*
 * v-reveal: aparece al entrar en pantalla. Un solo IntersectionObserver para toda la
 * página. Sin soporte o con "reducir movimiento" no se oculta nada.
 */

let observer: IntersectionObserver | null | undefined

function getObserver(): IntersectionObserver | null {
  if (observer !== undefined) return observer
  const canAnimate =
    typeof IntersectionObserver !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  observer = canAnimate
    ? new IntersectionObserver(
        (entries, io) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue
            entry.target.classList.add('visible')
            io.unobserve(entry.target)
          }
        },
        { rootMargin: '0px 0px -8% 0px' },
      )
    : null
  return observer
}

export const vReveal: Directive<HTMLElement> = {
  mounted(el) {
    const io = getObserver()
    if (!io) return
    el.classList.add('reveal')
    io.observe(el)
  },
  beforeUnmount(el) {
    observer?.unobserve(el)
  },
}
