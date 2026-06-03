// Tiện ích định dạng số, tiền tệ và ngày tháng

// Bảng màu cho nhóm (dùng cho n-tag :color). Tự gán theo tên nhóm.
const GROUP_PALETTE = [
  { color: 'rgba(22,82,240,0.18)', textColor: '#7aa2ff' },
  { color: 'rgba(22,199,132,0.18)', textColor: '#37d39b' },
  { color: 'rgba(240,185,11,0.18)', textColor: '#f0c64a' },
  { color: 'rgba(234,57,67,0.18)', textColor: '#ff6b73' },
  { color: 'rgba(168,85,247,0.18)', textColor: '#c79bff' },
  { color: 'rgba(20,184,166,0.18)', textColor: '#3fd0c0' },
  { color: 'rgba(244,114,22,0.18)', textColor: '#ff9b52' },
  { color: 'rgba(236,72,153,0.18)', textColor: '#ff7ac0' },
  { color: 'rgba(99,102,241,0.18)', textColor: '#a3a6ff' },
  { color: 'rgba(132,204,22,0.18)', textColor: '#aee44f' },
]

// Trả về object màu cho n-tag dựa trên tên nhóm (cùng tên → cùng màu).
export function groupColor(name) {
  if (!name) return undefined
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return GROUP_PALETTE[h % GROUP_PALETTE.length]
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

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export function addDays(iso, days) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + Number(days || 0))
  return d.toISOString().slice(0, 10)
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
  if (left === null) return { state: 'unknown', label: 'Không rõ', cls: 'muted', left, detail: '' }
  if (left < 0) return { state: 'ended', label: 'Đã kết thúc', cls: 'muted', left, detail: '' }
  return {
    state: 'active',
    label: 'Đang hoạt động',
    cls: left === 0 ? 'yellow' : 'green',
    left,
    detail: left === 0 ? 'hôm nay' : `còn ${left} ngày`,
  }
}
