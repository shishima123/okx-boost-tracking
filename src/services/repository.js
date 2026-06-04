// Lớp dữ liệu trên Cloud Firestore: 3 collection accounts / cycles / rewards.
// Mỗi document dùng id tự sinh của Firestore; field giữ nguyên dạng object JS.
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'

const toObj = (d) => ({ id: d.id, ...d.data() })

// Thêm document mới kèm dấu thời gian tạo (server timestamp)
const create = (name, data) =>
  addDoc(collection(db, name), { ...data, createdAt: serverTimestamp() })

// Lắng nghe realtime; trả về hàm unsubscribe.
function subscribe(name, cb, onError) {
  return onSnapshot(
    collection(db, name),
    (snap) => cb(snap.docs.map(toObj)),
    (err) => onError && onError(err),
  )
}

// ---------- Accounts ----------
export const subscribeAccounts = (cb, onErr) => subscribe('accounts', cb, onErr)
export const addAccount = (data) => create('accounts', data)
export const updateAccount = (id, data) => updateDoc(doc(db, 'accounts', id), data)
export const deleteAccount = (id) => deleteDoc(doc(db, 'accounts', id))

// Ghi lại thứ tự cho danh sách tài khoản theo mảng id (order = vị trí).
export function reorderAccounts(ids) {
  const batch = writeBatch(db)
  ids.forEach((id, i) => batch.update(doc(db, 'accounts', id), { order: i }))
  return batch.commit()
}

// ---------- Cycles ----------
export const subscribeCycles = (cb, onErr) => subscribe('cycles', cb, onErr)
export const addCycle = (data) => create('cycles', data)
export const updateCycle = (id, data) => updateDoc(doc(db, 'cycles', id), data)
export const deleteCycle = (id) => deleteDoc(doc(db, 'cycles', id))

// Xoá chu kì kèm các phần thưởng liên kết (1 batch atomic). rewardIds rỗng = chỉ xoá chu kì.
export function deleteCycleWithRewards(cycleId, rewardIds = []) {
  const batch = writeBatch(db)
  rewardIds.forEach((rid) => batch.delete(doc(db, 'rewards', rid)))
  batch.delete(doc(db, 'cycles', cycleId))
  return batch.commit()
}

// ---------- Rewards ----------
export const subscribeRewards = (cb, onErr) => subscribe('rewards', cb, onErr)
export const addReward = (data) => create('rewards', data)
export const updateReward = (id, data) => updateDoc(doc(db, 'rewards', id), data)
export const deleteReward = (id) => deleteDoc(doc(db, 'rewards', id))
