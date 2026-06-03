# OKX Boost Tracker

Ứng dụng web (Vue 3 + Vite + **Naive UI**) để **theo dõi lợi nhuận chương trình OKX
Boost**: quản lý tài khoản, tạo chu kì (cycle), ghi nhận phần thưởng cho từng chu kì
và xem thống kê lợi nhuận / ROI.

Dữ liệu lưu **realtime trên Cloud Firestore**; xác thực bằng **Firebase Auth
(Email/Password)**. Không có server tự quản — frontend nói chuyện trực tiếp với Firebase.

## Tính năng

- 📊 **Tổng quan**: tổng phí, tổng thưởng, lợi nhuận, ROI; tổng hợp theo tài khoản; chu kì đang chạy.
- 🔄 **Chu kì**: tạo nhanh chu kì (tự tính ngày kết thúc), sửa, xoá; mở rộng từng chu kì để
  xem/thêm/xoá phần thưởng tại chỗ.
- 🎁 **Phần thưởng**: danh sách toàn bộ, lọc theo tài khoản / token.
- 👤 **Tài khoản**: quản lý tài khoản và nhóm ví (OKX, OKX Wallet 1, …).
- ⚙️ **Cài đặt**: trạng thái kết nối, giá trị mặc định, đăng xuất.

Mọi thay đổi được đồng bộ realtime (Firestore `onSnapshot`) — không cần bấm làm mới.

## Kiến trúc

| Lớp        | File                          | Vai trò                                            |
| ---------- | ----------------------------- | -------------------------------------------------- |
| Firebase   | `src/services/firebase.js`    | khởi tạo Auth + Firestore từ env                   |
| Auth       | `src/composables/auth.js`     | login/logout Email/Password, `authState`           |
| Repository | `src/services/repository.js`  | subscribe realtime + CRUD 3 collection             |
| State      | `src/stores/boost.js` (Pinia) | dữ liệu realtime + getters thống kê                |
| UI         | `src/views/*`, `src/App.vue`  | Naive UI                                            |

### Mô hình dữ liệu (Firestore — 3 collection)

| Collection | Field (mỗi document)                                       |
| ---------- | --------------------------------------------------------- |
| `accounts` | name, group, note                                        |
| `cycles`   | account, startDate, endDate, fee, note                   |
| `rewards`  | cycleId, account, date, amount, token, note              |

`id` là document id tự sinh của Firestore. Ngày lưu chuỗi `YYYY-MM-DD`. Lợi nhuận mỗi
chu kì = tổng `rewards` (theo `cycleId`) − `fee`.

## Thiết lập Firebase

1. Tạo project tại [Firebase Console](https://console.firebase.google.com/).
2. **Build → Authentication → Sign-in method**: bật **Email/Password**. Sang tab **Users →
   Add user** tạo 1 tài khoản (app không có màn đăng ký).
3. **Build → Firestore Database → Create database** (Production mode).
4. **Project settings → General → Your apps → Web (</>)**: đăng ký app, copy config.
5. Đặt **Security Rules** (Firestore → Rules) yêu cầu đăng nhập:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

## Thiết lập frontend

```sh
cp .env.example .env
# điền 6 biến VITE_FIREBASE_* từ config ở bước 4
npm install
npm run dev      # http://localhost:5173
npm run build
```

### Lần đầu dùng

1. `npm run dev` → màn **Đăng nhập** → nhập email/mật khẩu (tài khoản tạo ở bước 2).
2. **Tài khoản** → thêm tài khoản; **Chu kì** → tạo chu kì & thêm thưởng. Collection tự
   được tạo khi ghi document đầu tiên.

## Công nghệ

Vue 3 (`<script setup>`), Vite, Pinia, Vue Router, Naive UI, Firebase (Auth + Firestore).
