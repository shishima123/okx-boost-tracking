<script setup>
import { computed, h, reactive, ref, watch } from 'vue'
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
  NPagination,
} from 'naive-ui'
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
  tagColorFromHex,
  accountStatusInfo,
} from '@/utils/format'

const store = useBoostStore()
const defaults = getDefaults()

const statusFilter = ref('all')
const statusOptions = [
  { label: 'Tất cả trạng thái', value: 'all' },
  { label: 'Đang hoạt động', value: 'active' },
  { label: 'Đã kết thúc', value: 'ended' },
]

// ----- Danh sách chu kì (gom theo đợt = ngày bắt đầu) -----
const batchList = computed(() =>
  [...store.batches]
    .map((b) => ({ ...b, status: cycleStatus(b.endDate) }))
    .filter((b) => statusFilter.value === 'all' || b.status.state === statusFilter.value)
    .sort((a, b) => (b.startDate || '').localeCompare(a.startDate || '')),
)

// ----- Phân trang -----
const page = ref(1)
const pageSize = ref(10)
const pageSizeOptions = [10, 20, 50, 100]
const pagedBatches = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return batchList.value.slice(start, start + pageSize.value)
})
// Quay về trang 1 khi đổi bộ lọc / số dòng / số đợt
watch([statusFilter, pageSize, () => batchList.value.length], () => {
  page.value = 1
})

// ----- Modal chi tiết chu kì -----
const showDetail = ref(false)
const detailDate = ref(null)
function openDetail(b) {
  detailDate.value = b.startDate
  showDetail.value = true
}

const accountOptions = computed(() => store.accountNames.map((n) => ({ label: n, value: n })))

// Lọc tài khoản khi TẠO chu kì: luôn loại ví "bị hạn chế"; tuỳ chọn chỉ hiện ví "đang chạy".
const onlyActive = ref(true)
const createAccountOptions = computed(() =>
  store.accounts
    .map((a) => ({ name: a.name, status: accountStatusInfo(a.status).value }))
    .filter((a) => a.status !== 'restricted')
    .filter((a) => !onlyActive.value || a.status === 'active')
    .map((a) => ({ label: a.name, value: a.name, status: a.status })),
)
// Số ví bị ẩn (hạn chế, hoặc đang nghỉ khi bật "chỉ ví đang chạy") — để báo cho người dùng.
const hiddenAccountCount = computed(
  () => store.accountNames.length - createAccountOptions.value.length,
)

// Hiển thị tên tài khoản theo màu badge trong dropdown / chip đã chọn
const renderAccountLabel = (option) => h(AccountBadge, { name: option.value, size: 'small' })
// Như trên nhưng kèm tag trạng thái (dùng cho dropdown tạo chu kì)
const renderCreateLabel = (option) =>
  h('span', { style: 'display:inline-flex;align-items:center;gap:8px' }, [
    h(AccountBadge, { name: option.value, size: 'small' }),
    option.status && option.status !== 'active'
      ? h(
          NTag,
          { size: 'tiny', bordered: false, type: accountStatusInfo(option.status).tag },
          { default: () => accountStatusInfo(option.status).label },
        )
      : null,
  ])
const renderAccountTag = ({ option, handleClose }) =>
  h(
    NTag,
    {
      size: 'small',
      round: true,
      bordered: false,
      closable: true,
      color: tagColorFromHex(store.accountColorMap[option.value]),
      onClose: (e) => {
        e.stopPropagation()
        handleClose()
      },
    },
    { default: () => option.value },
  )

// ----- Tạo chu kì -----
const showCycle = ref(false)
const form = reactive({
  accounts: [], // nhiều tài khoản cùng lúc
  startDate: todayISO(),
  lengthDays: defaults.cycleLengthDays,
  fee: defaults.defaultFee,
  note: '',
})

const endPreview = computed(() => addDays(form.startDate, form.lengthDays))
const canSave = computed(() => form.accounts.length > 0)

function openCreate() {
  Object.assign(form, {
    accounts: [],
    startDate: todayISO(),
    lengthDays: defaults.cycleLengthDays,
    fee: defaults.defaultFee,
    note: '',
  })
  showCycle.value = true
}

function selectAllAccounts() {
  form.accounts = createAccountOptions.value.map((o) => o.value)
}

async function saveCycle() {
  if (!canSave.value) return
  const ok = await confirmDialog({
    title: 'Tạo chu kì',
    content: `Tạo ${form.accounts.length} chu kì mới?`,
    positiveText: 'Tạo',
    type: 'info',
  })
  if (!ok) return
  const base = {
    startDate: form.startDate,
    endDate: addDays(form.startDate, form.lengthDays),
    fee: Number(form.fee) || 0,
    note: form.note,
  }
  const items = form.accounts.map((account) => ({ account, ...base }))
  await store.addCyclesBulk(items)
  showCycle.value = false
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
</script>

<template>
  <n-space justify="space-between" align="center" style="margin-bottom: 18px" :wrap="true">
    <n-h2 style="margin: 0">🔄 Quản lý chu kì</n-h2>
    <n-space :size="10" align="center">
      <n-select
        v-model:value="statusFilter"
        :options="statusOptions"
        size="small"
        style="width: 168px"
      />
      <n-button secondary :disabled="!startDateOptions.length" @click="openBatch">
        ⚡ Nhập thưởng nhanh
      </n-button>
      <n-button type="primary" :disabled="!store.accountNames.length" @click="openCreate">
        + Tạo chu kì
      </n-button>
    </n-space>
  </n-space>

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
    <n-spin :show="store.loading">
      <div class="table-wrap">
        <n-table
          v-if="batchList.length"
          :bordered="false"
          :single-line="false"
          striped
          size="small"
        >
          <thead>
            <tr>
              <th>Chu kì</th>
              <th class="right">Số ví</th>
              <th class="right">Phí</th>
              <th class="right">Thưởng</th>
              <th class="right">Lợi nhuận</th>
              <th class="right">ROI</th>
              <th>Trạng thái</th>
              <th class="right">Còn lại (ngày)</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="b in pagedBatches"
              :key="b.startDate"
              class="row-click"
              @click="openDetail(b)"
            >
              <td class="nowrap bold">{{ fmtDate(b.startDate) }} – {{ fmtDate(b.endDate) }}</td>
              <td class="right">{{ b.count }}</td>
              <td class="right">{{ fmtUSDT(b.fee) }}</td>
              <td class="right">{{ fmtUSDT(b.reward) }}</td>
              <td class="right" :style="{ color: clsColor(signClass(b.profit)) }">
                {{ fmtUSDT(b.profit) }}
              </td>
              <td class="right" :style="{ color: clsColor(signClass(b.profit)) }">
                {{ fmtPct(b.roi) }}
              </td>
              <td>
                <n-tag size="small" round :bordered="false" :type="tagType(b.status.cls)">
                  {{ b.status.label }}
                </n-tag>
              </td>
              <td class="nowrap bold" :style="{ color: clsColor(b.status.leftCls) }">
                {{ b.status.left === null || b.status.state === 'ended' ? '—' : b.status.left }}
              </td>
            </tr>
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
      <div
        v-if="batchList.length > pageSizeOptions[0]"
        style="display: flex; justify-content: flex-end; margin-top: 14px"
      >
        <n-pagination
          v-model:page="page"
          v-model:page-size="pageSize"
          :item-count="batchList.length"
          :page-sizes="pageSizeOptions"
          show-size-picker
          size="small"
        />
      </div>
    </n-spin>
  </n-card>

  <!-- Modal chi tiết chu kì -->
  <n-modal
    v-model:show="showDetail"
    preset="card"
    class="detail-modal"
    :title="`Chu kì ${detailDate ? fmtDate(detailDate) : ''}`"
    style="width: 92%; max-width: 1000px"
  >
    <CycleOverviewPanel :start-date="detailDate" />
  </n-modal>

  <!-- Modal tạo chu kì -->
  <n-modal v-model:show="showCycle" preset="card" title="Tạo chu kì mới" style="max-width: 460px">
    <n-form :show-feedback="false" class="tight-form">
      <!-- Chọn nhiều tài khoản cùng lúc -->
      <n-form-item :show-feedback="!!hiddenAccountCount">
        <template #label>
          <span class="label-row">
            Tài khoản ({{ form.accounts.length }} đã chọn)
            <n-checkbox v-model:checked="onlyActive" style="font-weight: 400">
              Chỉ ví đang chạy
            </n-checkbox>
            <n-button text size="tiny" type="primary" @click="selectAllAccounts">
              Chọn tất cả
            </n-button>
          </span>
        </template>
        <n-select
          v-model:value="form.accounts"
          :options="createAccountOptions"
          :render-label="renderCreateLabel"
          :render-tag="renderAccountTag"
          multiple
          filterable
          clearable
          max-tag-count="responsive"
          placeholder="Chọn 1 hoặc nhiều tài khoản"
        />
        <template v-if="hiddenAccountCount" #feedback>
          <n-text depth="3" style="font-size: 12px">
            Đang ẩn {{ hiddenAccountCount }} ví (nghỉ / bị hạn chế). Bỏ chọn “Chỉ ví đang chạy” để
            hiện ví đang nghỉ.
          </n-text>
        </template>
      </n-form-item>
      <div class="form-row">
        <n-form-item label="Ngày bắt đầu">
          <n-date-picker
            v-model:formatted-value="form.startDate"
            value-format="yyyy-MM-dd"
            type="date"
            style="width: 100%"
          />
        </n-form-item>
        <n-form-item label="Số ngày / chu kì">
          <n-input-number
            v-model:value="form.lengthDays"
            :min="1"
            :input-props="{ inputmode: 'numeric' }"
            style="width: 100%"
          />
        </n-form-item>
      </div>
      <div class="form-row">
        <n-form-item label="Phí ($)">
          <n-input-number
            v-model:value="form.fee"
            :min="0"
            :step="0.01"
            :input-props="{ inputmode: 'decimal' }"
            style="width: 100%"
          />
        </n-form-item>
        <n-form-item label="Ngày kết thúc (tự tính)">
          <n-input :value="fmtDate(endPreview)" disabled />
        </n-form-item>
      </div>
      <n-form-item label="Ghi chú">
        <n-input v-model:value="form.note" placeholder="Tuỳ chọn" />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="showCycle = false">Huỷ</n-button>
        <n-button type="primary" :loading="store.saving" :disabled="!canSave" @click="saveCycle">
          Tạo {{ form.accounts.length || '' }} chu kì
        </n-button>
      </n-space>
    </template>
  </n-modal>

  <!-- Modal nhập thưởng nhanh cho cả chu kì -->
  <n-modal
    v-model:show="showBatch"
    preset="card"
    title="⚡ Nhập thưởng nhanh theo chu kì"
    style="max-width: 540px"
  >
    <n-form :show-feedback="false" class="tight-form">
      <n-form-item label="Chọn chu kì (theo ngày bắt đầu)">
        <n-select
          v-model:value="batchStart"
          :options="startDateOptions"
          placeholder="Chọn đợt chu kì"
        />
      </n-form-item>
      <div class="form-row">
        <n-form-item label="Ngày nhận">
          <n-date-picker
            v-model:formatted-value="bForm.date"
            value-format="yyyy-MM-dd"
            type="date"
            style="width: 100%"
          />
        </n-form-item>
        <n-form-item label="Token / Loại thưởng">
          <n-input v-model:value="bForm.token" placeholder="VD: SLX, IRYS…" />
        </n-form-item>
      </div>

      <div v-if="batchRows.length" class="batch-section">
        <div class="batch-fill">
          <span class="muted small">Điền nhanh cho tất cả ví</span>
          <div class="batch-fill-input">
            <n-input-number
              v-model:value="bulkFill"
              :min="0"
              :step="0.01"
              :input-props="{ inputmode: 'decimal' }"
              placeholder="0.00"
              size="small"
              style="flex: 1"
            />
            <n-button size="small" :disabled="!batchRows.length" @click="applyFill">
              Áp dụng
            </n-button>
          </div>
        </div>
        <div class="batch-list">
          <div class="batch-head muted">
            <span>Tài khoản</span>
            <span>Số tiền ($)</span>
          </div>
          <div v-for="c in batchRows" :key="c.id" class="batch-row">
            <span class="batch-acc">
              <AccountBadge :name="c.account" />
            </span>
            <n-input-number
              v-model:value="batchAmounts[c.id]"
              :min="0"
              :step="0.01"
              :input-props="{ inputmode: 'decimal' }"
              placeholder="0.00"
              size="small"
              style="width: 150px"
            />
          </div>
        </div>
      </div>
      <n-empty v-else size="small" description="Chọn một đợt chu kì để nhập." />

      <n-form-item label="Ghi chú" style="margin-top: 14px">
        <n-input v-model:value="bForm.note" placeholder="Tuỳ chọn (áp dụng cho tất cả)" />
      </n-form-item>
      <n-checkbox v-model:checked="bForm.estimated" style="margin-top: 12px">
        Đánh dấu tất cả là thưởng ước lượng (chưa chính thức)
      </n-checkbox>
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
.row-click {
  cursor: pointer;
}
.row-click:hover td {
  background: var(--bg-soft);
}
.batch-section {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  background: var(--bg-soft);
}
.batch-fill {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
.batch-fill-input {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 230px;
}
.batch-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
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

/* Modal (tạo chu kì / nhập thưởng nhanh): tắt feedback nhưng vẫn chừa khoảng cách giữa các ô */
.tight-form :deep(.n-form-item) {
  margin-bottom: 14px;
}

/* Hai ô trên cùng một hàng, chia 50%-50% */
.form-row {
  display: flex;
  gap: 12px;
}
.form-row > :deep(.n-form-item) {
  flex: 1;
  min-width: 0;
}
</style>

<!-- Modal được teleport ra ngoài component nên dùng style không scoped để tô nền -->
<style>
.detail-modal.n-card {
  background: var(--bg);
}
</style>
