// 简易 id：前缀 + 时间戳 + 随机数，保证本地唯一即可
export function uid(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`
}

// /api/tasks/task_1 → task_1
export const idOf = (url) => url.split('?')[0].split('/').pop()

// /api/tasks/task_1/claim → task_1
export const idBeforeTail = (url) =>
    url.split('?')[0].split('/').filter(Boolean).slice(-2)[0]
