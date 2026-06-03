// Trạng thái xác thực dùng chung, dựa trên Firebase Auth (Email/Password).
import { reactive } from 'vue'
import { signInWithEmailAndPassword, signOut as fbSignOut, onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/services/firebase'

export const authState = reactive({
  ready: false, // đã biết trạng thái đăng nhập lần đầu chưa
  authed: false,
  email: '',
})

// Promise resolve sau lần onAuthStateChanged đầu tiên — dùng cho router guard.
let resolveReady
export const authReady = new Promise((r) => (resolveReady = r))

onAuthStateChanged(auth, (user) => {
  authState.authed = !!user
  authState.email = user?.email || ''
  authState.ready = true
  resolveReady(user)
})

// Chuẩn hoá thông báo lỗi Firebase sang tiếng Việt gọn
function authErrorMessage(code) {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email hoặc mật khẩu không đúng.'
    case 'auth/invalid-email':
      return 'Email không hợp lệ.'
    case 'auth/too-many-requests':
      return 'Thử quá nhiều lần. Vui lòng đợi rồi thử lại.'
    case 'auth/network-request-failed':
      return 'Lỗi mạng. Kiểm tra kết nối.'
    default:
      return 'Đăng nhập thất bại.'
  }
}

export async function login(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: authErrorMessage(e.code) }
  }
}

export async function logout() {
  await fbSignOut(auth)
}
