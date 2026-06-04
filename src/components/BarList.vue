<script setup>
// Biểu đồ thanh ngang tối giản (không cần thư viện ngoài).
// - signed=true: thanh tô xanh/đỏ theo dấu giá trị (vd lợi nhuận theo đợt).
// - signed=false: thanh dùng màu nhấn (vd thưởng theo token).
import { computed } from 'vue'

const props = defineProps({
  items: { type: Array, default: () => [] }, // [{ label, value, sub?, color? }]
  signed: { type: Boolean, default: false },
  format: { type: Function, default: (v) => String(v) },
})

const max = computed(() => Math.max(1, ...props.items.map((i) => Math.abs(i.value || 0))))
const width = (v) => `${(Math.abs(v || 0) / max.value) * 100}%`
</script>

<template>
  <div class="barlist">
    <div v-for="(it, idx) in items" :key="idx" class="row">
      <div class="lbl" :title="it.label">{{ it.label }}</div>
      <div class="track">
        <div
          class="bar"
          :class="signed ? (it.value >= 0 ? 'pos' : 'neg') : 'accent'"
          :style="{
            width: width(it.value),
            background: !signed && it.color ? it.color : undefined,
          }"
        />
      </div>
      <div class="val" :class="signed ? (it.value >= 0 ? 'green' : 'red') : ''">
        {{ format(it.value) }}<span v-if="it.sub" class="muted sub">{{ it.sub }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.barlist {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.row {
  display: grid;
  grid-template-columns: 96px 1fr auto;
  align-items: center;
  gap: 10px;
}
.lbl {
  font-size: 12px;
  color: var(--text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.track {
  background: var(--bg-soft);
  border-radius: 6px;
  height: 14px;
  overflow: hidden;
}
.bar {
  height: 100%;
  border-radius: 6px;
  min-width: 2px;
  transition: width 0.35s ease;
}
.bar.pos {
  background: var(--green);
}
.bar.neg {
  background: var(--red);
}
.bar.accent {
  background: var(--accent);
}
.val {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  text-align: right;
}
.val .sub {
  font-weight: 400;
  margin-left: 6px;
}
</style>
