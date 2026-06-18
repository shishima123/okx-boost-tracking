<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NMenu } from 'naive-ui'

const emit = defineEmits(['navigate'])
const route = useRoute()
const router = useRouter()

const menuOptions = [
  { label: '📊 Tổng quan', key: 'dashboard' },
  { label: '🔄 Chu kì', key: 'cycles' },
  { label: '🎁 Phần thưởng', key: 'rewards' },
  { label: '📅 Gợi ý ngày trade', key: 'planner' },
  { label: '👤 Tài khoản', key: 'accounts' },
  { label: '⚙️ Cài đặt', key: 'settings' },
]

const activeKey = computed(() => route.name)

function onMenu(key) {
  router.push({ name: key })
  emit('navigate')
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
</style>
