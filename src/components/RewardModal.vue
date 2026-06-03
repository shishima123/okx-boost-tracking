<script setup>
import { reactive, watch } from 'vue'
import {
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NDatePicker,
  NCheckbox,
  NSpace,
  NButton,
} from 'naive-ui'
import { useBoostStore } from '@/stores/boost'
import { confirmDialog } from '@/composables/feedback'
import { todayISO } from '@/utils/format'

const props = defineProps({
  show: { type: Boolean, default: false },
  mode: { type: String, default: 'add' }, // 'add' | 'edit'
  cycle: { type: Object, default: null }, // dùng khi add (id, account)
  reward: { type: Object, default: null }, // dùng khi edit
})
const emit = defineEmits(['update:show'])

const store = useBoostStore()
const form = reactive({ date: todayISO(), amount: null, token: '', note: '', estimated: false })

const accountLabel = () => (props.mode === 'edit' ? props.reward?.account : props.cycle?.account)

// Nạp dữ liệu mỗi khi mở
watch(
  () => props.show,
  (open) => {
    if (!open) return
    if (props.mode === 'edit' && props.reward) {
      Object.assign(form, {
        date: props.reward.date || todayISO(),
        amount: props.reward.amount ?? null,
        token: props.reward.token || '',
        note: props.reward.note || '',
        estimated: !!props.reward.estimated,
      })
    } else {
      Object.assign(form, { date: todayISO(), amount: null, token: '', note: '', estimated: false })
    }
  },
)

const filled = () => form.amount !== null && form.amount !== ''

async function save() {
  if (!filled()) return
  const ok = await confirmDialog({
    title: props.mode === 'edit' ? 'Lưu thưởng' : 'Thêm thưởng',
    content:
      props.mode === 'edit'
        ? `Lưu thay đổi thưởng của "${accountLabel()}"?`
        : `Thêm thưởng cho "${accountLabel()}"?`,
    positiveText: props.mode === 'edit' ? 'Lưu' : 'Thêm',
    type: 'info',
  })
  if (!ok) return
  if (props.mode === 'edit') {
    await store.updateReward(props.reward.id, {
      cycleId: props.reward.cycleId,
      account: props.reward.account,
      date: form.date,
      amount: Number(form.amount) || 0,
      token: form.token,
      note: form.note,
      estimated: form.estimated,
    })
  } else {
    await store.addReward({
      cycleId: props.cycle.id,
      account: props.cycle.account,
      date: form.date,
      amount: Number(form.amount) || 0,
      token: form.token,
      note: form.note,
      estimated: form.estimated,
    })
  }
  emit('update:show', false)
}
</script>

<template>
  <n-modal
    :show="props.show"
    preset="card"
    :title="`${props.mode === 'edit' ? 'Sửa' : 'Thêm'} thưởng — ${accountLabel()}`"
    style="max-width: 440px"
    @update:show="emit('update:show', $event)"
  >
    <n-form>
      <n-space :size="12">
        <n-form-item label="Ngày nhận" style="flex: 1">
          <n-date-picker
            v-model:formatted-value="form.date"
            value-format="yyyy-MM-dd"
            type="date"
            style="width: 100%"
          />
        </n-form-item>
        <n-form-item label="Số tiền (USDT)" style="flex: 1">
          <n-input-number v-model:value="form.amount" :min="0" :step="0.01" style="width: 100%" />
        </n-form-item>
      </n-space>
      <n-form-item label="Token / Loại thưởng">
        <n-input v-model:value="form.token" placeholder="VD: SLX, IRYS…" />
      </n-form-item>
      <n-form-item label="Ghi chú">
        <n-input v-model:value="form.note" placeholder="Tuỳ chọn" />
      </n-form-item>
      <n-form-item>
        <n-checkbox v-model:checked="form.estimated">
          Thưởng ước lượng (chưa chính thức)
        </n-checkbox>
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="emit('update:show', false)">Huỷ</n-button>
        <n-button type="primary" :loading="store.saving" :disabled="!filled()" @click="save">
          {{ props.mode === 'edit' ? 'Lưu' : 'Thêm thưởng' }}
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>
