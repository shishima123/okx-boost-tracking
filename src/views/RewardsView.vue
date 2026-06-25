<script setup>
import { computed, ref, h, watch } from 'vue'
import {
  NCard,
  NTable,
  NTag,
  NButton,
  NSelect,
  NSpace,
  NEmpty,
  NSpin,
  NGrid,
  NGi,
  NStatistic,
  NH2,
  NPagination,
} from 'naive-ui'
import { useBoostStore } from '@/stores/boost'
import { confirmDialog } from '@/composables/feedback'
import { fmtUSDT, fmtDate } from '@/utils/format'
import AccountBadge from '@/components/AccountBadge.vue'

const store = useBoostStore()
const filterAccount = ref(null)
const filterToken = ref(null)

const cycleLabel = computed(() => {
  const m = {}
  for (const c of store.cycles) m[c.id] = fmtDate(c.startDate)
  return m
})

const tokens = computed(() => [...new Set(store.rewards.map((r) => r.token).filter(Boolean))])

const accountOptions = computed(() => store.accountNames.map((n) => ({ label: n, value: n })))
const tokenOptions = computed(() => tokens.value.map((t) => ({ label: t, value: t })))

// Hiển thị tên tài khoản theo màu badge trong dropdown lọc
const renderAccountLabel = (option) => h(AccountBadge, { name: option.value, size: 'small' })

const rows = computed(() =>
  store.rewards
    .filter((r) => !filterAccount.value || r.account === filterAccount.value)
    .filter((r) => !filterToken.value || r.token === filterToken.value)
    .sort((a, b) => (b.date || '').localeCompare(a.date || '')),
)

const total = computed(() => rows.value.reduce((s, r) => s + r.amount, 0))

const page = ref(1)
const pageSize = ref(20)
const pageSizeOptions = [10, 20, 50, 100]

const pagedRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return rows.value.slice(start, start + pageSize.value)
})

// Quay về trang 1 khi lọc hoặc số dòng thay đổi
watch([filterAccount, filterToken, pageSize], () => {
  page.value = 1
})

async function remove(r) {
  const ok = await confirmDialog({
    title: 'Xoá phần thưởng',
    content: 'Xoá phần thưởng này?',
    positiveText: 'Xoá',
  })
  if (ok) await store.deleteReward(r.id)
}
</script>

<template>
  <n-space justify="space-between" align="center" style="margin-bottom: 18px" :wrap="true">
    <n-h2 style="margin: 0">🎁 Phần thưởng</n-h2>
    <n-space :size="10">
      <n-select
        v-model:value="filterAccount"
        :options="accountOptions"
        :render-label="renderAccountLabel"
        placeholder="Lọc theo tài khoản"
        clearable
        size="small"
        style="width: 200px"
      />
      <n-select
        v-model:value="filterToken"
        :options="tokenOptions"
        placeholder="Lọc theo token"
        clearable
        size="small"
        style="width: 180px"
      />
    </n-space>
  </n-space>

  <n-grid cols="2" :x-gap="14" style="margin-bottom: 18px">
    <n-gi>
      <n-card size="small"><n-statistic label="Số phần thưởng" :value="rows.length" /></n-card>
    </n-gi>
    <n-gi>
      <n-card size="small">
        <n-statistic label="Tổng (theo lọc)">
          <span class="green">{{ fmtUSDT(total) }}</span>
        </n-statistic>
      </n-card>
    </n-gi>
  </n-grid>

  <n-card size="small">
    <n-spin :show="store.loading">
      <div class="table-wrap">
        <n-table v-if="rows.length" :bordered="false" :single-line="false" striped size="small">
          <thead>
            <tr>
              <th>Ngày nhận</th>
              <th>Tài khoản</th>
              <th>Chu kì</th>
              <th>Token</th>
              <th class="right">Số tiền</th>
              <th>Ghi chú</th>
              <th class="right"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in pagedRows" :key="r.id">
              <td>{{ fmtDate(r.date) }}</td>
              <td class="acc-col"><AccountBadge :name="r.account" /></td>
              <td class="muted">{{ cycleLabel[r.cycleId] || '—' }}</td>
              <td>
                <n-tag v-if="r.token" size="tiny" :bordered="false">{{ r.token }}</n-tag>
                <n-tag v-if="r.estimated" size="tiny" :bordered="false" type="warning">
                  ước lượng
                </n-tag>
              </td>
              <td class="right green">+{{ fmtUSDT(r.amount) }}</td>
              <td class="muted">{{ r.note }}</td>
              <td class="right">
                <n-button size="tiny" secondary type="error" @click="remove(r)">Xoá</n-button>
              </td>
            </tr>
          </tbody>
        </n-table>
        <n-empty v-else description="Chưa có phần thưởng. Thêm từ trang Chu kì." />
      </div>
      <div v-if="rows.length > pageSizeOptions[0]" style="display: flex; justify-content: flex-end; margin-top: 14px">
        <n-pagination
          v-model:page="page"
          v-model:page-size="pageSize"
          :item-count="rows.length"
          :page-sizes="pageSizeOptions"
          show-size-picker
          size="small"
        />
      </div>
    </n-spin>
  </n-card>
</template>

<style scoped>
/* Căn giữa toàn bộ nội dung trong bảng phần thưởng */
.table-wrap :deep(th),
.table-wrap :deep(td) {
  text-align: center !important;
}
/* Cột tài khoản căn trái */
.table-wrap :deep(th.acc-col),
.table-wrap :deep(td.acc-col) {
  text-align: left !important;
}
</style>
