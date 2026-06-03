<script setup>
import { computed, reactive, ref, watch } from 'vue'
import {
  NCard,
  NSelect,
  NGrid,
  NGi,
  NStatistic,
  NTable,
  NTag,
  NButton,
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
import { fmtUSDT, fmtPct, fmtDate, signClass, cycleStatus } from '@/utils/format'

const store = useBoostStore()

const accountIndex = computed(() => {
  const m = {}
  store.accountNames.forEach((n, i) => (m[n] = i))
  return m
})

const batchOptions = computed(() => {
  const map = {}
  for (const c of store.cycles) {
    if (!map[c.startDate]) map[c.startDate] = { count: 0, end: c.endDate }
    map[c.startDate].count++
  }
  return Object.keys(map)
    .sort((a, b) => b.localeCompare(a))
    .map((d) => {
      const st = cycleStatus(map[d].end)
      return { label: `${fmtDate(d)} — ${map[d].count} ví · ${st.label}`, value: d }
    })
})

const selected = ref(null)
watch(
  batchOptions,
  (opts) => {
    if (!selected.value && opts.length) selected.value = opts[0].value
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

const rewardsInBatch = computed(() => {
  const ids = new Set(cyclesInBatch.value.map((c) => c.id))
  return store.rewards
    .filter((r) => ids.has(r.cycleId))
    .sort(
      (a, b) =>
        (accountIndex.value[a.account] ?? 999) - (accountIndex.value[b.account] ?? 999) ||
        (a.date || '').localeCompare(b.date || ''),
    )
})

// ----- Chế độ sửa nhanh (inline, có Huỷ/Lưu) -----
const editing = ref(false)
const draft = reactive({}) // rewardId -> { date, token, amount }

function buildDraft() {
  for (const k of Object.keys(draft)) delete draft[k]
  for (const r of rewardsInBatch.value) {
    draft[r.id] = { date: r.date || '', token: r.token || '', amount: r.amount }
  }
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
  for (const r of list)
    if (!draft[r.id]) draft[r.id] = { date: r.date || '', token: r.token || '', amount: r.amount }
})

function isChanged(r) {
  const d = draft[r.id]
  if (!d) return false
  return (
    (d.date || '') !== (r.date || '') ||
    (d.token || '') !== (r.token || '') ||
    (Number(d.amount) || 0) !== (Number(r.amount) || 0)
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
      estimated: !!r.estimated,
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
</script>

<template>
  <div>
    <n-card size="small" style="margin-bottom: 16px">
      <n-select
        v-model:value="selected"
        :options="batchOptions"
        placeholder="Chọn đợt chu kì (theo ngày bắt đầu)"
        style="max-width: 360px"
      />
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
              ><n-statistic label="Tổng phí (USDT)" :value="fmtUSDT(batchSummary.fee)"
            /></n-card>
          </n-gi>
          <n-gi>
            <n-card size="small"
              ><n-statistic label="Tổng thưởng (USDT)" :value="fmtUSDT(batchSummary.reward)"
            /></n-card>
          </n-gi>
          <n-gi>
            <n-card size="small">
              <n-statistic label="Lợi nhuận (USDT)">
                <span :class="signClass(batchSummary.profit)">{{
                  fmtUSDT(batchSummary.profit)
                }}</span>
              </n-statistic>
            </n-card>
          </n-gi>
        </n-grid>

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
                  <td class="right">
                    <n-button size="tiny" secondary @click="openAdd(c)">+ Thưởng</n-button>
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
                  <th style="width: 160px">Số tiền (USDT)</th>
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
                    <span v-else class="muted">—</span>
                  </td>
                </tr>
              </tbody>
            </n-table>
            <n-empty v-else description="Chu kì này chưa có phần thưởng nào." />
          </div>
        </n-card>
      </template>

      <n-card v-else size="small">
        <n-empty description="Chưa có chu kì. Hãy tạo chu kì ở chế độ Danh sách." />
      </n-card>
    </n-spin>

    <RewardModal
      v-model:show="rewardShow"
      :mode="rewardMode"
      :cycle="rewardCycle"
      :reward="rewardEdit"
    />
  </div>
</template>

<style scoped>
tbody tr.changed td {
  background: rgba(240, 185, 11, 0.12);
}
</style>
