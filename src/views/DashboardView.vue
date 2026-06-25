<script setup>
import { computed, ref } from 'vue'
import {
  NGrid,
  NGi,
  NCard,
  NStatistic,
  NTable,
  NTag,
  NButton,
  NSpin,
  NEmpty,
  NSpace,
  NSwitch,
  NText,
  NH2,
  NModal,
} from 'naive-ui'
import { useBoostStore } from '@/stores/boost'
import { fmtUSDT, fmtPct, fmtDate, signClass, cycleStatus, clsColor, tagType } from '@/utils/format'
import AccountBadge from '@/components/AccountBadge.vue'
import BarList from '@/components/BarList.vue'

const store = useBoostStore()
const summary = computed(() => store.summary)
const byAccount = computed(() => store.byAccount)

const active = computed(() =>
  store.cyclesEnriched
    .map((c) => ({ ...c, status: cycleStatus(c.endDate) }))
    .filter((c) => c.status.left !== null && c.status.left >= 0)
    .sort((a, b) => a.status.left - b.status.left),
)

// ----- Dữ liệu biểu đồ -----
const CHART_MAX = 4

// Lợi nhuận theo chu kì: ngày mới nhất hiển thị trước
const profitByBatch = computed(() =>
  [...store.batches].sort((a, b) => (b.startDate || '').localeCompare(a.startDate || '')),
)
const rewardByToken = computed(() =>
  store.rewardsByToken.map((t) => ({
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

    <n-grid cols="1 l:2" responsive="screen" :x-gap="16" :y-gap="16" style="margin-top: 18px">
      <n-gi>
        <n-card title="Lợi nhuận theo chu kì" size="small">
          <div class="table-wrap">
            <n-table
              v-if="profitByBatch.length"
              :bordered="false"
              :single-line="false"
              striped
              size="small"
            >
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
                <tr v-for="b in profitByBatch.slice(0, CHART_MAX)" :key="b.startDate">
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
            <n-empty v-else description="Chưa có đợt chu kì nào." />
          </div>
          <div v-if="profitByBatch.length > CHART_MAX" class="more">
            <n-button text type="primary" size="small" @click="batchModal = true">
              Xem thêm ({{ profitByBatch.length }})
            </n-button>
          </div>
        </n-card>
      </n-gi>
      <n-gi>
        <n-card title="Chu kì đang chạy" size="small">
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
        <n-card title="Thưởng theo token" size="small">
          <BarList
            v-if="rewardByToken.length"
            :items="rewardByToken.slice(0, CHART_MAX)"
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
