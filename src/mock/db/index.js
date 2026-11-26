import { defaultData, shouldResetSeed } from './seed/index.js'
import { ElMessage } from 'element-plus'
import { configureDomain } from '@/domain/services.js'

// 写盘失败不能静默：localStorage 满 / 隐私模式禁用 / 配额超限都会抛异常。
// 以前 26 处 save() 无处 catch，用户点了「保存」看到成功提示但刷新后全丢。
let storageFailed = false
const persist = (data) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        storageFailed = false
        return true
    } catch (error) {
        if (!storageFailed) {
            storageFailed = true
            ElMessage.error('本地数据保存失败，请检查浏览器存储权限或空间（本次改动可能不会保留）')
        }
        console.error('[mock] localStorage 写入失败', error)
        return false
    }
}

const STORAGE_KEY = 'pm_mock_db'

function clone(value) {
    return JSON.parse(JSON.stringify(value))
}

function load() {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return clone(defaultData)
    try {
        const data = JSON.parse(raw)
        // 什么时候整份重置（演示项目，不做迁移脚本）：
        // 1. 从没存过 / 没有版本号；
        // 2. 版本号比代码旧 —— 只认「代码更新」这个方向，反过来（本地比代码新，多见于
        //    浏览器拿到缓存里的旧 bundle）绝不能刷，否则会用旧种子把新数据抹掉；
        // 3. 版本号相同但种子内容指纹不同 —— 这就是撞号的兜底：不同分支用过同一个
        //    版本号时数字没法区分，只能比内容。
        // 注意：指纹只算种子源码，用户自己改的数据不参与，所以日常操作不会触发重置。
        // 判定逻辑在 seed/index.js 的 shouldResetSeed()，那边有单测覆盖。
        if (shouldResetSeed(data)) {
            const fresh = clone(defaultData)
            persist(fresh)
            return fresh
        }
        // tasks 为空（用户删光了所有种子任务），也重新 seed 一份
        if (!Array.isArray(data.tasks) || data.tasks.length === 0) {
            data.tasks = clone(defaultData.tasks)
            persist(data)
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
        if (normalized) persist(data)
        return data
    } catch {
        return clone(defaultData)
    }
}

export const db = load()

// 把存储与当前用户注入 domain 层：纯规则不依赖 mock，副作用仍由这里提供
configureDomain({ db, save: () => persist(db) })

export const save = () => persist(db)
