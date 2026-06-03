// Cầu nối tới message/dialog của Naive UI dùng được cả ngoài component (vd trong store).
// createDiscreteApi không cần provider, dùng theme sáng cho khớp app.
import { createDiscreteApi, lightTheme } from 'naive-ui'

const { message, dialog } = createDiscreteApi(['message', 'dialog'], {
  configProviderProps: { theme: lightTheme },
})

export { message, dialog }

export const toastSuccess = (m) => message.success(m)
export const toastError = (m) => message.error(m, { duration: 6000 })
export const toastInfo = (m) => message.info(m)

// Hộp thoại xác nhận → trả Promise<boolean>. type: 'warning' | 'info' | 'error' | 'success'
export function confirmDialog({
  title = 'Xác nhận',
  content = '',
  positiveText = 'Đồng ý',
  type = 'warning',
} = {}) {
  return new Promise((resolve) => {
    dialog[type]({
      title,
      content,
      positiveText,
      negativeText: 'Huỷ',
      onPositiveClick: () => resolve(true),
      onNegativeClick: () => resolve(false),
      onClose: () => resolve(false),
      onMaskClick: () => resolve(false),
    })
  })
}
