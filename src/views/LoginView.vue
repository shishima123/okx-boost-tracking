<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { NCard, NInput, NButton, NForm, NFormItem, NText, NSpace } from 'naive-ui'
import { login } from '@/composables/auth'
import { toastError, toastSuccess } from '@/composables/feedback'

const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)

async function submit() {
  if (!email.value || !password.value) return
  loading.value = true
  try {
    const res = await login(email.value, password.value)
    if (!res.ok) {
      toastError(res.error)
      return
    }
    toastSuccess('Đăng nhập thành công.')
    router.push({ name: 'dashboard' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-wrap">
    <n-card class="login-card" :bordered="true">
      <div class="brand">
        <span class="logo">⚡</span>
        <div>
          <div class="title">OKX Boost Tracker</div>
          <n-text depth="3">Đăng nhập</n-text>
        </div>
      </div>

      <n-form @submit.prevent="submit">
        <n-form-item label="Email">
          <n-input
            v-model:value="email"
            placeholder="you@example.com"
            :input-props="{ type: 'email', autocomplete: 'username' }"
            @keyup.enter="submit"
          />
        </n-form-item>
        <n-form-item label="Mật khẩu">
          <n-input
            v-model:value="password"
            type="password"
            show-password-on="click"
            placeholder="Mật khẩu"
            :input-props="{ autocomplete: 'current-password' }"
            @keyup.enter="submit"
          />
        </n-form-item>
        <n-button
          type="primary"
          block
          :loading="loading"
          :disabled="!email || !password"
          @click="submit"
        >
          Đăng nhập
        </n-button>
      </n-form>
    </n-card>
  </div>
</template>

<style scoped>
.login-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.login-card {
  width: 100%;
  max-width: 400px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}
.logo {
  font-size: 34px;
}
.title {
  font-size: 18px;
  font-weight: 700;
}
</style>
