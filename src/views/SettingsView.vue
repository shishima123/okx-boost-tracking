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
import { toastSuccess, toastError, confirmDialog } from '@/composables/feedback'

const router = useRouter()
const store = useBoostStore()

const defaults = ref(getDefaults())

const migrating = ref(false)
async function migrateRefs() {
  const ok = await confirmDialog({
    title: 'Di trú tham chiếu tài khoản',
    content:
      'Gán accountId cho các chu kì/phần thưởng cũ (đang tham chiếu theo tên) để đổi tên tài khoản tự đồng bộ. Khớp theo tên hiện tại.',
    positiveText: 'Di trú',
    type: 'info',
  })
  if (!ok) return
  migrating.value = true
  try {
    const { updated, unmatched } = await store.migrateAccountRefs()
    if (!updated && !unmatched.length) {
      toastSuccess('Dữ liệu đã ở dạng mới, không cần di trú.')
    } else if (unmatched.length) {
      toastError(
        `Đã gán ${updated} bản ghi. ${unmatched.length} tên không khớp tài khoản nào: ${unmatched.join(', ')}`,
      )
    } else {
      toastSuccess(`Đã gán accountId cho ${updated} bản ghi.`)
    }
  } finally {
    migrating.value = false
  }
}

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
    defaultRebate: Number(defaults.value.defaultRebate) || 0,
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
          <n-input-number
            :show-button="false"
            v-model:value="defaults.cycleLengthDays"
            :min="1"
            :input-props="{ inputmode: 'numeric' }"
            style="width: 100%"
          />
        </n-form-item>
        <n-form-item label="Phí gốc mặc định ($)" style="flex: 1">
          <n-input-number
            :show-button="false"
            v-model:value="defaults.defaultFee"
            :min="0"
            :step="0.01"
            :input-props="{ inputmode: 'decimal' }"
            style="width: 100%"
          />
        </n-form-item>
        <n-form-item label="Hoàn phí mặc định ($)" style="flex: 1">
          <n-input-number
            :show-button="false"
            v-model:value="defaults.defaultRebate"
            :min="0"
            :step="0.01"
            :input-props="{ inputmode: 'decimal' }"
            style="width: 100%"
          />
        </n-form-item>
      </n-space>
    </n-form>
    <n-button type="primary" @click="saveDefaults">Lưu mặc định</n-button>
  </n-card>

  <n-card title="3. Bảo trì dữ liệu" size="small" style="margin-bottom: 16px; max-width: 640px">
    <n-space vertical :size="10">
      <n-text depth="3">
        Chuyển các chu kì/phần thưởng cũ sang tham chiếu tài khoản theo
        <n-text code>accountId</n-text> thay vì theo tên. Sau khi di trú, đổi tên tài khoản sẽ tự
        đồng bộ ở mọi nơi. Chỉ cần chạy một lần.
      </n-text>
      <n-button :loading="migrating" @click="migrateRefs">Di trú tham chiếu tài khoản</n-button>
    </n-space>
  </n-card>

  <n-card title="4. Phiên đăng nhập" size="small" style="max-width: 640px">
    <n-space align="center" justify="space-between">
      <n-text depth="3">Đang đăng nhập: {{ authState.email || '—' }}</n-text>
      <n-button type="error" secondary @click="doLogout">Đăng xuất</n-button>
    </n-space>
  </n-card>
</template>
