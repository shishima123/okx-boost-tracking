<script setup>
import { computed, ref } from 'vue'
import { useStorage, StorageSerializers } from '@vueuse/core'
import {
  NGrid,
  NGi,
  NCard,
  NStatistic,
  NTable,
  NTag,
  NButton,
  NButtonGroup,
  NSpin,
  NEmpty,
  NSpace,
  NSwitch,
  NText,
  NH2,
  NModal,
  NDatePicker,
} from 'naive-ui'
import { useBoostStore } from '@/stores/boost'
import {
  fmtUSDT,
  fmtPct,
  fmtDate,
  signClass,
  cycleStatus,
  clsColor,
  tagType,
  todayISO,
  addDays,
} from '@/utils/format'
import {
  computeSummary,
  computeByAccount,
  computeBatches,
  computeRewardsByToken,
} from '@/utils/stats'
import AccountBadge from '@/components/AccountBadge.vue'
import BarList from '@/components/BarList.vue'
import ProfitTrendChart from '@/components/charts/ProfitTrendChart.vue'
import FeeRewardChart from '@/components/charts/FeeRewardChart.vue'
import RoiTrendChart from '@/components/charts/RoiTrendChart.vue'
import TokenDoughnutChart from '@/components/charts/TokenDoughnutChart.vue'

const store = useBoostStore()

// ----- Lọc theo khoảng ngày (theo startDate của chu kì) -----
// null = tất cả; ngược lại [fromISO, toISO]
// Mặc định null nên VueUse không tự đoán được kiểu -> phải ép serializer object,
// nếu không mảng ngày bị lưu bằng String() và hỏng sau khi reload trang.
const range = useStorage('okx_boost_dash_range', null, undefined, {
  serializer: StorageSerializers.object,
})

const hasRange = computed(() => !!(range.value && range.value[0] && range.value[1]))
const rangeLabel = computed(() =>
  hasRange.value ? `${fmtDate(range.value[0])} – ${fmtDate(range.value[1])}` : 'Tất cả',
)

function setPreset(key) {
  const today = todayISO()
  if (key === 'all') range.value = null
  else if (key === 'month') range.value = [today.slice(0, 7) + '-01', today]
  else if (key === '30') range.value = [addDays(today, -29), today]
  else if (key === '90') range.value = [addDays(today, -89), today]
}

const filteredCycles = computed(() => {
  // Dùng cyclesEnriched để tên tài khoản (group theo tài khoản) luôn là tên hiện tại.
  if (!hasRange.value) return store.cyclesEnriched
  const [from, to] = range.value
  return store.cyclesEnriched.filter((c) => c.startDate && c.startDate >= from && c.startDate <= to)
})
const filteredCycleIds = computed(() => new Set(filteredCycles.value.map((c) => c.id)))
const filteredRewards = computed(() => {
  if (!hasRange.value) return store.rewards
  return store.rewards.filter((r) => filteredCycleIds.value.has(r.cycleId))
})

// ----- Thống kê (theo bộ lọc) -----
const summary = computed(() =>
  computeSummary(store.accounts, filteredCycles.value, filteredRewards.value, store.includeEstimated),
)
const byAccount = computed(() =>
  computeByAccount(store.accounts, filteredCycles.value, filteredRewards.value, store.includeEstimated),
)
// Đợt theo thứ tự thời gian tăng dần — dùng cho các biểu đồ xu hướng
const batchesAsc = computed(() =>
  computeBatches(filteredCycles.value, filteredRewards.value, store.includeEstimated),
)
const tokens = computed(() =>
  computeRewardsByToken(filteredRewards.value, store.includeEstimated),
)

// Chu kì đang chạy — KHÔNG lọc theo khoảng ngày (luôn phản ánh thực tế hiện tại)
const active = computed(() =>
  store.cyclesEnriched
    .map((c) => ({ ...c, status: cycleStatus(c.endDate) }))
    .filter((c) => c.status.left !== null && c.status.left >= 0)
    .sort((a, b) => a.status.left - b.status.left),
)

// ----- Dữ liệu bảng "Xem thêm" -----
const CHART_MAX = 4

// Lợi nhuận theo chu kì: ngày mới nhất hiển thị trước (bảng)
const profitByBatch = computed(() => [...batchesAsc.value].reverse())
const rewardByToken = computed(() =>
  tokens.value.map((t) => ({
    label: t.token,
    value: t.amount,
    sub: ` · ${t.count} lần`,
  })),
)

// Modal "Xem thêm" — dùng cho biểu đồ thưởng theo token
const modal = ref({ show: false, title: '', items: [], signed: false })
function openModal(title, items, signed) {
  modal.value = { show: true, title, items, signed }
}

// Modal "Xem thêm" — bảng lợi nhuận theo chu kì
const batchModal = ref(false)
</script>

<template>
  <n-space justify="space-between" align="center" style="margin-bottom: 18px" :wrap="true">
    <n-h2 style="margin: 0">📊 Tổng quan</n-h2>
    <n-space align="center" :size="14">
      <n-space align="center" :size="8">
        <n-switch v-model:value="store.includeEstimated" size="small" />
        <n-text depth="3" style="font-size: 13px">
          Tính cả thưởng ước lượng
          <span v-if="store.estimatedCount" class="muted">({{ store.estimatedCount }})</span>
        </n-text>
      </n-space>
      <n-button secondary size="small" :loading="store.loading" @click="store.load()">
        ↻ Làm mới
      </n-button>
    </n-space>
  </n-space>

  <!-- Bộ lọc khoảng ngày (theo ngày bắt đầu chu kì) -->
  <n-card size="small" style="margin-bottom: 18px">
    <n-space align="center" :size="12" :wrap="true">
      <n-text depth="3" style="font-size: 13px">Khoảng thời gian</n-text>
      <n-button-group size="small">
        <n-button :type="!hasRange ? 'primary' : 'default'" @click="setPreset('all')">Tất cả</n-button>
        <n-button @click="setPreset('month')">Tháng này</n-button>
        <n-button @click="setPreset('30')">30 ngày</n-button>
        <n-button @click="setPreset('90')">90 ngày</n-button>
      </n-button-group>
      <n-date-picker
        v-model:formatted-value="range"
        value-format="yyyy-MM-dd"
        type="daterange"
        size="small"
        clearable
        style="width: 260px"
      />
      <n-text depth="3" style="font-size: 12px">Đang xem: <b>{{ rangeLabel }}</b></n-text>
    </n-space>
  </n-card>

  <n-spin :show="store.loading">
    <n-grid cols="2 s:3 l:6" responsive="screen" :x-gap="14" :y-gap="14">
      <n-gi>
        <n-card size="small"
          ><n-statistic label="Tổng phí" :value="fmtUSDT(summary.totalFee)"
        /></n-card>
      </n-gi>
      <n-gi>
        <n-card size="small"
          ><n-statistic label="Tổng thưởng" :value="fmtUSDT(summary.totalReward)"
        /></n-card>
      </n-gi>
      <n-gi>
        <n-card size="small">
          <n-statistic label="💰 Lợi nhuận">
            <span :style="{ color: clsColor(signClass(summary.profit)) }">
              {{ fmtUSDT(summary.profit) }}
            </span>
          </n-statistic>
        </n-card>
      </n-gi>
      <n-gi>
        <n-card size="small">
          <n-statistic label="ROI tổng">
            <span :style="{ color: clsColor(signClass(summary.profit)) }">
              {{ fmtPct(summary.roi) }}
            </span>
          </n-statistic>
        </n-card>
      </n-gi>
      <n-gi>
        <n-card size="small"><n-statistic label="Số chu kì" :value="summary.cycleCount" /></n-card>
      </n-gi>
      <n-gi>
        <n-card size="small"
          ><n-statistic label="Số tài khoản" :value="summary.accountCount"
        /></n-card>
      </n-gi>
    </n-grid>

    <!-- Biểu đồ xu hướng -->
    <n-grid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16" style="margin-top: 18px">
      <n-gi>
        <n-card title="Lợi nhuận tích lũy" size="small">
          <ProfitTrendChart v-if="batchesAsc.length" :batches="batchesAsc" />
          <n-empty v-else description="Chưa có đợt chu kì nào." />
          <div v-if="profitByBatch.length" class="more">
            <n-button text type="primary" size="small" @click="batchModal = true">
              Xem bảng chi tiết ({{ profitByBatch.length }})
            </n-button>
          </div>
        </n-card>
      </n-gi>
      <n-gi>
        <n-card title="Phí vs Thưởng theo đợt" size="small">
          <FeeRewardChart v-if="batchesAsc.length" :batches="batchesAsc" />
          <n-empty v-else description="Chưa có đợt chu kì nào." />
        </n-card>
      </n-gi>
    </n-grid>

    <n-grid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16" style="margin-top: 18px">
      <n-gi>
        <n-card title="ROI theo đợt" size="small">
          <RoiTrendChart v-if="batchesAsc.length" :batches="batchesAsc" />
          <n-empty v-else description="Chưa có đợt chu kì nào." />
        </n-card>
      </n-gi>
      <n-gi>
        <n-card title="Thưởng theo token" size="small">
          <TokenDoughnutChart v-if="tokens.length > 1" :tokens="tokens" />
          <BarList
            v-else-if="tokens.length"
            :items="rewardByToken"
            :format="fmtUSDT"
          />
          <n-empty v-else description="Chưa có phần thưởng nào." />
          <div v-if="rewardByToken.length > CHART_MAX" class="more">
            <n-button
              text
              type="primary"
              size="small"
              @click="openModal('Thưởng theo token', rewardByToken, false)"
            >
              Xem thêm ({{ rewardByToken.length }})
            </n-button>
          </div>
        </n-card>
      </n-gi>
    </n-grid>

    <n-grid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16" style="margin-top: 18px">
      <n-gi>
        <n-card title="Tổng hợp theo tài khoản" size="small">
          <div class="table-wrap">
            <n-table
              v-if="byAccount.length"
              :bordered="false"
              :single-line="false"
              striped
              size="small"
            >
              <thead>
                <tr>
                  <th>Tài khoản</th>
                  <th class="right">Chu kì</th>
                  <th class="right">Phí</th>
                  <th class="right">Thưởng</th>
                  <th class="right">Lợi nhuận</th>
                  <th class="right">ROI</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="a in byAccount" :key="a.name">
                  <td class="nowrap acc-col">
                    <AccountBadge :name="a.name" />
                  </td>
                  <td class="right">{{ a.cycles }}</td>
                  <td class="right">{{ fmtUSDT(a.fee) }}</td>
                  <td class="right">{{ fmtUSDT(a.reward) }}</td>
                  <td class="right" :style="{ color: clsColor(signClass(a.profit)) }">
                    {{ fmtUSDT(a.profit) }}
                  </td>
                  <td class="right" :style="{ color: clsColor(signClass(a.profit)) }">
                    {{ fmtPct(a.roi) }}
                  </td>
                </tr>
              </tbody>
            </n-table>
            <n-empty v-else description="Chưa có dữ liệu. Hãy thêm tài khoản & chu kì." />
          </div>
        </n-card>
      </n-gi>

      <n-gi>
        <n-card size="small">
          <template #header>
            <n-space align="center" :size="8">
              <span>Chu kì đang chạy</span>
              <n-text depth="3" style="font-size: 11px">(không theo bộ lọc)</n-text>
            </n-space>
          </template>
          <div class="table-wrap">
            <n-table
              v-if="active.length"
              :bordered="false"
              :single-line="false"
              striped
              size="small"
            >
              <thead>
                <tr>
                  <th>Tài khoản</th>
                  <th class="right">Lợi nhuận</th>
                  <th class="right">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in active" :key="c.id">
                  <td class="acc-col"><AccountBadge :name="c.account" /></td>
                  <td class="right" :style="{ color: clsColor(signClass(c.profit)) }">
                    {{ fmtUSDT(c.profit) }}
                  </td>
                  <td class="right">
                    <n-tag size="small" round :bordered="false" :type="tagType(c.status.cls)">
                      {{ c.status.label }}
                    </n-tag>
                  </td>
                </tr>
              </tbody>
            </n-table>
            <n-empty v-else description="Không có chu kì nào đang chạy." />
          </div>
        </n-card>
      </n-gi>
    </n-grid>
  </n-spin>

  <n-modal v-model:show="modal.show" preset="card" :title="modal.title" style="max-width: 560px">
    <div class="modal-list">
      <BarList :items="modal.items" :signed="modal.signed" :format="fmtUSDT" />
    </div>
  </n-modal>

  <n-modal
    v-model:show="batchModal"
    preset="card"
    title="Lợi nhuận theo chu kì"
    style="max-width: 560px"
  >
    <div class="modal-list table-wrap">
      <n-table :bordered="false" :single-line="false" striped size="small">
        <thead>
          <tr>
            <th>Chu kì</th>
            <th class="right">Phí</th>
            <th class="right">Thưởng</th>
            <th class="right">Lợi nhuận</th>
            <th class="right">ROI</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in profitByBatch" :key="b.startDate">
            <td class="nowrap">
                    {{ fmtDate(b.startDate) }}<span v-if="b.endDate"> - {{ fmtDate(b.endDate) }}</span>
                  </td>
            <td class="right">{{ fmtUSDT(b.fee) }}</td>
            <td class="right">{{ fmtUSDT(b.reward) }}</td>
            <td class="right" :style="{ color: clsColor(signClass(b.profit)) }">
              {{ fmtUSDT(b.profit) }}
            </td>
            <td class="right" :style="{ color: clsColor(signClass(b.profit)) }">
              {{ fmtPct(b.roi) }}
            </td>
          </tr>
        </tbody>
      </n-table>
    </div>
  </n-modal>
</template>

<style scoped>
/* Căn giữa toàn bộ nội dung trong các bảng */
.table-wrap :deep(th),
.table-wrap :deep(td) {
  text-align: center !important;
}
/* Cột tài khoản căn trái */
.table-wrap :deep(th.acc-col),
.table-wrap :deep(td.acc-col) {
  text-align: left !important;
}
.more {
  margin-top: 12px;
  text-align: center;
}
.modal-list {
  max-height: 60vh;
  overflow-y: auto;
}
</style>
