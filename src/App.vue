<script setup>
import { computed, ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { NConfigProvider, NDrawer, NDrawerContent, NButton, lightTheme } from 'naive-ui'
import { useMediaQuery } from '@vueuse/core'
import SideNav from '@/components/SideNav.vue'
import { authState } from '@/composables/auth'
import { useBoostStore } from '@/stores/boost'

const route = useRoute()
const store = useBoostStore()

const isMobile = useMediaQuery('(max-width: 768px)')
const drawer = ref(false)

const themeOverrides = {
  common: {
    primaryColor: '#3b74ff',
    primaryColorHover: '#5a8bff',
    primaryColorPressed: '#2a5fe0',
    borderRadius: '8px',
    bodyColor: '#e8ebf0',
    cardColor: '#f4f6f9',
    modalColor: '#f4f6f9',
    popoverColor: '#fbfcfd',
    borderColor: '#cdd5de',
    tableColor: '#f4f6f9',
    tableHeaderColor: '#eaeef3',
    inputColor: '#ffffff',
    textColorBase: '#2c343d',
  },
}

const isLogin = computed(() => route.meta.public)

// Bật/tắt realtime theo trạng thái đăng nhập
watch(
  () => authState.authed,
  (authed) => {
    if (authed) store.subscribe()
    else store.unsubscribe()
  },
  { immediate: true },
)
</script>

<template>
  <n-config-provider :theme="lightTheme" :theme-overrides="themeOverrides">
    <!-- Màn đăng nhập -->
    <RouterView v-if="isLogin" />

    <!-- App chính -->
    <div v-else class="app-shell">
      <!-- Sidebar cố định trên PC -->
      <aside v-if="!isMobile" class="sidebar">
        <SideNav />
      </aside>

      <div class="main-col">
        <!-- Thanh trên + hamburger cho mobile -->
        <header v-if="isMobile" class="topbar">
          <n-button quaternary class="hamburger" @click="drawer = true">☰</n-button>
          <span class="topbar-brand">⚡ OKX Boost</span>
        </header>

        <main class="content-area">
          <RouterView />
        </main>
      </div>
    </div>

    <!-- Drawer menu cho mobile -->
    <n-drawer v-model:show="drawer" :width="248" placement="left">
      <n-drawer-content body-content-style="padding:0" :native-scrollbar="false">
        <SideNav @navigate="drawer = false" />
      </n-drawer-content>
    </n-drawer>
  </n-config-provider>
</template>

<style scoped>
.app-shell {
  display: flex;
  min-height: 100vh;
}
.sidebar {
  width: 232px;
  flex-shrink: 0;
  height: 100vh;
  position: sticky;
  top: 0;
  background: var(--bg-soft);
  border-right: 1px solid var(--border);
}
.main-col {
  flex: 1;
  min-width: 0; /* cho phép bảng co lại / cuộn ngang */
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.topbar {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 54px;
  padding: 0 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-soft);
  position: sticky;
  top: 0;
  z-index: 10;
}
.hamburger {
  font-size: 20px;
  padding: 4px 10px;
}
.topbar-brand {
  font-weight: 700;
  font-size: 15px;
}
.content-area {
  flex: 1;
  padding: 24px 30px;
  max-width: 1240px;
  width: 100%;
  margin: 0 auto;
}
@media (max-width: 768px) {
  .content-area {
    padding: 16px;
  }
}
</style>
