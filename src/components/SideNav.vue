<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NMenu, NButton, NText } from 'naive-ui'
import { authState, logout } from '@/composables/auth'
import { useBoostStore } from '@/stores/boost'

const emit = defineEmits(['navigate'])
const route = useRoute()
const router = useRouter()
const store = useBoostStore()

const menuOptions = [
  { label: '📊 Tổng quan', key: 'dashboard' },
  { label: '🔄 Chu kì', key: 'cycles' },
  { label: '🎁 Phần thưởng', key: 'rewards' },
  { label: '👤 Tài khoản', key: 'accounts' },
  { label: '⚙️ Cài đặt', key: 'settings' },
]

const activeKey = computed(() => route.name)

function onMenu(key) {
  router.push({ name: key })
  emit('navigate')
}

async function doLogout() {
  await logout()
  store.unsubscribe()
  emit('navigate')
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="sidenav">
    <div class="brand">
      <span class="logo">⚡</span>
      <div>
        <div class="brand-name">OKX Boost</div>
        <div class="brand-sub">Tracker</div>
      </div>
    </div>

    <n-menu :value="activeKey" :options="menuOptions" :indent="18" @update:value="onMenu" />

    <div class="sider-foot">
      <n-text depth="3" class="ellipsis" :title="authState.email">
        {{ authState.email || 'Đã đăng nhập' }}
      </n-text>
      <n-button quaternary size="small" @click="doLogout">Đăng xuất</n-button>
    </div>
  </div>
</template>

<style scoped>
.sidenav {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 18px 14px;
}
.logo {
  font-size: 26px;
}
.brand-name {
  font-weight: 700;
  font-size: 16px;
}
.brand-sub {
  font-size: 11px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.sider-foot {
  margin-top: auto;
  padding: 14px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ellipsis {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
