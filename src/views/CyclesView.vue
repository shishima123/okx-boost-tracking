<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useStorage } from '@vueuse/core'
import {
  NCard,
  NTable,
  NButton,
  NTag,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NDatePicker,
  NCheckbox,
  NSpace,
  NEmpty,
  NSpin,
  NH2,
  NText,
  NRadioGroup,
  NRadioButton,
} from 'naive-ui'
import RewardModal from '@/components/RewardModal.vue'
import CycleOverviewPanel from '@/components/CycleOverviewPanel.vue'
import AccountBadge from '@/components/AccountBadge.vue'
import { useBoostStore } from '@/stores/boost'
import { confirmDialog } from '@/composables/feedback'
import { getDefaults } from '@/config'
import {
  fmtUSDT,
  fmtPct,
  fmtDate,
  signClass,
  cycleStatus,
  todayISO,
  addDays,
  clsColor,
  tagType,
} from '@/utils/format'

const store = useBoostStore()
const defaults = getDefaults()

// Lưu chế độ xem đã chọn vào localStorage ('list' | 'by-cycle')
const viewMode = useStorage('okx-boost:cycles-view', 'list')

const statusFilter = ref('all')
const statusOptions = [
  { label: 'Tất cả trạng thái', value: 'all' },
  { label: 'Đang hoạt động', value: 'active' },
  { label: 'Đã kết thúc', value: 'ended' },
]

// Mặc định ẩn chu kì đã hết hạn; checkbox để hiện lại (lưu localStorage)
const showExpired = useStorage('okx-boost:cycles-show-expired', false)

const rows = computed(() => {
  const names = store.accountNames
  return store.cyclesEnriched
    .map((c) => ({ ...c, status: cycleStatus(c.endDate) }))
    .filter((c) => {
      if (statusFilter.value !== 'all' && c.status.state !== statusFilter.value) return false
      // ẩn chu kì hết hạn trừ khi bật "Hiện đã hết hạn" hoặc đang lọc riêng nhóm hết hạn
      if (c.status.state === 'ended' && !showExpired.value && statusFilter.value !== 'ended')
        return false
      return true
    })
    .sort(
      (a, b) =>
        (b.startDate || '').localeCompare(a.startDate || '') ||
        names.indexOf(a.account) - names.indexOf(b.account),
    )
})

const accountOptions = computed(() => store.accountNames.map((n) => ({ label: n, value: n })))

// ----- Tạo / sửa chu kì -----
const showCycle = ref(false)
const editingId = ref(null)
const form = reactive({
  account: '', // dùng khi sửa (1 tài khoản)
  accounts: [], // dùng khi tạo mới (nhiều tài khoản)
  startDate: todayISO(),
  lengthDays: defaults.cycleLengthDays,
  fee: defaults.defaultFee,
  note: '',
})

const endPreview = computed(() => addDays(form.startDate, form.lengthDays))

// Điều kiện cho phép Lưu tuỳ theo chế độ tạo / sửa
const canSave = computed(() => (editingId.value ? !!form.account : form.accounts.length > 0))

function openCreate() {
  editingId.value = null
  Object.assign(form, {
    account: '',
    accounts: [],
    startDate: todayISO(),
    lengthDays: defaults.cycleLengthDays,
    fee: defaults.defaultFee,
    note: '',
  })
  showCycle.value = true
}

function openEdit(c) {
  editingId.value = c.id
  const len =
    c.startDate && c.endDate
      ? Math.round((new Date(c.endDate) - new Date(c.startDate)) / 86400000)
      : defaults.cycleLengthDays
  Object.assign(form, {
    account: c.account,
    accounts: [],
    startDate: c.startDate || todayISO(),
    lengthDays: len,
    fee: c.fee,
    note: c.note || '',
  })
  showCycle.value = true
}

function selectAllAccounts() {
  form.accounts = [...store.accountNames]
}

async function saveCycle() {
  if (!canSave.value) return
  const ok = await confirmDialog({
    title: editingId.value ? 'Lưu chu kì' : 'Tạo chu kì',
    content: editingId.value
      ? `Lưu thay đổi chu kì của "${form.account}"?`
      : `Tạo ${form.accounts.length} chu kì mới?`,
    positiveText: editingId.value ? 'Lưu' : 'Tạo',
    type: 'info',
  })
  if (!ok) return
  const base = {
    startDate: form.startDate,
    endDate: addDays(form.startDate, form.lengthDays),
    fee: Number(form.fee) || 0,
    note: form.note,
  }
  if (editingId.value) {
    await store.updateCycle(editingId.value, { account: form.account, ...base })
  } else {
    const items = form.accounts.map((account) => ({ account, ...base }))
    await store.addCyclesBulk(items)
  }
  showCycle.value = false
}

async function removeCycle(c) {
  const n = store.rewards.filter((r) => r.cycleId === c.id).length
  const ok = await confirmDialog({
    title: 'Xoá chu kì',
    content: n
      ? `Xoá chu kì của "${c.account}"? (${n} phần thưởng liên kết sẽ KHÔNG bị xoá tự động)`
      : `Xoá chu kì của "${c.account}"?`,
    positiveText: 'Xoá',
  })
  if (ok) await store.deleteCycle(c.id)
}

// ----- Thêm / sửa phần thưởng (qua component dùng chung) -----
const rewardShow = ref(false)
const rewardMode = ref('add')
const rewardCycle = ref(null)
const rewardEdit = ref(null)

function openReward(c) {
  rewardMode.value = 'add'
  rewardCycle.value = c
  rewardEdit.value = null
  rewardShow.value = true
}
function openEditReward(r) {
  rewardMode.value = 'edit'
  rewardEdit.value = r
  rewardShow.value = true
}

async function removeReward(r) {
  const ok = await confirmDialog({
    title: 'Xoá phần thưởng',
    content: 'Xoá phần thưởng này?',
    positiveText: 'Xoá',
  })
  if (ok) await store.deleteReward(r.id)
}

// ----- Nhập thưởng nhanh (nhiều ví cùng 1 chu kì) -----
const showBatch = ref(false)
const batchStart = ref(null)
const bForm = reactive({ date: todayISO(), token: '', note: '', estimated: false })
const bulkFill = ref(null)
const batchAmounts = reactive({}) // cycleId -> số tiền

// Thứ tự ưu tiên theo danh sách tài khoản (đã sắp xếp)
const accountIndex = computed(() => {
  const m = {}
  store.accountNames.forEach((n, i) => (m[n] = i))
  return m
})

// Chỉ xét chu kì còn hoạt động (chưa kết thúc) cho phần nhập nhanh
const activeCycles = computed(() =>
  store.cyclesEnriched.filter((c) => cycleStatus(c.endDate).state === 'active'),
)

// Các ngày bắt đầu khác nhau (mỗi “đợt” = 1 chu kì cho nhiều ví) — chỉ đợt đang chạy
const startDateOptions = computed(() => {
  const counts = {}
  for (const c of activeCycles.value) counts[c.startDate] = (counts[c.startDate] || 0) + 1
  return Object.keys(counts)
    .sort((a, b) => b.localeCompare(a))
    .map((d) => ({ label: `${fmtDate(d)} — ${counts[d]} ví`, value: d }))
})

// Các chu kì thuộc ngày bắt đầu đã chọn
const batchRows = computed(() =>
  activeCycles.value
    .filter((c) => c.startDate === batchStart.value)
    .sort(
      (a, b) => (accountIndex.value[a.account] ?? 999) - (accountIndex.value[b.account] ?? 999),
    ),
)

const batchFilledCount = computed(
  () => batchRows.value.filter((c) => isFilled(batchAmounts[c.id])).length,
)

function isFilled(v) {
  return v !== null && v !== undefined && v !== ''
}

function openBatch() {
  batchStart.value = startDateOptions.value[0]?.value || null
  Object.assign(bForm, { date: todayISO(), token: '', note: '', estimated: false })
  bulkFill.value = null
  showBatch.value = true
}

function applyFill() {
  for (const c of batchRows.value) batchAmounts[c.id] = bulkFill.value
}

// Khi đổi chu kì, xoá các ô nhập cũ
watch(batchStart, () => {
  for (const k of Object.keys(batchAmounts)) delete batchAmounts[k]
})

async function saveBatch() {
  const items = batchRows.value
    .filter((c) => isFilled(batchAmounts[c.id]))
    .map((c) => ({
      cycleId: c.id,
      account: c.account,
      date: bForm.date,
      amount: Number(batchAmounts[c.id]) || 0,
      token: bForm.token,
      note: bForm.note,
      estimated: bForm.estimated,
    }))
  if (!items.length) return
  const ok = await confirmDialog({
    title: 'Nhập thưởng nhanh',
    content: `Thêm ${items.length} phần thưởng cho đợt này?`,
    positiveText: 'Thêm',
    type: 'info',
  })
  if (!ok) return
  await store.addRewardsBulk(items)
  showBatch.value = false
}

// ----- Mở rộng xem thưởng (cho phép mở nhiều dòng) -----
const expanded = ref([])
const isExpanded = (id) => expanded.value.includes(id)
function toggle(id) {
  expanded.value = isExpanded(id) ? expanded.value.filter((x) => x !== id) : [...expanded.value, id]
}
const collapseAll = () => (expanded.value = [])
const rewardsOf = (id) => store.rewards.filter((r) => r.cycleId === id)
</script>

<template>
  <n-space justify="space-between" align="center" style="margin-bottom: 18px" :wrap="true">
    <n-space :size="14" align="center">
      <n-h2 style="margin: 0">🔄 Quản lý chu kì</n-h2>
      <n-radio-group v-model:value="viewMode" size="small">
        <n-radio-button value="list">Danh sách</n-radio-button>
        <n-radio-button value="by-cycle">Theo chu kì</n-radio-button>
      </n-radio-group>
    </n-space>
    <n-space :size="10" align="center">
      <!-- Chỉ liên quan chế độ Danh sách -->
      <template v-if="viewMode === 'list'">
        <n-checkbox v-model:checked="showExpired">Hiện đã hết hạn</n-checkbox>
        <n-select
          v-model:value="statusFilter"
          :options="statusOptions"
          size="small"
          style="width: 168px"
        />
      </template>
      <!-- Luôn hiện ở cả 2 chế độ -->
      <n-button secondary :disabled="!startDateOptions.length" @click="openBatch">
        ⚡ Nhập thưởng nhanh
      </n-button>
      <n-button type="primary" :disabled="!store.accountNames.length" @click="openCreate">
        + Tạo chu kì
      </n-button>
    </n-space>
  </n-space>

  <!-- Chế độ Theo chu kì -->
  <CycleOverviewPanel v-if="viewMode === 'by-cycle'" />

  <!-- Chế độ Danh sách -->
  <template v-else>
    <n-card v-if="!store.accountNames.length" size="small">
      <n-empty description="Chưa có tài khoản nào.">
        <template #extra>
          <n-button size="small" @click="$router.push({ name: 'accounts' })">
            Thêm tài khoản
          </n-button>
        </template>
      </n-empty>
    </n-card>

    <n-card v-else size="small">
      <div v-if="expanded.length" class="table-toolbar">
        <n-button quaternary size="small" @click="collapseAll">Đóng tất cả</n-button>
      </div>
      <n-spin :show="store.loading">
        <div class="table-wrap">
          <n-table v-if="rows.length" :bordered="false" :single-line="false" striped size="small">
            <thead>
              <tr>
                <th>Tài khoản</th>
                <th>Bắt đầu</th>
                <th>Kết thúc</th>
                <th class="right">Phí</th>
                <th class="right">Thưởng</th>
                <th class="right">Lợi nhuận</th>
                <th class="right">ROI</th>
                <th>Trạng thái</th>
                <th>Còn lại (ngày)</th>
                <th class="right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="c in rows" :key="c.id">
                <tr>
                  <td>
                    <n-button text size="tiny" @click="toggle(c.id)">
                      {{ isExpanded(c.id) ? '▾' : '▸' }}
                    </n-button>
                    <AccountBadge :name="c.account" />
                    <n-tag v-if="c.rewardCount" size="tiny" :bordered="false" type="success">
                      {{ c.rewardCount }} thưởng
                    </n-tag>
                  </td>
                  <td>{{ fmtDate(c.startDate) }}</td>
                  <td>{{ fmtDate(c.endDate) }}</td>
                  <td class="right">{{ fmtUSDT(c.fee) }}</td>
                  <td class="right">{{ fmtUSDT(c.reward) }}</td>
                  <td class="right" :style="{ color: clsColor(signClass(c.profit)) }">
                    {{ fmtUSDT(c.profit) }}
                  </td>
                  <td class="right" :style="{ color: clsColor(signClass(c.profit)) }">
                    {{ fmtPct(c.roi) }}
                  </td>
                  <td>
                    <n-tag size="small" round :bordered="false" :type="tagType(c.status.cls)">
                      {{ c.status.label }}
                    </n-tag>
                  </td>
                  <td class="nowrap bold" :style="{ color: clsColor(c.status.leftCls) }">
                    {{ c.status.left === null ? '—' : c.status.left }}
                  </td>
                  <td class="right nowrap">
                    <n-space :size="6" justify="end" :wrap="false">
                      <n-button size="tiny" secondary @click="openReward(c)">+ Thưởng</n-button>
                      <n-button size="tiny" quaternary @click="openEdit(c)">Sửa</n-button>
                      <n-button size="tiny" quaternary type="error" @click="removeCycle(c)"
                        >Xoá</n-button
                      >
                    </n-space>
                  </td>
                </tr>
                <tr v-if="isExpanded(c.id)">
                  <td colspan="10" class="sub-cell">
                    <div v-if="rewardsOf(c.id).length" class="sub">
                      <div v-for="r in rewardsOf(c.id)" :key="r.id" class="sub-item">
                        <span>{{ fmtDate(r.date) }}</span>
                        <span class="green">+{{ fmtUSDT(r.amount) }} USDT</span>
                        <n-tag v-if="r.token" size="tiny" :bordered="false">{{ r.token }}</n-tag>
                        <n-tag v-if="r.estimated" size="tiny" :bordered="false" type="warning">
                          ước lượng
                        </n-tag>
                        <span class="muted flex1">{{ r.note }}</span>
                        <n-button size="tiny" quaternary @click="openEditReward(r)">Sửa</n-button>
                        <n-button size="tiny" quaternary type="error" @click="removeReward(r)">
                          Xoá
                        </n-button>
                      </div>
                    </div>
                    <n-text v-else depth="3">Chưa có phần thưởng nào cho chu kì này.</n-text>
                  </td>
                </tr>
              </template>
            </tbody>
          </n-table>
          <n-empty
            v-else
            :description="
              store.cyclesEnriched.length
                ? 'Không có chu kì phù hợp. Thử bật “Hiện đã hết hạn” hoặc đổi bộ lọc.'
                : 'Chưa có chu kì nào. Bấm “Tạo chu kì” để bắt đầu.'
            "
          />
        </div>
      </n-spin>
    </n-card>
  </template>

  <!-- Modal tạo/sửa chu kì -->
  <n-modal
    v-model:show="showCycle"
    preset="card"
    :title="editingId ? 'Sửa chu kì' : 'Tạo chu kì mới'"
    style="max-width: 460px"
  >
    <n-form>
      <!-- Sửa: 1 tài khoản -->
      <n-form-item v-if="editingId" label="Tài khoản">
        <n-select v-model:value="form.account" :options="accountOptions" />
      </n-form-item>
      <!-- Tạo mới: chọn nhiều tài khoản cùng lúc -->
      <n-form-item v-else>
        <template #label>
          <span class="label-row">
            Tài khoản ({{ form.accounts.length }} đã chọn)
            <n-button text size="tiny" type="primary" @click="selectAllAccounts">
              Chọn tất cả
            </n-button>
          </span>
        </template>
        <n-select
          v-model:value="form.accounts"
          :options="accountOptions"
          multiple
          filterable
          clearable
          max-tag-count="responsive"
          placeholder="Chọn 1 hoặc nhiều tài khoản"
        />
      </n-form-item>
      <n-space :size="12">
        <n-form-item label="Ngày bắt đầu" style="flex: 1">
          <n-date-picker
            v-model:formatted-value="form.startDate"
            value-format="yyyy-MM-dd"
            type="date"
            style="width: 100%"
          />
        </n-form-item>
        <n-form-item label="Số ngày / chu kì" style="flex: 1">
          <n-input-number v-model:value="form.lengthDays" :min="1" style="width: 100%" />
        </n-form-item>
      </n-space>
      <n-space :size="12">
        <n-form-item label="Phí (USDT)" style="flex: 1">
          <n-input-number v-model:value="form.fee" :min="0" :step="0.01" style="width: 100%" />
        </n-form-item>
        <n-form-item label="Ngày kết thúc (tự tính)" style="flex: 1">
          <n-input :value="fmtDate(endPreview)" disabled />
        </n-form-item>
      </n-space>
      <n-form-item label="Ghi chú">
        <n-input v-model:value="form.note" placeholder="Tuỳ chọn" />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="showCycle = false">Huỷ</n-button>
        <n-button type="primary" :loading="store.saving" :disabled="!canSave" @click="saveCycle">
          {{ editingId ? 'Lưu' : `Tạo ${form.accounts.length || ''} chu kì` }}
        </n-button>
      </n-space>
    </template>
  </n-modal>

  <!-- Modal thêm / sửa thưởng (component dùng chung) -->
  <RewardModal
    v-model:show="rewardShow"
    :mode="rewardMode"
    :cycle="rewardCycle"
    :reward="rewardEdit"
  />

  <!-- Modal nhập thưởng nhanh cho cả chu kì -->
  <n-modal
    v-model:show="showBatch"
    preset="card"
    title="⚡ Nhập thưởng nhanh theo chu kì"
    style="max-width: 540px"
  >
    <n-form>
      <n-form-item label="Chọn chu kì (theo ngày bắt đầu)">
        <n-select
          v-model:value="batchStart"
          :options="startDateOptions"
          placeholder="Chọn đợt chu kì"
        />
      </n-form-item>
      <n-space :size="12">
        <n-form-item label="Ngày nhận" style="flex: 1">
          <n-date-picker
            v-model:formatted-value="bForm.date"
            value-format="yyyy-MM-dd"
            type="date"
            style="width: 100%"
          />
        </n-form-item>
        <n-form-item label="Token / Loại thưởng" style="flex: 1">
          <n-input v-model:value="bForm.token" placeholder="VD: SLX, IRYS…" />
        </n-form-item>
      </n-space>

      <n-form-item label="Điền nhanh số tiền cho tất cả ví">
        <n-space :size="8" :wrap="false" style="width: 100%">
          <n-input-number
            v-model:value="bulkFill"
            :min="0"
            :step="0.01"
            placeholder="0.00"
            style="flex: 1"
          />
          <n-button :disabled="!batchRows.length" @click="applyFill">Áp dụng</n-button>
        </n-space>
      </n-form-item>

      <div v-if="batchRows.length" class="batch-list">
        <div class="batch-head muted">
          <span>Tài khoản</span>
          <span>Số tiền (USDT)</span>
        </div>
        <div v-for="c in batchRows" :key="c.id" class="batch-row">
          <span class="batch-acc">
            <AccountBadge :name="c.account" />
            <span v-if="c.reward" class="muted small">(đã có {{ fmtUSDT(c.reward) }})</span>
          </span>
          <n-input-number
            v-model:value="batchAmounts[c.id]"
            :min="0"
            :step="0.01"
            placeholder="0.00"
            style="width: 150px"
          />
        </div>
      </div>
      <n-empty v-else size="small" description="Chọn một đợt chu kì để nhập." />

      <n-form-item label="Ghi chú" style="margin-top: 12px">
        <n-input v-model:value="bForm.note" placeholder="Tuỳ chọn (áp dụng cho tất cả)" />
      </n-form-item>
      <n-form-item>
        <n-checkbox v-model:checked="bForm.estimated">
          Đánh dấu tất cả là thưởng ước lượng (chưa chính thức)
        </n-checkbox>
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="showBatch = false">Huỷ</n-button>
        <n-button
          type="primary"
          :loading="store.saving"
          :disabled="!batchFilledCount"
          @click="saveBatch"
        >
          Lưu {{ batchFilledCount || '' }} thưởng
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<style scoped>
.table-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}
.sub-cell {
  background: var(--bg-soft);
}
.sub {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sub-item {
  display: flex;
  align-items: center;
  gap: 12px;
}
.flex1 {
  flex: 1;
}
.batch-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
  padding: 4px 2px;
}
.batch-head,
.batch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.batch-head {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding-bottom: 2px;
  border-bottom: 1px solid var(--border);
}
.batch-acc {
  flex: 1;
}
.small {
  font-size: 11px;
}
.label-row {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
</style>
