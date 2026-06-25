<script setup>
import { computed } from 'vue'
import { useStorage } from '@vueuse/core'
import { NCard, NForm, NFormItem, NInputNumber, NInput, NButton, NSpace, NH2 } from 'naive-ui'
import { fmtUSDT } from '@/utils/format'

// Công cụ 1: tính số tiền còn lại sau phí trade — useStorage tự đồng bộ với localStorage
const form = useStorage('okx_boost_tool_remaining', { initial: null, fee: null })

const finalAmount = computed(() => {
  const a = Number(form.value.initial) || 0
  const f = Number(form.value.fee) || 0
  return a - f
})

// Đưa số tiền cuối cùng lên ô số tiền ban đầu để tính tiếp vòng sau (giữ nguyên phí trade)
function fillFinalToInitial() {
  form.value.initial = finalAmount.value
}
</script>

<template>
  <n-h2 style="margin: 0 0 18px">🧰 Công cụ</n-h2>

  <n-card title="Tính số tiền còn lại" size="small" style="max-width: 460px">
    <n-form :show-feedback="false">
      <n-space vertical :size="14">
        <n-form-item label="Số tiền ban đầu ($)">
          <n-input-number
            :show-button="false"
            v-model:value="form.initial"
            :min="0"
            :step="0.01"
            :input-props="{ inputmode: 'decimal' }"
            placeholder="0.00"
            style="width: 100%"
          />
        </n-form-item>

        <n-form-item label="Phí trade ($)">
          <n-input-number
            :show-button="false"
            v-model:value="form.fee"
            :min="0"
            :step="0.01"
            :input-props="{ inputmode: 'decimal' }"
            placeholder="0.00"
            style="width: 100%"
          />
        </n-form-item>

        <n-form-item label="Số tiền cuối cùng ($)">
          <n-input :value="fmtUSDT(finalAmount)" readonly style="width: 100%" />
        </n-form-item>

        <n-button
          secondary
          type="primary"
          block
          :disabled="!form.initial"
          @click="fillFinalToInitial"
        >
          ↥ Đưa số tiền cuối lên số tiền ban đầu
        </n-button>
      </n-space>
    </n-form>
  </n-card>
</template>
