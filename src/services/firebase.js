// Khởi tạo Firebase (Auth + Firestore). Cấu hình đọc từ biến môi trường Vite.
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
// ignoreUndefinedProperties: bản ghi cũ (chưa di trú) thiếu accountId/note — khi
// thêm/sửa thưởng, code gửi field undefined và Firestore mặc định sẽ throw.
// Bật cờ này để bỏ qua field undefined thay vì vỡ thao tác ghi.
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true })
