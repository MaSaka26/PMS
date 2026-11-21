import { defaultData, SEED_VERSION } from './seed/index.js'

const STORAGE_KEY = 'pm_mock_db'

function clone(value) {
    return JSON.parse(JSON.stringify(value))
}

function load() {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return clone(defaultData)
    try {
        const data = JSON.parse(raw)
        // 版本低于当前版本：结构不完整，直接整份重置（演示项目，不做迁移脚本）
        if (!data.seedVersion || data.seedVersion < SEED_VERSION) {
            const fresh = clone(defaultData)
            localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
            return fresh
        }
        // tasks 为空（用户删光了所有种子任务），也重新 seed 一份
        if (!Array.isArray(data.tasks) || data.tasks.length === 0) {
            data.tasks = clone(defaultData.tasks)
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        }
        // 规则修正：待办 = 无人负责。历史遗留的“待办 + 负责人”自动视为已开工
        let normalized = false
        for (const t of data.tasks) {
            if (t.status === 'todo' && t.assignee) {
                t.status = 'doing'
                normalized = true
            }
        }
        // 老数据没有岗位字段：给种子成员补一个默认岗位（用户主动清空的不再覆盖）
        const defaultPositions = { u1: '总经理', u2: '项目经理', u3: '前端工程师' }
        for (const m of data.members || []) {
            if (m.position === undefined && defaultPositions[m.id]) {
                m.position = defaultPositions[m.id]
                normalized = true
            }
            // 老数据默认启用
            if (m.active === undefined) {
                m.active = true
                normalized = true
            }
        }
        if (normalized) localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        return data
    } catch {
        return clone(defaultData)
    }
}

export const db = load()

export function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

// 跨标签页同步：其他标签页写入后，本页内存里的整份快照已经过期。
// 直接重载而不是继续写，避免用旧快照把对方刚保存的修改整份覆盖。
if (typeof window !== 'undefined') {
    let reloading = false
    let stale = false

    const reload = () => {
        if (reloading) return
        reloading = true
        window.location.reload()
    }

    window.addEventListener('storage', (event) => {
        if (event.key !== STORAGE_KEY) return
        // 后台标签页先记下，回到前台再刷新，避免打扰正在看的页面
        if (document.visibilityState === 'hidden') {
            stale = true
            return
        }
        reload()
    })

    document.addEventListener('visibilitychange', () => {
        if (stale && document.visibilityState === 'visible') {
            stale = false
            reload()
        }
    })
}
