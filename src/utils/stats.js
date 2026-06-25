// Các hàm tổng hợp thuần (pure) trên accounts / cycles / rewards.
// Tách khỏi store để dùng lại được cho dữ liệu ĐÃ LỌC (vd Dashboard lọc theo khoảng ngày)
// mà không lặp logic. Store getters chỉ là wrapper mỏng gọi các hàm này với mảng đầy đủ.

// Tổng thưởng theo cycleId. includeEstimated=false sẽ bỏ thưởng "ước lượng".
export function computeRewardsByCycle(rewards, includeEstimated = true) {
  const map = {}
  for (const r of rewards) {
    if (!includeEstimated && r.estimated) continue
    map[r.cycleId] = (map[r.cycleId] || 0) + r.amount
  }
  return map
}

export function computeSummary(accounts, cycles, rewards, includeEstimated = true) {
  const byCycle = computeRewardsByCycle(rewards, includeEstimated)
  let totalFee = 0
  let totalReward = 0
  for (const c of cycles) {
    totalFee += c.fee
    totalReward += byCycle[c.id] || 0
  }
  const profit = totalReward - totalFee
  // Số chu kì = số đợt (ngày bắt đầu unique), không phải số record
  const cycleCount = new Set(cycles.map((c) => c.startDate).filter(Boolean)).size
  return {
    totalFee,
    totalReward,
    profit,
    roi: totalFee ? profit / totalFee : 0,
    cycleCount,
    accountCount: accounts.length,
  }
}

export function computeByAccount(accounts, cycles, rewards, includeEstimated = true) {
  const byCycle = computeRewardsByCycle(rewards, includeEstimated)
  // Thứ tự tài khoản theo order (kéo-thả); tài khoản chỉ có trong chu kì xếp cuối
  const order = accounts.map((a) => a.name)
  const rank = (name) => {
    const i = order.indexOf(name)
    return i === -1 ? Infinity : i
  }
  const names = new Set([...order, ...cycles.map((c) => c.account)])
  return [...names]
    .filter(Boolean)
    .map((name) => {
      const list = cycles.filter((c) => c.account === name)
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
}

// Tổng hợp theo "đợt" (ngày bắt đầu) — dùng cho biểu đồ lợi nhuận theo đợt.
export function computeBatches(cycles, rewards, includeEstimated = true) {
  const byCycle = computeRewardsByCycle(rewards, includeEstimated)
  const map = {}
  for (const c of cycles) {
    const k = c.startDate || ''
    if (!k) continue
    if (!map[k]) map[k] = { startDate: k, endDate: '', count: 0, fee: 0, reward: 0 }
    map[k].count++
    map[k].fee += c.fee
    map[k].reward += byCycle[c.id] || 0
    if (c.endDate && c.endDate > map[k].endDate) map[k].endDate = c.endDate
  }
  return Object.values(map)
    .map((b) => ({
      ...b,
      profit: b.reward - b.fee,
      roi: b.fee ? (b.reward - b.fee) / b.fee : 0,
    }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
}

// Tổng thưởng theo token — dùng cho biểu đồ phân bổ thưởng.
export function computeRewardsByToken(rewards, includeEstimated = true) {
  const map = {}
  for (const r of rewards) {
    if (!includeEstimated && r.estimated) continue
    const t = r.token || '(không rõ)'
    if (!map[t]) map[t] = { token: t, amount: 0, count: 0 }
    map[t].amount += r.amount
    map[t].count++
  }
  return Object.values(map).sort((a, b) => b.amount - a.amount)
}
