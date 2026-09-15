import { onMounted, onUnmounted, ref } from 'vue'

export function useScrollEffects() {
  const isScrolled = ref(false)
  const activeSection = ref('')

  let rafId = 0
  let scrollHandler: (() => void) | null = null

  onMounted(() => {
    // Header scroll effect
    scrollHandler = () => {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        isScrolled.value = window.scrollY > 50
        rafId = 0
      })
    }
    window.addEventListener('scroll', scrollHandler, { passive: true })

    // Active nav tracking
    const sections = document.querySelectorAll('section[id]')
    const navObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            activeSection.value = entry.target.id
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px' },
    )
    sections.forEach((s) => navObserver.observe(s))

    // Smooth scroll for anchor links
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const anchor = target.closest('a[href^="#"]')
      if (!anchor) return
      e.preventDefault()
      const id = anchor.getAttribute('href')!.slice(1)
      const el = document.getElementById(id)
      if (el) {
        const headerHeight = 80
        const top = el.getBoundingClientRect().top + window.scrollY - headerHeight
        window.scrollTo({ top, behavior: 'smooth' })
        el.focus({ preventScroll: true })
      }
    }
    document.addEventListener('click', handleAnchorClick)

    onUnmounted(() => {
      window.removeEventListener('scroll', scrollHandler!)
      navObserver.disconnect()
      document.removeEventListener('click', handleAnchorClick)
      if (rafId) cancelAnimationFrame(rafId)
    })
  })

  return { isScrolled, activeSection }
}
