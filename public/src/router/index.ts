import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'landing',
      component: () => import('@/views/LandingView.vue'),
    },
    {
      path: '/verify',
      name: 'verify',
      component: () => import('@/views/VerifyView.vue'),
    },
  ],
})

// When PHP injects verification data, auto-navigate to /verify
router.beforeEach((to) => {
  if (to.path === '/' && window.__VERIFY_DATA__) {
    return { name: 'verify' }
  }
})

export default router
