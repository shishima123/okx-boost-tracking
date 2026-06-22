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
import { fmtUSDT, fmtPct, fmtDate, signClass, cycleStatus, tagType, clsColor } from '@/utils/format'

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
  return store.rewards
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
      account: r.account,
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
        <n-grid
          cols="2 s:4"
          responsive="screen"
          :x-gap="14"
          :y-gap="14"
          style="margin-bottom: 16px"
        >
          <n-gi>
            <n-card size="small"><n-statistic label="Số ví" :value="batchSummary.count" /></n-card>
          </n-gi>
          <n-gi>
            <n-card size="small"
              ><n-statistic label="Tổng phí" :value="fmtUSDT(batchSummary.fee)"
            /></n-card>
          </n-gi>
          <n-gi>
            <n-card size="small"
              ><n-statistic label="Tổng thưởng" :value="fmtUSDT(batchSummary.reward)"
            /></n-card>
          </n-gi>
          <n-gi>
            <n-card size="small">
              <n-statistic label="Lợi nhuận">
                <span :class="signClass(batchSummary.profit)">{{
                  fmtUSDT(batchSummary.profit)
                }}</span>
              </n-statistic>
            </n-card>
          </n-gi>
        </n-grid>

        <n-card size="small" style="margin-bottom: 16px">
          <n-space :size="28" align="center" :wrap="true">
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
          </n-space>
        </n-card>

        <n-card title="Các ví trong chu kì" size="small" style="margin-bottom: 16px">
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
                  <td><AccountBadge :name="c.account" /></td>
                  <td class="right">{{ fmtUSDT(c.fee) }}</td>
                  <td class="right">{{ fmtUSDT(c.reward) }}</td>
                  <td class="right" :class="signClass(c.profit)">{{ fmtUSDT(c.profit) }}</td>
                  <td class="right" :class="signClass(c.profit)">{{ fmtPct(c.roi) }}</td>
                  <td class="right nowrap">
                    <n-space :size="6" justify="end" :wrap="false">
                      <n-button size="tiny" secondary @click="openAdd(c)">+ Thưởng</n-button>
                      <n-button size="tiny" quaternary type="error" @click="askRemoveCycle(c)">
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
                  <td><AccountBadge :name="r.account" /></td>

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
                      v-model:value="draft[r.id].token"
                      size="small"
                      placeholder="Token"
                      style="width: 120px"
                    />
                    <template v-else>
                      <n-tag v-if="r.token" size="tiny" :bordered="false">{{ r.token }}</n-tag>
                      <n-tag v-if="r.estimated" size="tiny" :bordered="false" type="warning">
                        ước lượng
                      </n-tag>
                    </template>
                  </td>

                  <!-- Số tiền -->
                  <td>
                    <n-input-number
                      v-if="editing"
                      v-model:value="draft[r.id].amount"
                      :min="0"
                      :step="0.01"
                      size="small"
                      style="width: 140px"
                    />
                    <span v-else>{{ fmtUSDT(r.amount) }}</span>
                  </td>

                  <td class="muted">{{ r.note }}</td>
                  <td class="right nowrap">
                    <n-space v-if="!editing" :size="6" justify="end" :wrap="false">
                      <n-button size="tiny" quaternary @click="openEdit(r)">Sửa</n-button>
                      <n-button size="tiny" quaternary type="error" @click="removeReward(r)">
                        Xoá
                      </n-button>
                    </n-space>
                    <n-checkbox v-else v-model:checked="draft[r.id].estimated" size="small">
                      ước lượng
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
  </div>
</template>

<style scoped>
/* Khi nhúng trong modal (nền trắng), thêm viền + nền nhạt để các card tách bạch rõ hơn */
.embedded :deep(.n-card) {
  background: var(--bg-card);
  border: 1px solid var(--border);
}
tbody tr.changed td {
  background: rgba(240, 185, 11, 0.12);
}
.meta-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
</style>
