import { createRouter, createWebHashHistory } from 'vue-router'
import { authReady, authState } from '@/composables/auth'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { title: 'Tổng quan' },
  },
  {
    path: '/cycles',
    name: 'cycles',
    component: () => import('@/views/CyclesView.vue'),
    meta: { title: 'Chu kì' },
  },
  {
    path: '/rewards',
    name: 'rewards',
    component: () => import('@/views/RewardsView.vue'),
    meta: { title: 'Phần thưởng' },
  },
  {
    path: '/planner',
    name: 'planner',
    component: () => import('@/views/TradePlannerView.vue'),
    meta: { title: 'Gợi ý ngày trade' },
  },
  {
    path: '/tools',
    name: 'tools',
    component: () => import('@/views/ToolsView.vue'),
    meta: { title: 'Công cụ' },
  },
  {
    path: '/accounts',
    name: 'accounts',
    component: () => import('@/views/AccountsView.vue'),
    meta: { title: 'Tài khoản' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { title: 'Cài đặt' },
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach(async (to) => {
  await authReady // chờ Firebase xác định trạng thái đăng nhập lần đầu
  if (!to.meta.public && !authState.authed) return { name: 'login' }
  if (to.name === 'login' && authState.authed) return { name: 'dashboard' }
  return true
})

export default router
