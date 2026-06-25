<script setup>
// Phí vs Thưởng theo đợt (bar nhóm). Nhận `batches` đã sort tăng dần theo startDate.
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import { cssVar, withAlpha } from '@/services/charts'
import { fmtUSDT, fmtDate } from '@/utils/format'

const props = defineProps({
  batches: { type: Array, default: () => [] }, // [{ startDate, fee, reward, ... }]
})

const chartData = computed(() => {
  const green = cssVar('--green', '#128a5e')
  const dim = cssVar('--text-dim', '#69737e')
  return {
    labels: props.batches.map((b) => fmtDate(b.startDate)),
    datasets: [
      {
        label: 'Phí',
        data: props.batches.map((b) => Number(b.fee.toFixed(2))),
        backgroundColor: withAlpha(dim, '99'),
        borderRadius: 4,
      },
      {
        label: 'Thưởng',
        data: props.batches.map((b) => Number(b.reward.toFixed(2))),
        backgroundColor: green,
        borderRadius: 4,
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
      legend: { labels: { color: dim, boxWidth: 12 } },
      tooltip: {
        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmtUSDT(ctx.parsed.y)}` },
      },
    },
    scales: {
      x: { ticks: { color: dim }, grid: { display: false } },
      y: { ticks: { color: dim, callback: (v) => fmtUSDT(v) }, grid: { color: border } },
    },
  }
})
</script>

<template>
  <div class="chart-box"><Bar :data="chartData" :options="options" /></div>
</template>

<style scoped>
.chart-box {
  height: 240px;
}
</style>
