// Pinia store trung tâm: nắm dữ liệu accounts / cycles / rewards (realtime từ Firestore)
// và các thống kê dẫn xuất.
import { defineStore } from 'pinia'
import * as repo from '@/services/repository'
import { toastError, toastSuccess } from '@/composables/feedback'
import { tsMillis } from '@/utils/format'

const byCreatedAt = (a, b) => tsMillis(a.createdAt) - tsMillis(b.createdAt)

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
      const map = {}
      for (const r of state.rewards) {
        map[r.cycleId] = (map[r.cycleId] || 0) + r.amount
      }
      return map
    },

    // Tổng thưởng theo chu kì — bỏ thưởng "ước lượng" khi tắt includeEstimated
    visibleRewardsByCycle(state) {
      const map = {}
      for (const r of state.rewards) {
        if (!this.includeEstimated && r.estimated) continue
        map[r.cycleId] = (map[r.cycleId] || 0) + r.amount
      }
      return map
    },

    cyclesEnriched(state) {
      const byCycle = this.rewardsByCycle
      return state.cycles.map((c) => {
        const reward = byCycle[c.id] || 0
        const profit = reward - c.fee
        const roi = c.fee ? profit / c.fee : 0
        const rewardCount = state.rewards.filter((r) => r.cycleId === c.id).length
        return { ...c, reward, profit, roi, rewardCount }
      })
    },

    // Số phần thưởng đang ở trạng thái ước lượng
    estimatedCount(state) {
      return state.rewards.filter((r) => r.estimated).length
    },

    summary(state) {
      const byCycle = this.includeEstimated ? this.rewardsByCycle : this.visibleRewardsByCycle
      let totalFee = 0
      let totalReward = 0
      for (const c of state.cycles) {
        totalFee += c.fee
        totalReward += byCycle[c.id] || 0
      }
      const profit = totalReward - totalFee
      return {
        totalFee,
        totalReward,
        profit,
        roi: totalFee ? profit / totalFee : 0,
        cycleCount: state.cycles.length,
        accountCount: this.accounts.length,
      }
    },

    byAccount(state) {
      const byCycle = this.includeEstimated ? this.rewardsByCycle : this.visibleRewardsByCycle
      // Thứ tự tài khoản theo order (kéo-thả); tài khoản chỉ có trong chu kì xếp cuối
      const order = state.accounts.map((a) => a.name)
      const rank = (name) => {
        const i = order.indexOf(name)
        return i === -1 ? Infinity : i
      }
      const names = new Set([...order, ...state.cycles.map((c) => c.account)])
      return [...names]
        .filter(Boolean)
        .map((name) => {
          const list = state.cycles.filter((c) => c.account === name)
          const fee = list.reduce((s, c) => s + c.fee, 0)
          const reward = list.reduce((s, c) => s + (byCycle[c.id] || 0), 0)
          const profit = reward - fee
          return {
            name,
            cycles: list.length,
            fee,
            reward,
            profit,
            roi: fee ? profit / fee : 0,
          }
        })
        .sort((a, b) => rank(a.name) - rank(b.name))
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
    deleteCycle(id) {
      return this._run(() => repo.deleteCycle(id), 'Đã xoá chu kì.')
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
  },
})
