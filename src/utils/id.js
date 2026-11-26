// 通用 id / URL 解析工具，domain 与 mock 共用
export function uid(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`
}

// /api/tasks/task_1 → task_1
export const idOf = (url) => url.split('?')[0].split('/').pop()

// /api/tasks/task_1/claim → task_1
export const idBeforeTail = (url) =>
    url.split('?')[0].split('/').filter(Boolean).slice(-2)[0]
