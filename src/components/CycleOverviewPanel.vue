<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useStorage } from '@vueuse/core'
import {
  NCard,
  NSelect,
  NCheckbox,
  NGrid,
  NGi,
  NStatistic,
  NTable,
  NTag,
  NButton,
  NModal,
  NInput,
  NInputNumber,
  NDatePicker,
  NEmpty,
  NSpin,
  NSpace,
  NText,
} from 'naive-ui'
import RewardModal from '@/components/RewardModal.vue'
import AccountBadge from '@/components/AccountBadge.vue'
import { useBoostStore } from '@/stores/boost'
import { confirmDialog } from '@/composables/feedback'
import {
  fmtUSDT,
  fmtPct,
  fmtDate,
  signClass,
  cycleStatus,
  tagType,
  clsColor,
  todayISO,
  finalFee,
} from '@/utils/format'

const store = useBoostStore()

// Khi truyền `startDate`, component hoạt động ở chế độ nhúng (trong modal):
// hiển thị chi tiết đúng đợt đó và ẩn ô chọn đợt.
const props = defineProps({
  startDate: { type: String, default: null },
})
const embedded = computed(() => props.startDate != null)

const accountIndex = computed(() => {
  const m = {}
  store.accountNames.forEach((n, i) => (m[n] = i))
  return m
})

// Chỉ hiện đợt đang hoạt động (lưu lựa chọn vào localStorage)
const onlyActive = useStorage('okx-boost:overview-only-active', true)

const batchOptions = computed(() => {
  const map = {}
  for (const c of store.cycles) {
    if (!map[c.startDate]) map[c.startDate] = { count: 0, end: c.endDate || '' }
    map[c.startDate].count++
    if ((c.endDate || '') > map[c.startDate].end) map[c.startDate].end = c.endDate || ''
  }
  return Object.keys(map)
    .sort((a, b) => b.localeCompare(a))
    .map((d) => {
      const st = cycleStatus(map[d].end)
      return {
        label: `${fmtDate(d)} — ${map[d].count} ví · ${st.label}`,
        value: d,
        state: st.state,
      }
    })
    .filter((o) => !onlyActive.value || o.state === 'active')
})

const internalSelected = ref(null)
// Ở chế độ nhúng dùng đợt từ prop; ngược lại dùng đợt chọn qua dropdown.
const selected = computed(() => (embedded.value ? props.startDate : internalSelected.value))
// Chọn đợt đầu khi chưa chọn, hoặc khi đợt đang chọn bị lọc ra khỏi danh sách.
watch(
  batchOptions,
  (opts) => {
    if (embedded.value) return
    if (!opts.some((o) => o.value === internalSelected.value))
      internalSelected.value = opts[0]?.value ?? null
  },
  { immediate: true },
)

const cyclesInBatch = computed(() =>
  store.cyclesEnriched
    .filter((c) => c.startDate === selected.value)
    .sort(
      (a, b) => (accountIndex.value[a.account] ?? 999) - (accountIndex.value[b.account] ?? 999),
    ),
)

const batchSummary = computed(() => {
  const list = cyclesInBatch.value
  const fee = list.reduce((s, c) => s + c.fee, 0)
  const reward = list.reduce((s, c) => s + c.reward, 0)
  return {
    count: list.length,
    fee,
    reward,
    profit: reward - fee,
    roi: fee ? (reward - fee) / fee : 0,
  }
})

// Ngày bắt đầu / kết thúc / còn lại của đợt (các ví cùng đợt thường cùng ngày kết thúc;
// lấy ngày kết thúc xa nhất để an toàn nếu có lệch).
const batchMeta = computed(() => {
  const list = cyclesInBatch.value
  const end = list.reduce((mx, c) => (c.endDate > mx ? c.endDate : mx), '')
  return { start: selected.value, end, status: cycleStatus(end) }
})

const rewardsInBatch = computed(() => {
  const ids = new Set(cyclesInBatch.value.map((c) => c.id))
  return store.rewardsEnriched
    .filter((r) => ids.has(r.cycleId))
    .sort(
      (a, b) =>
        (b.date || '').localeCompare(a.date || '') ||
        (accountIndex.value[a.account] ?? 999) - (accountIndex.value[b.account] ?? 999),
    )
})

// ----- Chế độ sửa nhanh (inline, có Huỷ/Lưu) -----
const editing = ref(false)
const draft = reactive({}) // rewardId -> { date, token, amount, estimated }

function draftFrom(r) {
  return { date: r.date || '', token: r.token || '', amount: r.amount, estimated: !!r.estimated }
}
function buildDraft() {
  for (const k of Object.keys(draft)) delete draft[k]
  for (const r of rewardsInBatch.value) draft[r.id] = draftFrom(r)
}
function enterEdit() {
  buildDraft()
  editing.value = true
}
function cancelEdit() {
  editing.value = false
  for (const k of Object.keys(draft)) delete draft[k]
}
// Đổi đợt khi đang sửa thì thoát chế độ sửa
watch(selected, () => editing.value && cancelEdit())
// Bổ sung draft cho thưởng mới phát sinh khi đang sửa
watch(rewardsInBatch, (list) => {
  if (!editing.value) return
  for (const r of list) if (!draft[r.id]) draft[r.id] = draftFrom(r)
})

function isChanged(r) {
  const d = draft[r.id]
  if (!d) return false
  return (
    (d.date || '') !== (r.date || '') ||
    (d.token || '') !== (r.token || '') ||
    (Number(d.amount) || 0) !== (Number(r.amount) || 0) ||
    !!d.estimated !== !!r.estimated
  )
}
const changedCount = computed(() => rewardsInBatch.value.filter(isChanged).length)

async function saveEdit() {
  const items = rewardsInBatch.value.filter(isChanged).map((r) => ({
    id: r.id,
    data: {
      cycleId: r.cycleId,
      accountId: r.accountId,
      date: draft[r.id].date,
      amount: Number(draft[r.id].amount) || 0,
      token: draft[r.id].token,
      note: r.note,
      estimated: !!draft[r.id].estimated,
    },
  }))
  if (!items.length) {
    cancelEdit()
    return
  }
  const ok = await confirmDialog({
    title: 'Lưu thay đổi',
    content: `Lưu ${items.length} phần thưởng đã chỉnh sửa?`,
    positiveText: 'Lưu',
    type: 'info',
  })
  if (!ok) return
  await store.updateRewardsBulk(items)
  cancelEdit()
}

async function removeReward(r) {
  const ok = await confirmDialog({
    title: 'Xoá phần thưởng',
    content: `Xoá thưởng ${fmtUSDT(r.amount)} của "${r.account}"?`,
    positiveText: 'Xoá',
  })
  if (ok) await store.deleteReward(r.id)
}

// Modal thêm/sửa thưởng (đầy đủ)
const rewardShow = ref(false)
const rewardMode = ref('add')
const rewardCycle = ref(null)
const rewardEdit = ref(null)

function openAdd(c) {
  rewardMode.value = 'add'
  rewardCycle.value = c
  rewardEdit.value = null
  rewardShow.value = true
}
function openEdit(r) {
  rewardMode.value = 'edit'
  rewardEdit.value = r
  rewardShow.value = true
}

// ----- Nhập thưởng nhanh cho cả đợt (chu kì cố định, không cho đổi) -----
const showBatch = ref(false)
const bForm = reactive({ date: todayISO(), token: '', note: '', estimated: false })
const bulkFill = ref(null)
const batchAmounts = reactive({}) // cycleId -> số tiền

const batchFilledCount = computed(
  () => cyclesInBatch.value.filter((c) => isFilled(batchAmounts[c.id])).length,
)

function isFilled(v) {
  return v !== null && v !== undefined && v !== ''
}

function openBatch() {
  Object.assign(bForm, { date: todayISO(), token: '', note: '', estimated: false })
  bulkFill.value = null
  for (const k of Object.keys(batchAmounts)) delete batchAmounts[k]
  showBatch.value = true
}

function applyFill() {
  for (const c of cyclesInBatch.value) batchAmounts[c.id] = bulkFill.value
}

async function saveBatch() {
  const items = cyclesInBatch.value
    .filter((c) => isFilled(batchAmounts[c.id]))
    .map((c) => ({
      cycleId: c.id,
      accountId: c.accountId,
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

// ----- Xoá ví (chu kì) trong đợt — tuỳ chọn xoá kèm thưởng liên kết -----
const showDelCycle = ref(false)
const delTarget = ref(null)
const delWithRewards = ref(true)
const delRewardCount = computed(() =>
  delTarget.value ? store.rewards.filter((r) => r.cycleId === delTarget.value.id).length : 0,
)

function askRemoveCycle(c) {
  delTarget.value = c
  delWithRewards.value = true
  showDelCycle.value = true
}
async function confirmRemoveCycle() {
  const c = delTarget.value
  if (!c) return
  const ids =
    delWithRewards.value && delRewardCount.value
      ? store.rewards.filter((r) => r.cycleId === c.id).map((r) => r.id)
      : []
  await store.deleteCycleWithRewards(c.id, ids)
  showDelCycle.value = false
  delTarget.value = null
}

// ----- Sửa chu kì (phí gốc / hoàn phí / ghi chú) cho một ví -----
const showEditCycle = ref(false)
const editCycleTarget = ref(null)
const cycleForm = reactive({ feeGross: 0, feeRebate: 0, note: '' })
// Phí cuối = phí gốc - hoàn phí (lưu sẵn vào DB)
const cycleFeeFinal = computed(() => finalFee(cycleForm.feeGross, cycleForm.feeRebate))

function openEditCycle(c) {
  editCycleTarget.value = c
  Object.assign(cycleForm, {
    // Tương thích bản ghi cũ: chưa có feeGross -> dùng phí cũ làm phí gốc, hoàn phí = 0
    feeGross: c.feeGross ?? c.fee ?? 0,
    feeRebate: c.feeRebate ?? 0,
    note: c.note || '',
  })
  showEditCycle.value = true
}

async function saveEditCycle() {
  const c = editCycleTarget.value
  if (!c) return
  await store.updateCycle(c.id, {
    feeGross: Number(cycleForm.feeGross) || 0,
    feeRebate: Number(cycleForm.feeRebate) || 0,
    fee: cycleFeeFinal.value,
    note: cycleForm.note,
  })
  showEditCycle.value = false
  editCycleTarget.value = null
}

// ----- Sửa phí nhanh cho cả đợt (phí gốc / hoàn phí của mọi ví) -----
const showBatchFee = ref(false)
const feeDraft = reactive({}) // cycleId -> { feeGross, feeRebate }
const bulkGross = ref(null)
const bulkRebate = ref(null)

// Giá trị gốc của mỗi ví để so sánh "đã đổi" (tương thích bản ghi cũ chỉ có fee)
function feeBaseline(c) {
  return { feeGross: c.feeGross ?? c.fee ?? 0, feeRebate: c.feeRebate ?? 0 }
}

// Giá trị chung của một field nếu mọi ví bằng nhau, ngược lại null (để ô điền nhanh trống)
function commonFeeValue(list, key) {
  if (!list.length) return null
  const first = Number(list[0][key]) || 0
  return list.every((d) => (Number(d[key]) || 0) === first) ? first : null
}

function openBatchFee() {
  for (const k of Object.keys(feeDraft)) delete feeDraft[k]
  const drafts = cyclesInBatch.value.map((c) => (feeDraft[c.id] = feeBaseline(c)))
  // Tự điền ô "điền nhanh" ở trên từ giá trị các ví bên dưới
  bulkGross.value = commonFeeValue(drafts, 'feeGross')
  bulkRebate.value = commonFeeValue(drafts, 'feeRebate')
  showBatchFee.value = true
}

// Điền nhanh: chỉ áp những ô đã nhập (để trống thì giữ nguyên giá trị cũ của ví)
function applyBulkFee() {
  for (const c of cyclesInBatch.value) {
    const d = feeDraft[c.id]
    if (!d) continue
    if (bulkGross.value !== null && bulkGross.value !== '') d.feeGross = bulkGross.value
    if (bulkRebate.value !== null && bulkRebate.value !== '') d.feeRebate = bulkRebate.value
  }
}

function feeFinalFor(id) {
  const d = feeDraft[id]
  return d ? finalFee(d.feeGross, d.feeRebate) : 0
}

function isFeeChanged(c) {
  const d = feeDraft[c.id]
  if (!d) return false
  const base = feeBaseline(c)
  return (
    (Number(d.feeGross) || 0) !== (Number(base.feeGross) || 0) ||
    (Number(d.feeRebate) || 0) !== (Number(base.feeRebate) || 0)
  )
}
const changedFeeCount = computed(() => cyclesInBatch.value.filter(isFeeChanged).length)

async function saveBatchFee() {
  const items = cyclesInBatch.value.filter(isFeeChanged).map((c) => ({
    id: c.id,
    data: {
      feeGross: Number(feeDraft[c.id].feeGross) || 0,
      feeRebate: Number(feeDraft[c.id].feeRebate) || 0,
      fee: feeFinalFor(c.id),
    },
  }))
  if (!items.length) {
    showBatchFee.value = false
    return
  }
  const ok = await confirmDialog({
    title: 'Sửa phí cả đợt',
    content: `Lưu thay đổi phí cho ${items.length} ví?`,
    positiveText: 'Lưu',
    type: 'info',
  })
  if (!ok) return
  await store.updateCyclesBulk(items)
  showBatchFee.value = false
}
</script>

<template>
  <div :class="{ embedded }">
    <n-card v-if="!embedded" size="small" style="margin-bottom: 16px">
      <n-space align="center" :size="16" :wrap="true">
        <n-select
          v-model:value="internalSelected"
          :options="batchOptions"
          placeholder="Chọn đợt chu kì (theo ngày bắt đầu)"
          style="width: 360px; max-width: 100%"
        />
        <n-checkbox v-model:checked="onlyActive">Chỉ hiện chu kì đang hoạt động</n-checkbox>
      </n-space>
    </n-card>

    <n-spin :show="store.loading">
      <template v-if="selected && cyclesInBatch.length">
        <n-card size="small" style="margin-bottom: 16px">
          <div class="batch-meta">
            <span
              ><span class="muted">Bắt đầu:</span> <b>{{ fmtDate(batchMeta.start) }}</b></span
            >
            <span
              ><span class="muted">Kết thúc:</span> <b>{{ fmtDate(batchMeta.end) }}</b></span
            >
            <span class="meta-left">
              <span class="muted">Còn lại:</span>
              <n-tag size="small" round :bordered="false" :type="tagType(batchMeta.status.cls)">
                {{ batchMeta.status.label }}
              </n-tag>
              <b
                v-if="batchMeta.status.detail"
                :style="{ color: clsColor(batchMeta.status.leftCls) }"
              >
                {{ batchMeta.status.detail }}
              </b>
            </span>
          </div>

          <n-grid cols="2 s:4" responsive="screen" :x-gap="14" :y-gap="14" class="batch-stats">
            <n-gi>
              <n-statistic label="Số ví" :value="batchSummary.count" />
            </n-gi>
            <n-gi>
              <n-statistic label="Tổng phí" :value="fmtUSDT(batchSummary.fee)" />
            </n-gi>
            <n-gi>
              <n-statistic label="Tổng thưởng" :value="fmtUSDT(batchSummary.reward)" />
            </n-gi>
            <n-gi>
              <n-statistic label="Lợi nhuận">
                <span :class="signClass(batchSummary.profit)">{{
                  fmtUSDT(batchSummary.profit)
                }}</span>
              </n-statistic>
            </n-gi>
          </n-grid>
        </n-card>

        <n-card size="small" style="margin-bottom: 16px">
          <template #header>Các ví trong chu kì</template>
          <template #header-extra>
            <n-space :size="8">
              <n-button size="small" secondary @click="openBatchFee">✏️ Sửa phí cả đợt</n-button>
              <n-button size="small" secondary @click="openBatch">⚡ Nhập thưởng nhanh</n-button>
            </n-space>
          </template>
          <div class="table-wrap">
            <n-table :bordered="false" :single-line="false" striped size="small">
              <thead>
                <tr>
                  <th>Tài khoản</th>
                  <th class="right">Phí</th>
                  <th class="right">Thưởng</th>
                  <th class="right">Lợi nhuận</th>
                  <th class="right">ROI</th>
                  <th class="right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in cyclesInBatch" :key="c.id">
                  <td class="acc-col"><AccountBadge :name="c.account" /></td>
                  <td class="right">{{ fmtUSDT(c.fee) }}</td>
                  <td class="right">{{ fmtUSDT(c.reward) }}</td>
                  <td class="right" :class="signClass(c.profit)">{{ fmtUSDT(c.profit) }}</td>
                  <td class="right" :class="signClass(c.profit)">{{ fmtPct(c.roi) }}</td>
                  <td class="nowrap">
                    <n-space :size="6" justify="center" :wrap="false">
                      <n-button size="tiny" secondary @click="openAdd(c)">+ Thưởng</n-button>
                      <n-button size="tiny" secondary @click="openEditCycle(c)">Sửa</n-button>
                      <n-button size="tiny" secondary type="error" @click="askRemoveCycle(c)">
                        Xoá
                      </n-button>
                    </n-space>
                  </td>
                </tr>
              </tbody>
            </n-table>
          </div>
        </n-card>

        <n-card size="small">
          <template #header>Phần thưởng</template>
          <template #header-extra>
            <n-space v-if="editing" :size="8">
              <n-text v-if="changedCount" depth="3" style="font-size: 12px">
                {{ changedCount }} thay đổi
              </n-text>
              <n-button size="small" @click="cancelEdit">Huỷ</n-button>
              <n-button size="small" type="primary" :loading="store.saving" @click="saveEdit">
                Lưu {{ changedCount || '' }}
              </n-button>
            </n-space>
            <n-button
              v-else
              size="small"
              secondary
              :disabled="!rewardsInBatch.length"
              @click="enterEdit"
            >
              ✏️ Sửa nhanh
            </n-button>
          </template>

          <div class="table-wrap">
            <n-table
              v-if="rewardsInBatch.length"
              :bordered="false"
              :single-line="false"
              striped
              size="small"
            >
              <thead>
                <tr>
                  <th>Tài khoản</th>
                  <th style="width: 150px">Ngày nhận</th>
                  <th style="width: 140px">Token</th>
                  <th style="width: 160px">Số tiền ($)</th>
                  <th>Ghi chú</th>
                  <th class="right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="r in rewardsInBatch"
                  :key="r.id"
                  :class="{ changed: editing && isChanged(r) }"
                >
                  <td class="acc-col"><AccountBadge :name="r.account" /></td>

                  <!-- Ngày nhận -->
                  <td>
                    <n-date-picker
                      v-if="editing"
                      v-model:formatted-value="draft[r.id].date"
                      value-format="yyyy-MM-dd"
                      type="date"
                      size="small"
                      style="width: 130px"
                    />
                    <span v-else>{{ fmtDate(r.date) }}</span>
                  </td>

                  <!-- Token -->
                  <td>
                    <n-input
                      v-if="editing"
                      :value="draft[r.id].token"
                      @update:value="(v) => (draft[r.id].token = (v || '').toUpperCase())"
                      size="small"
                      placeholder="Token"
                      style="width: 120px"
                    />
                    <template v-else>
                      <n-tag
                        v-if="r.token"
                        size="tiny"
                        :bordered="false"
                        style="margin-right: 6px"
                      >
                        {{ r.token }}
                      </n-tag>
                      <n-tag v-if="r.estimated" size="tiny" :bordered="false" type="warning">
                        Ước lượng
                      </n-tag>
                    </template>
                  </td>

                  <!-- Số tiền -->
                  <td>
                    <n-input-number
                      :show-button="false"
                      v-if="editing"
                      v-model:value="draft[r.id].amount"
                      :min="0"
                      :step="0.01"
                      :input-props="{ inputmode: 'decimal' }"
                      size="small"
                      style="width: 140px"
                    />
                    <span v-else>{{ fmtUSDT(r.amount) }}</span>
                  </td>

                  <td class="muted">{{ r.note }}</td>
                  <td class="nowrap">
                    <n-space v-if="!editing" :size="6" justify="center" :wrap="false">
                      <n-button size="tiny" secondary @click="openEdit(r)">Sửa</n-button>
                      <n-button size="tiny" secondary type="error" @click="removeReward(r)">
                        Xoá
                      </n-button>
                    </n-space>
                    <n-checkbox v-else v-model:checked="draft[r.id].estimated" size="small">
                      Ước lượng
                    </n-checkbox>
                  </td>
                </tr>
              </tbody>
            </n-table>
            <n-empty v-else description="Chu kì này chưa có phần thưởng nào." />
          </div>
        </n-card>
      </template>

      <n-card v-else size="small">
        <n-empty
          :description="
            onlyActive && store.cycles.length
              ? 'Không có chu kì đang hoạt động. Bỏ chọn “Chỉ hiện chu kì đang hoạt động” để xem các đợt đã kết thúc.'
              : 'Chưa có chu kì. Bấm “Tạo chu kì” để bắt đầu.'
          "
        />
      </n-card>
    </n-spin>

    <RewardModal
      v-model:show="rewardShow"
      :mode="rewardMode"
      :cycle="rewardCycle"
      :reward="rewardEdit"
    />

    <!-- Modal nhập thưởng nhanh cho cả đợt (chu kì cố định) -->
    <n-modal
      v-model:show="showBatch"
      preset="card"
      title="⚡ Nhập thưởng nhanh theo chu kì"
      style="max-width: 540px"
    >
      <n-space vertical :size="14">
        <div>
          <div class="muted small" style="margin-bottom: 6px">Chu kì (đã chọn sẵn)</div>
          <n-input
            :value="`${fmtDate(batchMeta.start)} – ${fmtDate(batchMeta.end)} · ${batchSummary.count} ví`"
            disabled
          />
        </div>
        <div class="batch-fields">
          <div>
            <div class="muted small" style="margin-bottom: 6px">Ngày nhận</div>
            <n-date-picker
              v-model:formatted-value="bForm.date"
              value-format="yyyy-MM-dd"
              type="date"
              style="width: 100%"
            />
          </div>
          <div>
            <div class="muted small" style="margin-bottom: 6px">Token / Loại thưởng</div>
            <n-input
              :value="bForm.token"
              @update:value="(v) => (bForm.token = (v || '').toUpperCase())"
              placeholder="VD: SLX, IRYS…"
            />
          </div>
        </div>

        <div class="batch-section">
          <div class="batch-fill">
            <span class="muted small">Điền nhanh cho tất cả ví</span>
            <div class="batch-fill-input">
              <n-input-number
                :show-button="false"
                v-model:value="bulkFill"
                :min="0"
                :step="0.01"
                :input-props="{ inputmode: 'decimal' }"
                placeholder="0.00"
                size="small"
                style="flex: 1"
              />
              <n-button size="small" @click="applyFill">Áp dụng</n-button>
            </div>
          </div>
          <div class="batch-list">
            <div class="batch-head muted">
              <span>Tài khoản</span>
              <span>Số tiền ($)</span>
            </div>
            <div v-for="c in cyclesInBatch" :key="c.id" class="batch-row">
              <span class="batch-acc">
                <AccountBadge :name="c.account" />
              </span>
              <n-input-number
                :show-button="false"
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

        <div>
          <div class="muted small" style="margin-bottom: 6px">Ghi chú</div>
          <n-input v-model:value="bForm.note" placeholder="Tuỳ chọn (áp dụng cho tất cả)" />
        </div>
        <n-checkbox v-model:checked="bForm.estimated">
          Đánh dấu tất cả là thưởng ước lượng (chưa chính thức)
        </n-checkbox>
      </n-space>
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

    <!-- Modal xoá ví (chu kì) — tuỳ chọn xoá kèm thưởng liên kết -->
    <n-modal v-model:show="showDelCycle" preset="card" title="Xoá ví khỏi chu kì" style="max-width: 420px">
      <n-space vertical :size="14">
        <n-text>
          Xoá ví
          <AccountBadge v-if="delTarget" :name="delTarget.account" />
          khỏi chu kì này?
        </n-text>
        <n-checkbox v-if="delRewardCount" v-model:checked="delWithRewards">
          Xoá luôn {{ delRewardCount }} phần thưởng liên kết
        </n-checkbox>
        <n-text v-if="delRewardCount && !delWithRewards" depth="3" style="font-size: 12px">
          Bỏ chọn: {{ delRewardCount }} phần thưởng sẽ thành “mồ côi” (không còn chu kì).
        </n-text>
      </n-space>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showDelCycle = false">Huỷ</n-button>
          <n-button type="error" :loading="store.saving" @click="confirmRemoveCycle">Xoá</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- Modal sửa chu kì (phí gốc / hoàn phí) -->
    <n-modal v-model:show="showEditCycle" preset="card" title="Sửa chu kì" style="max-width: 420px">
      <n-space vertical :size="14">
        <n-text v-if="editCycleTarget">
          Ví <AccountBadge :name="editCycleTarget.account" /> · đợt
          {{ fmtDate(batchMeta.start) }}
        </n-text>
        <div class="edit-fields">
          <div>
            <div class="muted small" style="margin-bottom: 6px">Phí gốc ($)</div>
            <n-input-number
              :show-button="false"
              v-model:value="cycleForm.feeGross"
              :min="0"
              :step="0.01"
              :input-props="{ inputmode: 'decimal' }"
              style="width: 100%"
            />
          </div>
          <div>
            <div class="muted small" style="margin-bottom: 6px">Hoàn phí ($)</div>
            <n-input-number
              :show-button="false"
              v-model:value="cycleForm.feeRebate"
              :min="0"
              :step="0.01"
              :input-props="{ inputmode: 'decimal' }"
              style="width: 100%"
            />
          </div>
        </div>
        <div>
          <div class="muted small" style="margin-bottom: 6px">Phí cuối (tự tính)</div>
          <n-input :value="fmtUSDT(cycleFeeFinal)" disabled />
        </div>
        <div>
          <div class="muted small" style="margin-bottom: 6px">Ghi chú</div>
          <n-input v-model:value="cycleForm.note" placeholder="Tuỳ chọn" />
        </div>
      </n-space>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showEditCycle = false">Huỷ</n-button>
          <n-button type="primary" :loading="store.saving" @click="saveEditCycle">Lưu</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- Modal sửa phí nhanh cho cả đợt -->
    <n-modal
      v-model:show="showBatchFee"
      preset="card"
      title="✏️ Sửa phí cả đợt"
      style="max-width: 560px"
    >
      <n-space vertical :size="14">
        <div>
          <div class="muted small" style="margin-bottom: 6px">Chu kì (đã chọn sẵn)</div>
          <n-input
            :value="`${fmtDate(batchMeta.start)} – ${fmtDate(batchMeta.end)} · ${batchSummary.count} ví`"
            disabled
          />
        </div>

        <div class="batch-section">
          <div class="batch-fill-fee">
            <span class="muted small">Điền nhanh cho tất cả ví (để trống = giữ nguyên)</span>
            <div class="batch-fill-fee-inputs">
              <n-input-number
                :show-button="false"
                v-model:value="bulkGross"
                :min="0"
                :step="0.01"
                :input-props="{ inputmode: 'decimal' }"
                placeholder="Phí gốc"
                size="small"
                style="flex: 1"
              />
              <n-input-number
                :show-button="false"
                v-model:value="bulkRebate"
                :min="0"
                :step="0.01"
                :input-props="{ inputmode: 'decimal' }"
                placeholder="Hoàn phí"
                size="small"
                style="flex: 1"
              />
              <n-button size="small" @click="applyBulkFee">Áp dụng</n-button>
            </div>
          </div>
          <div class="fee-list">
            <div class="fee-head muted">
              <span class="fee-acc">Tài khoản</span>
              <span>Phí gốc</span>
              <span>Hoàn phí</span>
              <span class="right">Phí cuối</span>
            </div>
            <div
              v-for="c in cyclesInBatch"
              :key="c.id"
              class="fee-row"
              :class="{ changed: isFeeChanged(c) }"
            >
              <span class="fee-acc"><AccountBadge :name="c.account" /></span>
              <n-input-number
                :show-button="false"
                v-model:value="feeDraft[c.id].feeGross"
                :min="0"
                :step="0.01"
                :input-props="{ inputmode: 'decimal' }"
                size="small"
              />
              <n-input-number
                :show-button="false"
                v-model:value="feeDraft[c.id].feeRebate"
                :min="0"
                :step="0.01"
                :input-props="{ inputmode: 'decimal' }"
                size="small"
              />
              <span class="right bold">{{ fmtUSDT(feeFinalFor(c.id)) }}</span>
            </div>
          </div>
        </div>
      </n-space>
      <template #footer>
        <n-space justify="end" align="center">
          <n-text v-if="changedFeeCount" depth="3" style="font-size: 12px">
            {{ changedFeeCount }} thay đổi
          </n-text>
          <n-button @click="showBatchFee = false">Huỷ</n-button>
          <n-button
            type="primary"
            :loading="store.saving"
            :disabled="!changedFeeCount"
            @click="saveBatchFee"
          >
            Lưu {{ changedFeeCount || '' }}
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
/* Khi nhúng trong modal (nền trắng), thêm viền + nền nhạt để các card tách bạch rõ hơn */
.embedded :deep(.n-card) {
  background: var(--bg-card);
  border: 1px solid var(--border);
}
/* Căn giữa nội dung bảng; riêng cột tài khoản căn trái (header vẫn center theo rule chung) */
.table-wrap :deep(td) {
  text-align: center !important;
}
.table-wrap :deep(td.acc-col) {
  text-align: left !important;
}
/* Hàng đang sửa: dùng !important để thắng nền striped của n-table (chỉ định cao hơn ở row chẵn) */
:deep(.n-table tbody tr.changed td) {
  background: rgba(240, 185, 11, 0.16) !important;
}
.meta-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
/* Header chu kì gộp: hàng meta (ngày/trạng thái) + lưới chỉ số */
.batch-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 28px;
  padding-bottom: 12px;
  margin-bottom: 14px;
  border-bottom: 1px solid var(--border);
}
.batch-stats :deep(.n-statistic .n-statistic-value) {
  font-size: 20px;
}

/* ----- Nhập thưởng nhanh ----- */
.small {
  font-size: 11px;
}
.batch-fields,
.edit-fields {
  display: flex;
  gap: 12px;
}
.batch-fields > *,
.edit-fields > * {
  flex: 1;
  min-width: 0;
}
.batch-section {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  background: #fff;
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

/* ----- Sửa phí cả đợt ----- */
.batch-fill-fee {
  padding-bottom: 10px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
.batch-fill-fee-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.fee-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 340px;
  overflow-y: auto;
}
.fee-head,
.fee-row {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr 0.9fr;
  align-items: center;
  gap: 10px;
}
.fee-head {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding-bottom: 2px;
  border-bottom: 1px solid var(--border);
}
.fee-row.changed {
  background: rgba(240, 185, 11, 0.16);
  border-radius: 6px;
}
.fee-acc {
  min-width: 0;
}
.fee-row .right,
.fee-head .right {
  text-align: right;
}
.fee-row .bold {
  font-weight: 600;
}
</style>
