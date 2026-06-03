<script setup>
import { reactive, ref, watch } from 'vue'
import {
  NCard,
  NTable,
  NButton,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NColorPicker,
  NSpace,
  NEmpty,
  NSpin,
  NH2,
  NText,
} from 'naive-ui'
import { useBoostStore } from '@/stores/boost'
import { confirmDialog } from '@/composables/feedback'
import AccountBadge from '@/components/AccountBadge.vue'

// Bảng màu gợi ý để chọn nhanh
const COLOR_SWATCHES = [
  '#2080f0',
  '#18a058',
  '#f0a020',
  '#d03050',
  '#8a2be2',
  '#13c2c2',
  '#fa8c16',
  '#eb2f96',
  '#7c4dff',
  '#52c41a',
  '#ff5c66',
  '#f5c451',
  '#21d08f',
  '#9254de',
  '#36cfc9',
]

const store = useBoostStore()

// Bản sao cục bộ để kéo-thả mượt; đồng bộ lại mỗi khi dữ liệu store đổi (và không đang kéo).
const items = ref([])
const dragging = ref(false)
const fromIndex = ref(null)

watch(
  () => store.accounts,
  (v) => {
    if (!dragging.value) items.value = [...v]
  },
  { immediate: true, deep: true },
)

function onDragStart(i) {
  dragging.value = true
  fromIndex.value = i
}
function onDragEnter(i) {
  if (!dragging.value || i === fromIndex.value) return
  const arr = [...items.value]
  const [moved] = arr.splice(fromIndex.value, 1)
  arr.splice(i, 0, moved)
  items.value = arr
  fromIndex.value = i
}
function onDragEnd() {
  if (!dragging.value) return
  dragging.value = false
  fromIndex.value = null
  store.reorderAccounts(items.value.map((a) => a.id))
}

// ----- Thêm / sửa -----
const show = ref(false)
const editingId = ref(null)
const form = reactive({ name: '', color: '', note: '' })

function openCreate() {
  editingId.value = null
  Object.assign(form, { name: '', color: '', note: '' })
  show.value = true
}
function openEdit(a) {
  editingId.value = a.id
  Object.assign(form, { name: a.name, color: a.color || '', note: a.note })
  show.value = true
}
async function save() {
  if (!form.name.trim()) return
  const ok = await confirmDialog({
    title: editingId.value ? 'Lưu tài khoản' : 'Thêm tài khoản',
    content: editingId.value
      ? `Lưu thay đổi cho "${form.name.trim()}"?`
      : `Thêm tài khoản "${form.name.trim()}"?`,
    positiveText: editingId.value ? 'Lưu' : 'Thêm',
    type: 'info',
  })
  if (!ok) return
  const data = {
    name: form.name.trim(),
    color: form.color || '',
    note: (form.note || '').trim(),
  }
  if (editingId.value) {
    await store.updateAccount(editingId.value, data)
  } else {
    // Đặt order kế tiếp để tài khoản mới nằm cuối danh sách
    const maxOrder = store.accounts.reduce((m, a) => Math.max(m, a.order ?? -1), -1)
    await store.addAccount({ ...data, order: maxOrder + 1 })
  }
  show.value = false
}
async function remove(a) {
  const ok = await confirmDialog({
    title: 'Xoá tài khoản',
    content: `Xoá tài khoản "${a.name}"? (Chu kì/thưởng liên quan vẫn còn)`,
    positiveText: 'Xoá',
  })
  if (ok) await store.deleteAccount(a.id)
}
</script>

<template>
  <n-space justify="space-between" align="center" style="margin-bottom: 18px">
    <n-h2 style="margin: 0">👤 Danh sách tài khoản</n-h2>
    <n-button type="primary" @click="openCreate">+ Thêm tài khoản</n-button>
  </n-space>

  <n-card size="small">
    <n-text depth="3" style="font-size: 12px; display: block; margin-bottom: 8px">
      Kéo biểu tượng ⠿ để sắp xếp lại thứ tự (tự lưu).
    </n-text>
    <n-spin :show="store.loading">
      <div class="table-wrap">
        <n-table v-if="items.length" :bordered="false" :single-line="false" striped size="small">
          <thead>
            <tr>
              <th style="width: 48px" class="center">STT</th>
              <th style="width: 36px"></th>
              <th>Tên tài khoản</th>
              <th>Ghi chú</th>
              <th class="right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(a, i) in items"
              :key="a.id"
              draggable="true"
              class="drag-row"
              :class="{ dragging: dragging && fromIndex === i }"
              @dragstart="onDragStart(i)"
              @dragenter="onDragEnter(i)"
              @dragover.prevent
              @dragend="onDragEnd"
              @drop.prevent="onDragEnd"
            >
              <td class="center muted">{{ i + 1 }}</td>
              <td class="handle" title="Kéo để sắp xếp">⠿</td>
              <td><AccountBadge :name="a.name" /></td>
              <td class="muted">{{ a.note }}</td>
              <td class="right nowrap">
                <n-space :size="6" justify="end" :wrap="false">
                  <n-button size="tiny" quaternary @click="openEdit(a)">Sửa</n-button>
                  <n-button size="tiny" quaternary type="error" @click="remove(a)">Xoá</n-button>
                </n-space>
              </td>
            </tr>
          </tbody>
        </n-table>
        <n-empty v-else description="Chưa có tài khoản nào. Bấm “Thêm tài khoản”." />
      </div>
    </n-spin>
  </n-card>

  <n-modal
    v-model:show="show"
    preset="card"
    :title="editingId ? 'Sửa tài khoản' : 'Thêm tài khoản'"
    style="max-width: 420px"
  >
    <n-form>
      <n-form-item label="Tên tài khoản">
        <n-input v-model:value="form.name" placeholder="VD: hieutstl 1" />
      </n-form-item>
      <n-form-item label="Màu badge">
        <n-color-picker
          v-model:value="form.color"
          :swatches="COLOR_SWATCHES"
          :modes="['hex']"
          :show-alpha="false"
        />
      </n-form-item>
      <n-form-item label="Ghi chú">
        <n-input v-model:value="form.note" placeholder="Tuỳ chọn" />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-space justify="end">
        <n-button @click="show = false">Huỷ</n-button>
        <n-button
          type="primary"
          :loading="store.saving"
          :disabled="!form.name.trim()"
          @click="save"
        >
          Lưu
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<style scoped>
.drag-row.dragging {
  opacity: 0.5;
  background: var(--bg-soft);
}
.handle {
  cursor: grab;
  color: var(--text-dim);
  font-size: 18px;
  user-select: none;
  text-align: center;
}
.handle:active {
  cursor: grabbing;
}
</style>
