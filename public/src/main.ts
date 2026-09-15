import '@shared/tokens.css'
import '@shared/base.css'
import './styles/app.css'
import { createApp, type Component } from 'vue'
import { applyScrub, resolveView } from './boot'

// Antes de pintar nada: el token y el código OAuth no deben quedar en el historial
applyScrub(window.location, window.history)

const view = resolveView(window.__VERIFY_DATA__)

async function loadView(): Promise<{ component: Component; props?: Record<string, unknown> }> {
  if (view.kind === 'verify') {
    const { default: component } = await import('./verify/VerifyApp.vue')
    return { component, props: { data: view.data } }
  }
  const { default: component } = await import('./landing/LandingApp.vue')
  return { component }
}

function showLoadError(root: HTMLElement): void {
  const text = document.createElement('p')
  text.className = 'noscript'
  text.textContent = 'No se pudo cargar la página. Recárgala para intentarlo de nuevo.'
  root.replaceChildren(text)
  root.removeAttribute('aria-busy')
}

async function start(): Promise<void> {
  const root = document.getElementById('app')
  if (!root) return
  try {
    const { component, props } = await loadView()
    root.classList.remove('arranque')
    root.removeAttribute('aria-busy')
    createApp(component, props).mount(root)
  } catch (error: unknown) {
    // Suele ser un chunk viejo tras un despliegue con el HTML cacheado
    console.error('[FurrGuard] Error al cargar la vista', error)
    showLoadError(root)
  }
}

void start()
