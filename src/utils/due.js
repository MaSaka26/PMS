const DAY = 24 * 60 * 60 * 1000

// YYYY-MM-DD → 本地零点，避免 new Date('YYYY-MM-DD') 被按 UTC 解析导致差一天
const parseLocalDate = (str) => {
    const [y, m, d] = String(str).split('-').map(Number)
    return new Date(y, (m || 1) - 1, d || 1)
}

// 距截止日期的天数：今天为 0，昨天为 -1，明天为 1
export const diffDays = (dueDate, today = new Date()) => {
    const due = parseLocalDate(dueDate)
    const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    return Math.round((due.getTime() - base.getTime()) / DAY)
}

// 截止紧急度：
//   ≥5 天        绿「轻」
//   3~4 天       黄「缓」
//   0~2 天       红「急」
//   <0 天        深红「急」+ 逾期提示
// 已验收 / 已取消 / 无截止日期 → 不展示
export const getDueLevel = (dueDate, status, today = new Date()) => {
    if (!dueDate) return null
    if (status === 'accepted' || status === 'canceled') return null

    const days = diffDays(dueDate, today)

    if (days < 0) {
        return { level: 'overdue', char: '急', days, text: `已逾期 ${-days} 天` }
    }
    if (days <= 2) {
        return { level: 'urgent', char: '急', days, text: days === 0 ? '今天到期' : `距截止 ${days} 天` }
    }
    if (days <= 4) {
        return { level: 'soon', char: '缓', days, text: `距截止 ${days} 天` }
    }
    return { level: 'safe', char: '轻', days, text: `距截止 ${days} 天` }
}
