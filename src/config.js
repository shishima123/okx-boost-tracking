// Cấu hình ứng dụng. Kết nối Firebase đọc trong services/firebase.js (VITE_FIREBASE_*).
// File này chỉ giữ các giá trị mặc định cục bộ (localStorage).

// Giá trị mặc định khi tạo chu kì mới (lưu localStorage)
// defaultFee = phí gốc; defaultRebate = hoàn phí. Phí cuối = phí gốc - hoàn phí.
const LS_DEFAULTS = 'okx_boost_defaults'
const DEFAULTS = { cycleLengthDays: 10, defaultFee: 30, defaultRebate: 0 }

export function getDefaults() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LS_DEFAULTS) || '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

export function setDefaults(d) {
  localStorage.setItem(LS_DEFAULTS, JSON.stringify({ ...getDefaults(), ...d }))
}
