<script setup>
// Lợi nhuận TÍCH LŨY theo đợt (line/area). Nhận `batches` đã sort tăng dần theo startDate.
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import { cssVar, withAlpha } from '@/services/charts'
import { fmtUSDT, fmtDate } from '@/utils/format'

const props = defineProps({
  batches: { type: Array, default: () => [] }, // [{ startDate, profit, ... }]
})

const chartData = computed(() => {
  const accent = cssVar('--accent', '#3b74ff')
  let run = 0
  const labels = []
  const data = []
  for (const b of props.batches) {
    run += b.profit
    labels.push(fmtDate(b.startDate))
    data.push(Number(run.toFixed(2)))
  }
  return {
    labels,
    datasets: [
      {
        label: 'Lợi nhuận tích lũy',
        data,
        borderColor: accent,
        backgroundColor: withAlpha(accent, '24'),
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
    ],
  }
})

const options = computed(() => {
  const dim = cssVar('--text-dim', '#69737e')
  const border = cssVar('--border', '#cdd5de')
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: (ctx) => `Lũy kế: ${fmtUSDT(ctx.parsed.y)}` },
      },
    },
    scales: {
      x: { ticks: { color: dim }, grid: { color: border, display: false } },
      y: { ticks: { color: dim, callback: (v) => fmtUSDT(v) }, grid: { color: border } },
    },
  }
})
</script>

<template>
  <div class="chart-box"><Line :data="chartData" :options="options" /></div>
</template>

<style scoped>
.chart-box {
  height: 240px;
}
</style>
