<script setup>
// Badge hiển thị tên tài khoản với màu do người dùng chọn (lưu ở account.color).
// Dùng ở mọi nơi cần render tên tài khoản để đồng nhất.
import { computed } from 'vue'
import { NTag } from 'naive-ui'
import { useBoostStore } from '@/stores/boost'
import { tagColorFromHex } from '@/utils/format'

const props = defineProps({
  name: { type: String, default: '' },
  size: { type: String, default: 'small' },
})

const store = useBoostStore()
const tagColor = computed(() => tagColorFromHex(store.accountColorMap[props.name]))
</script>

<template>
  <n-tag :size="size" round :bordered="false" :color="tagColor">{{ name }}</n-tag>
</template>
