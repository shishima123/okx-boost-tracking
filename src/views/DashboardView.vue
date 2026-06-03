<script setup>
import { computed } from 'vue'
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
} from 'naive-ui'
import { useBoostStore } from '@/stores/boost'
import { fmtUSDT, fmtPct, signClass, cycleStatus, groupColor } from '@/utils/format'

const store = useBoostStore()
const summary = computed(() => store.summary)
const byAccount = computed(() => store.byAccount)

const active = computed(() =>
  store.cyclesEnriched
    .map((c) => ({ ...c, status: cycleStatus(c.endDate) }))
    .filter((c) => c.status.left !== null && c.status.left >= 0)
    .sort((a, b) => a.status.left - b.status.left),
)
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
          ><n-statistic label="Tổng phí (USDT)" :value="fmtUSDT(summary.totalFee)"
        /></n-card>
      </n-gi>
      <n-gi>
        <n-card size="small"
          ><n-statistic label="Tổng thưởng (USDT)" :value="fmtUSDT(summary.totalReward)"
        /></n-card>
      </n-gi>
      <n-gi>
        <n-card size="small">
          <n-statistic label="💰 Lợi nhuận (USDT)">
            <span :class="signClass(summary.profit)">{{ fmtUSDT(summary.profit) }}</span>
          </n-statistic>
        </n-card>
      </n-gi>
      <n-gi>
        <n-card size="small">
          <n-statistic label="ROI tổng">
            <span :class="signClass(summary.profit)">{{ fmtPct(summary.roi) }}</span>
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
        <n-card title="Tổng hợp theo tài khoản" size="small">
          <div class="table-wrap">
            <n-table v-if="byAccount.length" :bordered="false" :single-line="false" size="small">
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
                  <td>
                    {{ a.name }}
                    <n-tag
                      v-if="a.group"
                      size="tiny"
                      :bordered="false"
                      :color="groupColor(a.group)"
                      >{{ a.group }}</n-tag
                    >
                  </td>
                  <td class="right">{{ a.cycles }}</td>
                  <td class="right">{{ fmtUSDT(a.fee) }}</td>
                  <td class="right">{{ fmtUSDT(a.reward) }}</td>
                  <td class="right" :class="signClass(a.profit)">{{ fmtUSDT(a.profit) }}</td>
                  <td class="right" :class="signClass(a.profit)">{{ fmtPct(a.roi) }}</td>
                </tr>
              </tbody>
            </n-table>
            <n-empty v-else description="Chưa có dữ liệu. Hãy thêm tài khoản & chu kì." />
          </div>
        </n-card>
      </n-gi>

      <n-gi>
        <n-card title="Chu kì đang chạy" size="small">
          <div class="table-wrap">
            <n-table v-if="active.length" :bordered="false" :single-line="false" size="small">
              <thead>
                <tr>
                  <th>Tài khoản</th>
                  <th class="right">Lợi nhuận</th>
                  <th class="right">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in active" :key="c.id">
                  <td>{{ c.account }}</td>
                  <td class="right" :class="signClass(c.profit)">{{ fmtUSDT(c.profit) }}</td>
                  <td class="right" :class="c.status.cls">{{ c.status.label }}</td>
                </tr>
              </tbody>
            </n-table>
            <n-empty v-else description="Không có chu kì nào đang chạy." />
          </div>
        </n-card>
      </n-gi>
    </n-grid>
  </n-spin>
</template>
