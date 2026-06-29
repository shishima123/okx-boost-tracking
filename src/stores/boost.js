// Pinia store trung tâm: nắm dữ liệu accounts / cycles / rewards (realtime từ Firestore)
// và các thống kê dẫn xuất.
import { defineStore } from 'pinia'
import * as repo from '@/services/repository'
import { toastError, toastSuccess } from '@/composables/feedback'
import { tsMillis } from '@/utils/format'
import {
  computeRewardsByCycle,
  computeSummary,
  computeByAccount,
  computeBatches,
  computeRewardsByToken,
} from '@/utils/stats'

const byCreatedAt = (a, b) => tsMillis(a.createdAt) - tsMillis(b.createdAt)

// Tên tài khoản hiển thị cho 1 chu kì/phần thưởng: ưu tiên tra theo accountId (luôn cập nhật),
// fallback về tên cũ đã lưu (bản ghi chưa di trú), cuối cùng là nhãn "đã xoá".
function resolveAccountName(item, byId) {
  if (item.accountId && byId[item.accountId]) return byId[item.accountId].name
  return item.account || (item.accountId ? '(tài khoản đã xoá)' : '')
}

export const useBoostStore = defineStore('boost', {
  state: () => ({
    accounts: [],
    cycles: [],
    rewards: [],
    loading: true,
    saving: false,
    error: '',
    includeEstimated: true, // tính cả chu kì "ước lượng" vào thống kê tổng?
    _unsubs: [],
  }),

  getters: {
    // Tổng thưởng theo chu kì (tất cả phần thưởng)
    rewardsByCycle(state) {
      return computeRewardsByCycle(state.rewards, true)
    },

    // Tổng thưởng theo chu kì — bỏ thưởng "ước lượng" khi tắt includeEstimated
    visibleRewardsByCycle(state) {
      return computeRewardsByCycle(state.rewards, this.includeEstimated)
    },

    // Map id tài khoản -> object tài khoản (để suy ra tên/màu hiện tại từ accountId)
    accountById(state) {
      const m = {}
      for (const a of state.accounts) m[a.id] = a
      return m
    },

    cyclesEnriched(state) {
      const byCycle = this.rewardsByCycle
      const byId = this.accountById
      return state.cycles.map((c) => {
        const reward = byCycle[c.id] || 0
        const profit = reward - c.fee
        const roi = c.fee ? profit / c.fee : 0
        const rewardCount = state.rewards.filter((r) => r.cycleId === c.id).length
        // Tên tài khoản luôn suy ra từ accountId (đồng bộ khi đổi tên); fallback tên cũ đã lưu.
        const account = resolveAccountName(c, byId)
        return { ...c, account, reward, profit, roi, rewardCount }
      })
    },

    // Phần thưởng kèm tên tài khoản suy ra động từ accountId (đồng bộ khi đổi tên).
    rewardsEnriched(state) {
      const byId = this.accountById
      return state.rewards.map((r) => ({ ...r, account: resolveAccountName(r, byId) }))
    },

    // Số phần thưởng đang ở trạng thái ước lượng
    estimatedCount(state) {
      return state.rewards.filter((r) => r.estimated).length
    },

    summary(state) {
      return computeSummary(state.accounts, state.cycles, state.rewards, this.includeEstimated)
    },

    byAccount(state) {
      return computeByAccount(state.accounts, state.cycles, state.rewards, this.includeEstimated)
    },

    // Tổng hợp theo "đợt" (ngày bắt đầu) — dùng cho biểu đồ lợi nhuận theo đợt.
    batches(state) {
      return computeBatches(state.cycles, state.rewards, this.includeEstimated)
    },

    // Tổng thưởng theo token — dùng cho biểu đồ phân bổ thưởng.
    rewardsByToken(state) {
      return computeRewardsByToken(state.rewards, this.includeEstimated)
    },

    accountNames(state) {
      return state.accounts.map((a) => a.name)
    },

    // Map tên tài khoản -> màu (hex) để hiển thị badge ở mọi nơi
    accountColorMap(state) {
      const m = {}
      for (const a of state.accounts) if (a.color) m[a.name] = a.color
      return m
    },
  },

  actions: {
    // Bật lắng nghe realtime (idempotent). Mutations sau đó tự phản ánh qua listener.
    subscribe() {
      if (this._unsubs.length) return
      this.loading = true
      this.error = ''
      const loaded = { a: false, c: false, r: false }
      const check = () => {
        if (loaded.a && loaded.c && loaded.r) this.loading = false
      }
      const onErr = (e) => {
        this.error = e.message
        this.loading = false
        toastError(e.message)
      }
      this._unsubs = [
        repo.subscribeAccounts((d) => {
          // Tài khoản: theo order (kéo-thả), rồi tới thời điểm tạo
          this.accounts = d.sort(
            (a, b) =>
              (a.order ?? Infinity) - (b.order ?? Infinity) ||
              byCreatedAt(a, b) ||
              a.name.localeCompare(b.name),
          )
          loaded.a = true
          check()
        }, onErr),
        repo.subscribeCycles((d) => {
          this.cycles = d.sort(byCreatedAt)
          loaded.c = true
          check()
        }, onErr),
        repo.subscribeRewards((d) => {
          this.rewards = d.sort(byCreatedAt)
          loaded.r = true
          check()
        }, onErr),
      ]
    },

    unsubscribe() {
      this._unsubs.forEach((u) => u && u())
      this._unsubs = []
      this.accounts = []
      this.cycles = []
      this.rewards = []
    },

    // Tương thích ngược: nút "Làm mới" — realtime nên chỉ cần đảm bảo đã subscribe.
    load() {
      this.subscribe()
    },

    async _run(fn, okMsg) {
      this.saving = true
      try {
        const res = await fn()
        if (okMsg) toastSuccess(okMsg)
        return res
      } catch (e) {
        toastError(e.message)
        throw e
      } finally {
        this.saving = false
      }
    },

    // Accounts
    addAccount(data) {
      return this._run(() => repo.addAccount(data), 'Đã thêm tài khoản.')
    },
    updateAccount(id, data) {
      return this._run(() => repo.updateAccount(id, data), 'Đã cập nhật tài khoản.')
    },
    deleteAccount(id) {
      return this._run(() => repo.deleteAccount(id), 'Đã xoá tài khoản.')
    },
    reorderAccounts(ids) {
      return this._run(() => repo.reorderAccounts(ids), null)
    },

    // Cycles
    addCycle(data) {
      return this._run(() => repo.addCycle(data), 'Đã tạo chu kì.')
    },
    addCyclesBulk(items) {
      return this._run(
        () => Promise.all(items.map((it) => repo.addCycle(it))),
        `Đã tạo ${items.length} chu kì.`,
      )
    },
    updateCycle(id, data) {
      return this._run(() => repo.updateCycle(id, data), 'Đã cập nhật chu kì.')
    },
    updateCyclesBulk(items) {
      return this._run(
        () => Promise.all(items.map((it) => repo.updateCycle(it.id, it.data))),
        `Đã cập nhật ${items.length} chu kì.`,
      )
    },
    deleteCycle(id) {
      return this._run(() => repo.deleteCycle(id), 'Đã xoá chu kì.')
    },
    // Xoá chu kì kèm (tuỳ chọn) các phần thưởng liên kết — tránh thưởng "mồ côi".
    deleteCycleWithRewards(id, rewardIds = []) {
      return this._run(
        () => repo.deleteCycleWithRewards(id, rewardIds),
        rewardIds.length
          ? `Đã xoá chu kì và ${rewardIds.length} phần thưởng liên kết.`
          : 'Đã xoá chu kì.',
      )
    },

    // Rewards
    addReward(data) {
      return this._run(() => repo.addReward(data), 'Đã thêm phần thưởng.')
    },
    updateReward(id, data) {
      return this._run(() => repo.updateReward(id, data), 'Đã cập nhật phần thưởng.')
    },
    updateRewardsBulk(items) {
      return this._run(
        () => Promise.all(items.map((it) => repo.updateReward(it.id, it.data))),
        `Đã lưu ${items.length} thay đổi.`,
      )
    },
    addRewardsBulk(items) {
      return this._run(
        () => Promise.all(items.map((it) => repo.addReward(it))),
        `Đã thêm ${items.length} phần thưởng.`,
      )
    },
    deleteReward(id) {
      return this._run(() => repo.deleteReward(id), 'Đã xoá phần thưởng.')
    },

    // Di trú dữ liệu cũ: gán accountId cho các chu kì/thưởng còn tham chiếu theo TÊN.
    // Khớp tên -> id (tên trùng: tài khoản đầu tiên theo thứ tự thắng). Trả về số liệu để báo cáo.
    async migrateAccountRefs() {
      const nameToId = {}
      for (const a of this.accounts) if (!(a.name in nameToId)) nameToId[a.name] = a.id

      const updates = []
      const unmatched = new Set()
      const collect = (col, list) => {
        for (const it of list) {
          if (it.accountId) continue // đã có id
          if (it.account && nameToId[it.account]) {
            updates.push({ col, id: it.id, accountId: nameToId[it.account] })
          } else if (it.account) {
            unmatched.add(it.account)
          }
        }
      }
      collect('cycles', this.cycles)
      collect('rewards', this.rewards)

      if (updates.length) {
        await this._run(
          () => repo.setAccountIdsBatch(updates),
          `Đã gán accountId cho ${updates.length} bản ghi.`,
        )
      }
      return { updated: updates.length, unmatched: [...unmatched] }
    },
  },
})
