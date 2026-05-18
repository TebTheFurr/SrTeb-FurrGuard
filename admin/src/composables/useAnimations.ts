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
      y: options.y ?? 16,
      duration: options.duration ?? 0.4,
      stagger: options.stagger ?? 0.06,
      delay: options.delay ?? 0,
      ease: 'power3.out',
    })
  }

  /**
   * Counter animation: animate a number from 0 to targetValue inside an element.
   * Updates the element's textContent on each frame.
   */
  function counterAnimation(
    element: HTMLElement,
    targetValue: number,
    duration = 1.2,
  ): void {
    const obj = { value: 0 }
    gsap.to(obj, {
      value: targetValue,
      duration,
      ease: 'power3.out',
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
                y: options.y ?? 24,
                duration: options.duration ?? 0.5,
                ease: 'power3.out',
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
        boxShadow: `${x / rect.width * 30 - 15}px ${y / rect.height * 30 - 15}px 40px rgba(139, 92, 246, 0.2), 0 0 20px rgba(139, 92, 246, 0.1)`,
        duration: 0.3,
        ease: 'power2.out',
      })
    }

    const handleMouseLeave = () => {
      gsap.to(element, {
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1), 0 10px 40px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        duration: 0.4,
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

  /**
   * Scale-in entrance animation for an element.
   */
  function scaleIn(element: HTMLElement, duration = 0.3): void {
    gsap.from(element, {
      opacity: 0,
      scale: 0.92,
      duration,
      ease: 'back.out(1.4)',
    })
  }

  /**
   * Slide in from side with blur.
   */
  function slideInFromSide(
    selector: string,
    direction: 'left' | 'right' = 'left',
    options: { duration?: number; stagger?: number } = {},
  ): void {
    const elements = document.querySelectorAll(selector)
    if (elements.length === 0) return

    const xStart = direction === 'left' ? -20 : 20

    gsap.from(elements, {
      opacity: 0,
      x: xStart,
      filter: 'blur(4px)',
      duration: options.duration ?? 0.4,
      stagger: options.stagger ?? 0.05,
      ease: 'power3.out',
    })
  }

  // Auto-cleanup on component unmount
  onUnmounted(() => {
    cleanupFns.forEach((fn) => fn())
    cleanupFns.length = 0
  })

  return { staggerReveal, counterAnimation, scrollReveal, cardGlow, scaleIn, slideInFromSide }
}
