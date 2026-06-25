<script setup>
// ROI theo đợt (line, trục %). Nhận `batches` đã sort tăng dần theo startDate.
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import { cssVar, withAlpha } from '@/services/charts'
import { fmtPct, fmtDate } from '@/utils/format'

const props = defineProps({
  batches: { type: Array, default: () => [] }, // [{ startDate, roi, ... }]
})

const chartData = computed(() => {
  const yellow = cssVar('--yellow', '#b07d09')
  return {
    labels: props.batches.map((b) => fmtDate(b.startDate)),
    datasets: [
      {
        label: 'ROI',
        data: props.batches.map((b) => Number((b.roi * 100).toFixed(2))),
        borderColor: yellow,
        backgroundColor: withAlpha(yellow, '24'),
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
        callbacks: { label: (ctx) => `ROI: ${fmtPct(ctx.parsed.y / 100)}` },
      },
    },
    scales: {
      x: { ticks: { color: dim }, grid: { display: false } },
      y: { ticks: { color: dim, callback: (v) => `${v}%` }, grid: { color: border } },
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
