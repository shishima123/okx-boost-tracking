<script setup>
import { computed, ref } from 'vue'
import {
  NCard,
  NTable,
  NTag,
  NSpace,
  NH2,
  NText,
  NAlert,
  NDatePicker,
  NInputNumber,
  NButton,
  NModal,
} from 'naive-ui'
import { todayISO, addDays, fmtDate, clsColor, tagType } from '@/utils/format'
import { getDefaults } from '@/config'

const defaults = getDefaults()

// Điều khiển: ngày bắt đầu tính & độ dài chu kì
const fromDate = ref(todayISO())
const cycleLength = ref(defaults.cycleLengthDays)

// Tên thứ theo getDay(): 0 = CN … 6 = T7
const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const WEEKDAY_FULL = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

// Đếm số ngày T7/CN (không có sự kiện thưởng) trong chu kì `len` ngày.
// Ngày trade KHÔNG tính — phần thưởng bắt đầu từ ngày HÔM SAU, nên đếm từ iso + 1.
// Nhờ vậy trade chủ nhật vẫn tối ưu (bỏ qua CN, ăn kèo thứ 2).
function weekendDaysFrom(iso, len) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  let count = 0
  for (let i = 0; i < len; i++) {
    const wd = d.getDay()
    if (wd === 0 || wd === 6) count++
    d.setDate(d.getDate() + 1)
  }
  return count
}

// Xếp loại chất lượng dựa trên số ngày nghỉ so với mức tốt nhất có thể.
function quality(weekendDays, best) {
  if (weekendDays <= best) return { cls: 'green', label: 'Tối ưu' }
  if (weekendDays <= best + 1) return { cls: 'yellow', label: 'Khá' }
  return { cls: 'red', label: 'Nên tránh' }
}

// Số ngày nghỉ ít nhất có thể đạt được trên 7 thứ trong tuần (để làm mốc xếp loại)
const bestWeekend = computed(() => {
  let min = Infinity
  for (let i = 0; i < 7; i++) {
    min = Math.min(min, weekendDaysFrom(addDays(fromDate.value, i), cycleLength.value))
  }
  return min
})

// Xếp hạng 7 thứ trong tuần theo số ngày nghỉ (ít nhất → nhiều nhất)
const weekdayRank = computed(() => {
  // Lấy 7 ngày liên tiếp kể từ fromDate để phủ đủ 7 thứ, gom theo getDay()
  const seen = {}
  for (let i = 0; i < 7; i++) {
    const iso = addDays(fromDate.value, i)
    const wd = new Date(iso + 'T00:00:00').getDay()
    if (seen[wd] === undefined) {
      const weekend = weekendDaysFrom(iso, cycleLength.value)
      seen[wd] = {
        wd,
        label: WEEKDAY_FULL[wd],
        weekend,
        rewardDays: cycleLength.value - weekend,
      }
    }
  }
  return Object.values(seen)
    .map((r) => ({ ...r, q: quality(r.weekend, bestWeekend.value) }))
    .sort((a, b) => a.weekend - b.weekend || a.rewardDays - b.rewardDays)
})

// Danh sách ngày bắt đầu cụ thể sắp tới (14 ngày kể từ fromDate)
const upcoming = computed(() =>
  Array.from({ length: 14 }, (_, i) => {
    const iso = addDays(fromDate.value, i)
    const wd = new Date(iso + 'T00:00:00').getDay()
    const weekend = weekendDaysFrom(iso, cycleLength.value)
    return {
      iso,
      wdLabel: WEEKDAY_LABELS[wd],
      isWeekendStart: wd === 0 || wd === 6,
      endDate: addDays(iso, cycleLength.value),
      weekend,
      rewardDays: cycleLength.value - weekend,
      q: quality(weekend, bestWeekend.value),
    }
  }),
)

// Gợi ý: các thứ tối ưu (ngày nghỉ ít nhất)
const bestWeekdayLabels = computed(() =>
  weekdayRank.value.filter((r) => r.weekend === bestWeekend.value).map((r) => r.label),
)

// ----- Lịch trực quan cho 1 chu kì -----
const showCalendar = ref(false)
const selectedStart = ref(todayISO())
const WEEK_HEADER = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

function openCalendar(iso) {
  selectedStart.value = iso || fromDate.value
  showCalendar.value = true
}

// Sinh các ô lịch phủ trọn chu kì (canh theo tuần T2 → CN).
const calendar = computed(() => {
  const start = selectedStart.value
  const winStart = addDays(start, 1) // thưởng tính từ hôm sau
  const winEnd = addDays(start, cycleLength.value)
  const startDow = new Date(start + 'T00:00:00').getDay() // 0 = CN … 6 = T7
  const endDow = new Date(winEnd + 'T00:00:00').getDay()
  const gridStart = addDays(start, -((startDow + 6) % 7)) // lùi về thứ 2
  const gridEnd = addDays(winEnd, (7 - endDow) % 7) // tiến tới chủ nhật

  const cells = []
  let iso = gridStart
  let guard = 0
  while (iso <= gridEnd && guard < 90) {
    const d = new Date(iso + 'T00:00:00')
    const wd = d.getDay()
    const weekend = wd === 0 || wd === 6
    const inWindow = iso >= winStart && iso <= winEnd
    let type = 'out'
    if (iso === start) type = 'trade'
    else if (inWindow && weekend) type = 'rest'
    else if (inWindow) type = 'reward'
    cells.push({ iso, day: d.getDate(), type })
    iso = addDays(iso, 1)
    guard++
  }
  return { cells, winEnd }
})
</script>

<template>
  <n-space justify="space-between" align="center" style="margin-bottom: 18px" :wrap="true">
    <n-h2 style="margin: 0">📅 Gợi ý ngày trade</n-h2>
    <n-space align="center" :size="14">
      <n-space align="center" :size="6">
        <n-text depth="3" style="font-size: 13px">Tính từ ngày</n-text>
        <n-date-picker
          v-model:formatted-value="fromDate"
          value-format="yyyy-MM-dd"
          type="date"
          size="small"
          style="width: 150px"
        />
      </n-space>
      <n-space align="center" :size="6">
        <n-text depth="3" style="font-size: 13px">Số ngày / chu kì</n-text>
        <n-input-number
          v-model:value="cycleLength"
          :min="1"
          :max="60"
          :input-props="{ inputmode: 'numeric' }"
          size="small"
          style="width: 110px"
        />
      </n-space>
      <n-button secondary size="small" @click="openCalendar()">📆 Xem lịch</n-button>
    </n-space>
  </n-space>

  <n-alert type="info" :show-icon="true" style="margin-bottom: 16px">
    Mỗi chu kì kéo dài <b>{{ cycleLength }} ngày</b>, nhưng <b>thứ 7 &amp; chủ nhật không có sự kiện
    thưởng</b>. Ngày trade không tính — thưởng bắt đầu từ <b>hôm sau</b> (nên trade chủ nhật vẫn tối
    ưu, bỏ qua CN và ăn kèo thứ 2). Bắt đầu vào <b>{{ bestWeekdayLabels.join(', ') }}</b> chỉ vướng
    <b>{{ bestWeekend }} ngày nghỉ</b> — ít nhất có thể, tức nhiều ngày có thưởng nhất.
  </n-alert>

  <!-- Lịch trực quan cho chu kì đã chọn (modal) -->
  <n-modal
    v-model:show="showCalendar"
    preset="card"
    title="📆 Lịch chu kì"
    style="max-width: 460px"
  >
    <n-text depth="3" style="font-size: 13px; display: block; margin-bottom: 14px">
      {{ fmtDate(selectedStart) }} → {{ fmtDate(calendar.winEnd) }}
    </n-text>
    <div class="cal-legend">
      <span><i class="dot trade"></i> Ngày trade (không tính)</span>
      <span><i class="dot reward"></i> Ngày có thưởng</span>
      <span><i class="dot rest"></i> Nghỉ (T7/CN)</span>
    </div>
    <div class="cal-grid">
      <div v-for="h in WEEK_HEADER" :key="h" class="cal-head">{{ h }}</div>
      <div v-for="c in calendar.cells" :key="c.iso" class="cal-cell" :class="c.type">
        {{ c.day }}
      </div>
    </div>
  </n-modal>

  <n-card title="Xếp hạng theo thứ bắt đầu" size="small" style="margin-bottom: 16px">
    <div class="table-wrap">
      <n-table :bordered="false" :single-line="false" striped size="small">
        <thead>
          <tr>
            <th>Hạng</th>
            <th>Bắt đầu vào</th>
            <th class="center">Ngày có thưởng</th>
            <th class="center">Ngày nghỉ (T7/CN)</th>
            <th>Đánh giá</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in weekdayRank" :key="r.wd">
            <td class="nowrap">
              <span v-if="i === 0" class="rank">🥇</span>
              <span v-else>{{ i + 1 }}</span>
            </td>
            <td class="bold">{{ r.label }}</td>
            <td class="center bold" :style="{ color: clsColor('green') }">{{ r.rewardDays }}</td>
            <td class="center" :style="{ color: clsColor(r.weekend > bestWeekend ? 'red' : 'muted') }">
              {{ r.weekend }}
            </td>
            <td>
              <n-tag size="small" round :bordered="false" :type="tagType(r.q.cls)">
                {{ r.q.label }}
              </n-tag>
            </td>
          </tr>
        </tbody>
      </n-table>
    </div>
  </n-card>

  <n-card title="Ngày bắt đầu cụ thể sắp tới (14 ngày)" size="small">
    <div class="table-wrap">
      <n-table :bordered="false" :single-line="false" striped size="small">
        <thead>
          <tr>
            <th>Ngày bắt đầu</th>
            <th>Thứ</th>
            <th>Kết thúc</th>
            <th class="center">Ngày có thưởng</th>
            <th class="center">Ngày nghỉ</th>
            <th>Đánh giá</th>
            <th class="right">Lịch</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in upcoming" :key="row.iso">
            <td class="nowrap bold">{{ fmtDate(row.iso) }}</td>
            <td>
              <span :class="{ muted: row.isWeekendStart }">{{ row.wdLabel }}</span>
            </td>
            <td class="nowrap">{{ fmtDate(row.endDate) }}</td>
            <td class="center bold" :style="{ color: clsColor('green') }">{{ row.rewardDays }}</td>
            <td class="center" :style="{ color: clsColor(row.weekend > bestWeekend ? 'red' : 'muted') }">
              {{ row.weekend }}
            </td>
            <td>
              <n-tag size="small" round :bordered="false" :type="tagType(row.q.cls)">
                {{ row.q.label }}
              </n-tag>
            </td>
            <td class="right">
              <n-button size="tiny" quaternary @click="openCalendar(row.iso)">📆 Xem</n-button>
            </td>
          </tr>
        </tbody>
      </n-table>
    </div>
  </n-card>
</template>

<style scoped>
.rank {
  font-size: 15px;
}
/* naive-ui đặt text-align cho th với ưu tiên cao hơn class global, nên ép lại tại đây */
.table-wrap :deep(th.center),
.table-wrap :deep(td.center) {
  text-align: center;
}

/* ----- Lịch chu kì ----- */
.cal-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 14px;
  font-size: 12px;
  color: var(--text-dim);
}
.cal-legend .dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 3px;
  margin-right: 5px;
  vertical-align: -1px;
}
.cal-legend .dot.trade {
  background: var(--accent);
}
.cal-legend .dot.reward {
  background: var(--green);
}
.cal-legend .dot.rest {
  background: var(--border);
}
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}
.cal-head {
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-dim);
  padding-bottom: 2px;
}
.cal-cell {
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 13px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  color: var(--text);
}
.cal-cell.out {
  opacity: 0.4;
}
.cal-cell.trade {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-weight: 700;
}
.cal-cell.reward {
  background: #128a5e1f;
  border-color: #128a5e66;
  color: var(--green);
  font-weight: 600;
}
.cal-cell.rest {
  background: var(--bg-soft);
  color: var(--text-dim);
  text-decoration: line-through;
}
</style>
