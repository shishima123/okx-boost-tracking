// Tiện ích định dạng số, tiền tệ và ngày tháng

// Chuyển hex (#RRGGBB) -> object màu cho n-tag: nền mờ + chữ & viền theo màu đã chọn.
// Không có màu -> undefined (n-tag dùng style mặc định).
export function tagColorFromHex(hex) {
  if (!hex) return undefined
  return { color: `${hex}2e`, textColor: hex, borderColor: `${hex}66` }
}

// Đổi Firestore Timestamp (hoặc số ms) sang mili-giây để sắp xếp. Thiếu → 0.
export function tsMillis(v) {
  if (!v) return 0
  if (typeof v.toMillis === 'function') return v.toMillis()
  if (typeof v.seconds === 'number') return v.seconds * 1000
  if (typeof v === 'number') return v
  return 0
}

export function toNumber(v) {
  if (v === null || v === undefined || v === '') return 0
  const n = Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function fmtUSDT(v, digits = 2) {
  const n = toNumber(v)
  return n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function fmtPct(v, digits = 1) {
  const n = toNumber(v) * 100
  return `${n >= 0 ? '' : ''}${n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`
}

// Lớp màu theo giá trị âm/dương
export function signClass(v) {
  const n = toNumber(v)
  if (n > 0) return 'green'
  if (n < 0) return 'red'
  return 'muted'
}

// ---- Ngày tháng: dùng chuỗi ISO YYYY-MM-DD trên sheet ----

// Định dạng ISO YYYY-MM-DD theo ngày ĐỊA PHƯƠNG (không dùng toISOString để
// tránh lệch múi giờ — toISOString trả về UTC, ở UTC+7 sẽ lùi 1 ngày).
function toLocalISO(d) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function todayISO() {
  return toLocalISO(new Date())
}

export function addDays(iso, days) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + Number(days || 0))
  return toLocalISO(d)
}

// Số ngày còn lại tính từ hôm nay tới ngày kết thúc (âm = đã qua)
export function daysLeft(endIso) {
  if (!endIso) return null
  const end = new Date(endIso + 'T00:00:00')
  const now = new Date(todayISO() + 'T00:00:00')
  return Math.round((end - now) / 86400000)
}

// Hiển thị ngày gọn: dd/mm
export function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d)) return iso
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

// Trạng thái chu kì dựa trên số ngày còn lại.
// state: 'active' | 'ended' | 'unknown' (dùng để lọc/ẩn).
export function cycleStatus(endIso) {
  const left = daysLeft(endIso)
  if (left === null)
    return { state: 'unknown', label: 'Không rõ', cls: 'muted', left, detail: '', leftCls: 'muted' }
  if (left < 0)
    return {
      state: 'ended',
      label: 'Đã kết thúc',
      cls: 'muted',
      left,
      detail: `quá ${-left} ngày`,
      leftCls: 'muted',
    }
  // Tô màu text "còn lại": hôm nay = đỏ, ≤2 ngày = vàng, còn lại = xanh
  let leftCls = 'green'
  if (left === 0) leftCls = 'red'
  else if (left <= 2) leftCls = 'yellow'
  return {
    state: 'active',
    label: 'Đang hoạt động',
    cls: left === 0 ? 'yellow' : 'green',
    left,
    detail: left === 0 ? 'hôm nay' : `còn ${left} ngày`,
    leftCls,
  }
}

// ---- Màu dùng chung cho bảng (inline style để thắng CSS của naive-ui table) ----
const CLS_COLORS = {
  red: 'var(--red)',
  yellow: 'var(--yellow)',
  green: 'var(--green)',
  muted: 'var(--text-dim)',
}
// class màu ('green'|'red'|'yellow'|'muted') -> giá trị CSS color
export const clsColor = (cls) => CLS_COLORS[cls] || 'var(--text-dim)'

// class màu -> type của n-tag (badge trạng thái)
const CLS_TAG_TYPE = { green: 'success', yellow: 'warning', red: 'error', muted: 'default' }
export const tagType = (cls) => CLS_TAG_TYPE[cls] || 'default'
