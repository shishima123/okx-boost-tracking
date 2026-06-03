<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  NCard,
  NButton,
  NForm,
  NFormItem,
  NInputNumber,
  NSpace,
  NText,
  NAlert,
  NH2,
} from 'naive-ui'
import { useBoostStore } from '@/stores/boost'
import { authState, logout } from '@/composables/auth'
import { getDefaults, setDefaults } from '@/config'
import { toastSuccess } from '@/composables/feedback'

const router = useRouter()
const store = useBoostStore()

const defaults = ref(getDefaults())

const configured = !!import.meta.env.VITE_FIREBASE_PROJECT_ID

async function doLogout() {
  await logout()
  store.unsubscribe()
  router.push({ name: 'login' })
}

function saveDefaults() {
  setDefaults({
    cycleLengthDays: Number(defaults.value.cycleLengthDays) || 10,
    defaultFee: Number(defaults.value.defaultFee) || 0,
  })
  toastSuccess('Đã lưu giá trị mặc định.')
}
</script>

<template>
  <n-h2 style="margin: 0 0 18px">⚙️ Cài đặt</n-h2>

  <n-card title="1. Kết nối" size="small" style="margin-bottom: 16px; max-width: 640px">
    <n-alert v-if="!configured" type="warning" style="margin-bottom: 14px">
      Chưa cấu hình Firebase. Điền các biến <n-text code>VITE_FIREBASE_*</n-text> trong
      <n-text code>.env</n-text> rồi chạy lại <n-text code>npm run dev</n-text>.
    </n-alert>
    <n-space vertical :size="10">
      <n-text depth="3">
        Dữ liệu lưu realtime trên Cloud Firestore (3 collection
        <n-text code>accounts</n-text>, <n-text code>cycles</n-text>,
        <n-text code>rewards</n-text>). Mọi thay đổi tự đồng bộ giữa các thiết bị.
      </n-text>
      <n-text :depth="store.loading ? 3 : 1">
        Trạng thái:
        {{ store.loading ? 'Đang kết nối…' : store.error ? 'Lỗi: ' + store.error : 'Đã kết nối ✓' }}
      </n-text>
    </n-space>
  </n-card>

  <n-card
    title="2. Mặc định khi tạo chu kì"
    size="small"
    style="margin-bottom: 16px; max-width: 640px"
  >
    <n-form>
      <n-space :size="14">
        <n-form-item label="Số ngày / chu kì" style="flex: 1">
          <n-input-number v-model:value="defaults.cycleLengthDays" :min="1" style="width: 100%" />
        </n-form-item>
        <n-form-item label="Phí mặc định ($)" style="flex: 1">
          <n-input-number
            v-model:value="defaults.defaultFee"
            :min="0"
            :step="0.01"
            style="width: 100%"
          />
        </n-form-item>
      </n-space>
    </n-form>
    <n-button type="primary" @click="saveDefaults">Lưu mặc định</n-button>
  </n-card>

  <n-card title="3. Phiên đăng nhập" size="small" style="max-width: 640px">
    <n-space align="center" justify="space-between">
      <n-text depth="3">Đang đăng nhập: {{ authState.email || '—' }}</n-text>
      <n-button type="error" secondary @click="doLogout">Đăng xuất</n-button>
    </n-space>
  </n-card>
</template>
