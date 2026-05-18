import { onMounted, onUnmounted } from 'vue'
import { gsap } from 'gsap'

export function useCardEffects() {
  const cleanupFns: (() => void)[] = []

  onMounted(() => {
    // Set initial hidden state for all reveal targets
    const revealElements = document.querySelectorAll('.card-3d, .fade-on-scroll')
    revealElements.forEach((el) => {
      gsap.set(el, { opacity: 0, y: 30 })
    })

    // Scroll reveal for cards - use gsap.to from already-set state
    if (revealElements.length > 0) {
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              const delay = (entry.target as HTMLElement).dataset.delay ?? '0'
              gsap.to(entry.target, {
                opacity: 1,
                y: 0,
                duration: 0.7,
                delay: Number(delay),
                ease: 'power3.out',
              })
              observer.unobserve(entry.target)
            }
          }
        },
        { rootMargin: '0px 0px -60px 0px', threshold: 0.1 },
      )
      revealElements.forEach((el) => observer.observe(el))
      cleanupFns.push(() => observer.disconnect())
    }

    // 3D card tilt effect
    const cards = document.querySelectorAll('.card-3d')
    cards.forEach((card) => {
      const el = card as HTMLElement

      const handleMouseMove = (e: MouseEvent) => {
        const rect = el.getBoundingClientRect()
        const centerX = rect.left + rect.width / 2
        const centerY = rect.top + rect.height / 2
        const rotateX = ((e.clientY - centerY) / rect.height) * -6
        const rotateY = ((e.clientX - centerX) / rect.width) * 6

        gsap.to(el, {
          rotateX,
          rotateY,
          duration: 0.4,
          ease: 'power2.out',
          transformPerspective: 1000,
        })

        // Glow effect follows cursor
        const glowX = ((e.clientX - rect.left) / rect.width) * 100
        const glowY = ((e.clientY - rect.top) / rect.height) * 100
        el.style.setProperty('--glow-x', `${glowX}%`)
        el.style.setProperty('--glow-y', `${glowY}%`)
      }

      const handleMouseLeave = () => {
        gsap.to(el, {
          rotateX: 0,
          rotateY: 0,
          duration: 0.6,
          ease: 'power2.out',
        })
        el.style.removeProperty('--glow-x')
        el.style.removeProperty('--glow-y')
      }

      el.addEventListener('mousemove', handleMouseMove)
      el.addEventListener('mouseleave', handleMouseLeave)

      cleanupFns.push(() => {
        el.removeEventListener('mousemove', handleMouseMove)
        el.removeEventListener('mouseleave', handleMouseLeave)
      })
    })

    // Hero stagger reveal - use nextTick timing
    const heroChildren = document.querySelectorAll('.hero-stagger > *')
    if (heroChildren.length > 0) {
      gsap.from(heroChildren, {
        opacity: 0,
        y: 30,
        duration: 0.8,
        stagger: 0.12,
        ease: 'power3.out',
        delay: 0.3,
      })
    }

    // Magnetic button effect
    const buttons = document.querySelectorAll('.btn-magnetic')
    buttons.forEach((btn) => {
      const el = btn as HTMLElement

      const handleMouseMove = (e: MouseEvent) => {
        const rect = el.getBoundingClientRect()
        const x = e.clientX - rect.left - rect.width / 2
        const y = e.clientY - rect.top - rect.height / 2
        gsap.to(el, {
          x: x * 0.25,
          y: y * 0.25,
          duration: 0.3,
          ease: 'power2.out',
        })
      }

      const handleMouseLeave = () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.5)' })
      }

      el.addEventListener('mousemove', handleMouseMove)
      el.addEventListener('mouseleave', handleMouseLeave)

      cleanupFns.push(() => {
        el.removeEventListener('mousemove', handleMouseMove)
        el.removeEventListener('mouseleave', handleMouseLeave)
      })
    })

    // Section headers reveal
    const sectionHeaders = document.querySelectorAll('.section-header-reveal')
    if (sectionHeaders.length > 0) {
      gsap.set(sectionHeaders, { opacity: 0, y: 20 })
      const headerObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              gsap.to(entry.target, {
                opacity: 1,
                y: 0,
                duration: 0.6,
                ease: 'power3.out',
              })
              headerObserver.unobserve(entry.target)
            }
          }
        },
        { rootMargin: '0px 0px -40px 0px', threshold: 0.2 },
      )
      sectionHeaders.forEach((el) => headerObserver.observe(el))
      cleanupFns.push(() => headerObserver.disconnect())
    }

    // Counter animation for hero stats
    const statValues = document.querySelectorAll('.stat-counter')
    statValues.forEach((stat) => {
      const el = stat as HTMLElement
      const text = el.textContent ?? ''
      const numMatch = text.match(/(\d+)/)
      if (numMatch) {
        const target = Number(numMatch[1])
        el.textContent = text.replace(/\d+/, '0')
        const statObserver = new IntersectionObserver(
          (entries) => {
            const entry = entries[0]
            if (!entry?.isIntersecting) return
            {
              const obj = { val: 0 }
              gsap.to(obj, {
                val: target,
                duration: 1.5,
                ease: 'power2.out',
                onUpdate: () => {
                  el.textContent = text.replace(/\d+/, String(Math.round(obj.val)))
                },
              })
              statObserver.unobserve(el)
            }
          },
          { threshold: 0.5 },
        )
        statObserver.observe(el)
        cleanupFns.push(() => statObserver.disconnect())
      }
    })
  })

  onUnmounted(() => {
    cleanupFns.forEach((fn) => fn())
    cleanupFns.length = 0
  })
}
