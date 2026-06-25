<script setup>
// Phân bổ thưởng theo token (doughnut). Nhận `tokens` = [{ token, amount, count }].
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import { cssVar, palette } from '@/services/charts'
import { fmtUSDT } from '@/utils/format'

const props = defineProps({
  tokens: { type: Array, default: () => [] },
})

const chartData = computed(() => {
  const colors = palette()
  return {
    labels: props.tokens.map((t) => t.token),
    datasets: [
      {
        data: props.tokens.map((t) => Number(t.amount.toFixed(2))),
        backgroundColor: props.tokens.map((_, i) => colors[i % colors.length]),
        borderColor: cssVar('--bg-card', '#f4f6f9'),
        borderWidth: 2,
      },
    ],
  }
})

const total = computed(() => props.tokens.reduce((s, t) => s + t.amount, 0))

const options = computed(() => {
  const dim = cssVar('--text-dim', '#69737e')
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      legend: { position: 'right', labels: { color: dim, boxWidth: 12 } },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const pct = total.value ? (ctx.parsed / total.value) * 100 : 0
            return `${ctx.label}: ${fmtUSDT(ctx.parsed)} (${pct.toFixed(1)}%)`
          },
        },
      },
    },
  }
})
</script>

<template>
  <div class="chart-box"><Doughnut :data="chartData" :options="options" /></div>
</template>

<style scoped>
.chart-box {
  height: 240px;
}
</style>
