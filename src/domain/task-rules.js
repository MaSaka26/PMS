import { db } from '@/mock/db/index.js'
import { getCurrentUser } from '@/mock/services/auth.js'
import { nowISO } from '@/mock/utils/date.js'
import { uid } from '@/mock/utils/id.js'
import { fail } from '@/mock/utils/response.js'

// ——— 日期规则 ———
// 日期区间校验：截止日期不能早于创建时间
export const validateDateRange = (createdAt, dueDate) =>
    createdAt && dueDate && dueDate < createdAt ? '截止日期不能早于创建时间' : ''

// 计划日期校验：计划开始 ≤ 截止，且必须落在项目周期内
export const validatePlanDates = (project, plannedStart, dueDate) => {
    if (plannedStart && dueDate && dueDate < plannedStart) {
        return '截止日期不能早于计划开始日期'
    }
    if (project?.startDate && plannedStart && plannedStart < project.startDate) {
        return `计划开始不能早于项目开始日期（${project.startDate}）`
    }
    if (project?.endDate && dueDate && dueDate > project.endDate) {
        return `截止日期不能晚于项目结束日期（${project.endDate}）`
    }
    return ''
}

// ——— 依赖规则 ———
// 前置任务进入"待验收 / 已验收"即视为交付完成，后继任务可以开始
const DEP_SATISFIED = new Set(['done', 'accepted'])

const projectTasksOf = (projectId) =>
    db.tasks.filter((t) => t.projectId === projectId && !t.deletedAt)

// 依赖校验：同项目、非自身、无环
export const validateDependencies = (taskId, projectId, deps) => {
    if (!Array.isArray(deps)) return '前置任务格式不正确'
    const ids = [...new Set(deps.filter(Boolean))]
    const map = new Map(projectTasksOf(projectId).map((t) => [t.id, t]))

    for (const id of ids) {
        if (id === taskId) return '任务不能依赖自己'
        if (!map.has(id)) return '前置任务必须是同一项目内未删除的任务'
    }

    // 环检测：沿前置链回溯，如果能走回当前任务说明成环
    const seen = new Set()
    const stack = [...ids]
    while (stack.length) {
        const cur = stack.pop()
        if (cur === taskId) return '依赖关系不能形成环'
        if (seen.has(cur)) continue
        seen.add(cur)
        const t = map.get(cur)
        if (t && Array.isArray(t.dependsOn)) stack.push(...t.dependsOn)
    }
    return ''
}

// 尚未完成的前置任务列表
export const pendingDepsOf = (task) =>
    (task.dependsOn || [])
        .map((id) => db.tasks.find((t) => t.id === id))
        .filter((t) => t && !DEP_SATISFIED.has(t.status))

// ——— 事件日志：全系统唯一写入口 ———
// 任何 handler 都不允许直接 task.events.push，必须走这里，避免漏记
export const logEvent = (task, { type, by, reason, from, to, changes, batchId }) => {
    const user = getCurrentUser()
    const event = {
        id: uid('ev'),
        taskId: task.id,
        projectId: task.projectId,
        type,
        by: by || user?.id || '',
        at: nowISO()
    }
    if (reason) event.reason = reason
    if (from !== undefined) event.from = from
    if (to !== undefined) event.to = to
    if (Array.isArray(changes) && changes.length) event.changes = changes
    if (batchId) event.batchId = batchId

    if (!Array.isArray(task.events)) task.events = []
    task.events.push(event)
    return event
}

// 列表接口不返回 events，减小 payload；详情接口才给全量
export const stripEvents = (task) => {
    const { events, ...rest } = task
    return rest
}

// ——— 状态机 ———
// todo → doing    : assignee 认领 / PM 指派
// doing → done    : assignee 自认为完成
// done → accepted : PM/admin 验收
// done → doing    : PM/admin 驳回
// accepted → doing: PM/admin 重开（必须填原因）
// todo/doing/done → canceled : 取消（必须填原因）
// canceled → todo : 恢复
export const ALLOWED_TRANSITIONS = {
    todo: ['doing', 'canceled'],
    doing: ['done', 'canceled'],
    done: ['doing', 'accepted', 'canceled'],
    accepted: ['doing'],
    canceled: ['todo']
}

export const REVIEW_TRANSITIONS = new Set(['done->accepted', 'done->doing', 'accepted->doing'])

export const validateTransition = (from, to) => {
    const allowed = ALLOWED_TRANSITIONS[from] || []
    if (!allowed.includes(to)) {
        return { ok: false, msg: `状态不合法：不能从「${from}」直接跳到「${to}」` }
    }
    return { ok: true }
}

// ——— 权限与项目守卫 ———
// 项目是否已归档 —— 归档后所有写操作都应被拒绝
export const guardProject = (project) => {
    if (!project) return fail(404, '项目不存在')
    if (project.status === 'archived') return fail(403, '项目已归档，仅可查看')
    return null
}


// ——— 字段变更留痕 ———
// 需要对比并记录历史的字段（白名单）
const TRACKED_FIELDS = ['title', 'priority', 'assignee', 'dueDate', 'createdAt', 'plannedStart']
const FIELD_LABEL = {
    title: '标题',
    priority: '优先级',
    assignee: '负责人',
    dueDate: '截止日期',
    createdAt: '创建时间',
    plannedStart: '计划开始'
}

export const diffChanges = (oldTask, body) => {
    const changes = []
    for (const field of TRACKED_FIELDS) {
        if (body[field] !== undefined && body[field] !== oldTask[field]) {
            changes.push({ field, label: FIELD_LABEL[field], from: oldTask[field], to: body[field] })
        }
    }
    // 长文本只记"改过"，不存全文，避免日志膨胀与敏感内容留存
    if (body.desc !== undefined && body.desc !== oldTask.desc) {
        changes.push({ field: 'desc', label: '描述', textOnly: true })
    }
    // 自定义字段整体记一条，不逐项展开
    if (
        body.extra !== undefined &&
        JSON.stringify(body.extra || {}) !== JSON.stringify(oldTask.extra || {})
    ) {
        changes.push({ field: 'extra', label: '扩展信息', textOnly: true })
    }
    return changes
}