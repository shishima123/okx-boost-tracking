// Đăng ký một lần các thành phần Chart.js mà app dùng (tree-shake: chỉ nạp những gì cần).
// Import file này ở mỗi component chart trước khi render.
import {
  Chart,
  LineElement,
  BarElement,
  ArcElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

Chart.register(
  LineElement,
  BarElement,
  ArcElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
  Filler,
)

// Đọc giá trị biến CSS (vd '--accent') để chart khớp theme. Trả về fallback nếu thiếu.
export function cssVar(name, fallback = '#000') {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

// Thêm alpha (00..ff) vào màu hex #RRGGBB để tạo nền mờ.
export function withAlpha(hex, alpha = '2e') {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? `${hex}${alpha}` : hex
}

// Bảng màu xoay vòng cho doughnut (token) — lấy từ biến theme + vài màu phụ.
export function palette() {
  return [
    cssVar('--accent', '#3b74ff'),
    cssVar('--green', '#128a5e'),
    cssVar('--yellow', '#b07d09'),
    cssVar('--red', '#d62f3a'),
    '#7c5cff',
    '#0ea5a5',
    '#e26a2c',
    '#9333ea',
  ]
}
