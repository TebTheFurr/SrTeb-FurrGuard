import { gsap } from 'gsap'
import { onMounted, onUnmounted } from 'vue'

interface StaggerRevealOptions {
  delay?: number
  stagger?: number
  y?: number
  duration?: number
}

export function useAnimations() {
  // Track cleanup functions for event listeners
  const cleanupFns: (() => void)[] = []

  /**
   * Stagger reveal: fade in + slide up with stagger delay between elements.
   * Useful for table rows, cards, list items.
   */
  function staggerReveal(
    selector: string,
    options: StaggerRevealOptions = {},
  ): void {
    const elements = document.querySelectorAll(selector)
    if (elements.length === 0) return

    gsap.from(elements, {
      opacity: 0,
      y: options.y ?? 20,
      duration: options.duration ?? 0.5,
      stagger: options.stagger ?? 0.1,
      delay: options.delay ?? 0,
      ease: 'power2.out',
    })
  }

  /**
   * Counter animation: animate a number from 0 to targetValue inside an element.
   * Updates the element's textContent on each frame.
   */
  function counterAnimation(
    element: HTMLElement,
    targetValue: number,
    duration = 1.5,
  ): void {
    const obj = { value: 0 }
    gsap.to(obj, {
      value: targetValue,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        element.textContent = Math.round(obj.value).toLocaleString()
      },
    })
  }

  /**
   * Scroll reveal using IntersectionObserver + GSAP.
   * Elements fade in + slide up when they enter the viewport.
   * Must be called inside setup() so onMounted registers correctly.
   */
  function scrollReveal(
    selector: string,
    options: { threshold?: number; y?: number; duration?: number } = {},
  ): void {
    onMounted(() => {
      const elements = document.querySelectorAll(selector)
      if (elements.length === 0) return

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              gsap.from(entry.target, {
                opacity: 0,
                y: options.y ?? 30,
                duration: options.duration ?? 0.6,
                ease: 'power2.out',
              })
              observer.unobserve(entry.target)
            }
          })
        },
        { threshold: options.threshold ?? 0.1 },
      )

      elements.forEach((el) => observer.observe(el))
    })
  }

  /**
   * Card glow: follow-cursor box-shadow effect on an element.
   * Returns a cleanup function to remove the event listeners.
   */
  function cardGlow(element: HTMLElement): () => void {
    const handleMouseMove = (e: MouseEvent) => {
      const rect = element.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      gsap.to(element, {
        boxShadow: `${x / rect.width * 40 - 20}px ${y / rect.height * 40 - 20}px 30px rgba(139, 92, 246, 0.25), 0 0 20px rgba(139, 92, 246, 0.15)`,
        duration: 0.3,
        ease: 'power2.out',
      })
    }

    const handleMouseLeave = () => {
      gsap.to(element, {
        boxShadow: 'none',
        duration: 0.3,
        ease: 'power2.out',
      })
    }

    element.addEventListener('mousemove', handleMouseMove)
    element.addEventListener('mouseleave', handleMouseLeave)

    const cleanup = () => {
      element.removeEventListener('mousemove', handleMouseMove)
      element.removeEventListener('mouseleave', handleMouseLeave)
    }

    cleanupFns.push(cleanup)
    return cleanup
  }

  // Auto-cleanup on component unmount
  onUnmounted(() => {
    cleanupFns.forEach((fn) => fn())
    cleanupFns.length = 0
  })

  return { staggerReveal, counterAnimation, scrollReveal, cardGlow }
}
