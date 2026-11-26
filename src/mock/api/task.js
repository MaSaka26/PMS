import Mock from 'mockjs'
import { db, save } from '../db/index.js'
import { syncProjectStatus } from '@/domain/project-status.js'
import {
  diffChanges,
  guardProject,
  logEvent,
  pendingDepsOf,
  REVIEW_TRANSITIONS,
  stripEvents,
  validateDateRange,
  validateDependencies,
  validatePlanDates,
  validateTransition
} from '@/domain/task-rules.js'
import { isAdmin, canReviewTask } from '@/utils/permissions'
import { getCurrentUser } from '../services/auth.js'
import { nowISO, todayLocal } from '@/utils/date'
import { idBeforeTail, idOf, uid } from '../utils/id.js'
import { fail, ok } from '../utils/response.js'

// ——— 列表：过滤软删除，支持 projectId ———
Mock.mock(/\/api\/tasks(\?.*)?$/, 'get', (options) => {
  const url = new URL(options.url, 'http://localhost')
  const projectId = url.searchParams.get('projectId')
  const includeDeleted = url.searchParams.get('includeDeleted') === '1'
  let list = db.tasks.filter((t) => includeDeleted || !t.deletedAt)
  if (projectId) list = list.filter((t) => t.projectId === projectId)
  return ok(list.map(stripEvents))
})

// ——— 详情：返回任务 + 完整事件（按时间正序） ———
Mock.mock(/\/api\/tasks\/[\w-]+$/, 'get', (options) => {
  const id = idOf(options.url)
  const task = db.tasks.find((t) => t.id === id)
  if (!task) return fail(404, '任务不存在')
  return ok({
    ...task,
    events: [...(task.events || [])].sort((a, b) => String(a.at).localeCompare(String(b.at)))
  })
})

// ——— 新增 ———
Mock.mock('/api/tasks', 'post', (options) => {
  const body = JSON.parse(options.body)
  const project = db.projects.find((p) => p.id === body.projectId)
  const guard = guardProject(project)
  if (guard) return guard
  if (body.assignee && !project.members.includes(body.assignee)) {
    return fail(400, '被指派人不是该项目的成员')
  }
  const user = getCurrentUser()
  if (!(isAdmin(user) || project.members.includes(user?.id))) {
    return fail(403, '只有项目成员或管理员可以创建任务')
  }
  const createdAt = body.createdAt || todayLocal()
  const plannedStart = body.plannedStart || createdAt
  const dateError = validateDateRange(createdAt, body.dueDate) || validatePlanDates(project, plannedStart, body.dueDate)
  if (dateError) return fail(400, dateError)

  const id = uid('task')
  const depError = validateDependencies(id, project.id, body.dependsOn || [])
  if (depError) return fail(400, depError)
  // 方案 A：任务可挂到同项目里程碑下；旧数据 milestoneId 缺省为空
  if (body.milestoneId) {
    const ms = (db.milestones || []).find((m) => m.id === body.milestoneId && !m.deletedAt)
    if (!ms || ms.projectId !== project.id) return fail(400, '里程碑不存在或不属于该项目')
  }

  // 待办 = 无人负责；一旦指派负责人，直接视为开工
  let status = body.status || (body.assignee ? 'doing' : 'todo')
  if (status === 'todo' && body.assignee) status = 'doing'
  if (!['todo', 'canceled'].includes(status) && !body.assignee) {
    return fail(400, '非待办任务必须有负责人')
  }

  const task = {
    id,
    projectId: body.projectId,
    title: body.title,
    desc: body.desc || '',
    priority: body.priority || '中',
    assignee: body.assignee || '',
    dueDate: body.dueDate || '',
    status,
    createdAt,
    plannedStart,
    dependsOn: [...new Set((body.dependsOn || []).filter(Boolean))],
    milestoneId: body.milestoneId || '',
    createdBy: body.createdBy || user?.id || '',
    blocked: false,
    blockedReason: '',
    blockedAt: null,
    blockedBy: null,
    deletedAt: null,
    // 自定义字段的值：{ [fieldId]: value }
    extra: body.extra && typeof body.extra === 'object' ? { ...body.extra } : {},
    events: []
  }
  db.tasks.unshift(task)
  logEvent(task, { type: 'created', to: task.status, by: task.createdBy })
  syncProjectStatus(project.id)
  save()
  return ok(stripEvents(task))
})

// ——— 编辑：状态机 + 权限 + 事件留痕 ———
Mock.mock(/\/api\/tasks\/[\w-]+$/, 'put', (options) => {
  const id = idOf(options.url)
  const body = JSON.parse(options.body)
  const idx = db.tasks.findIndex((t) => t.id === id)
  if (idx === -1) return fail(404, '任务不存在')
  const oldTask = db.tasks[idx]
  if (oldTask.deletedAt) return fail(404, '任务不存在')

  const project = db.projects.find((p) => p.id === oldTask.projectId)
  const guard = guardProject(project)
  if (guard) return guard

  const user = getCurrentUser()
  const canManage = canReviewTask(user, project)
  const isCreator = oldTask.createdBy === user?.id
  const isAssignee = oldTask.assignee === user?.id

  // 基本信息编辑：管理员 / 项目负责人 / 创建人 / 负责人
  if (!canManage && !isCreator && !isAssignee) {
    return fail(403, '没有权限编辑该任务')
  }
  // 改派负责人：管理员 / 项目负责人 / 创建人
  if (
    body.assignee !== undefined &&
    body.assignee !== oldTask.assignee &&
    !canManage &&
    !isCreator
  ) {
    return fail(403, '只有项目负责人、管理员或任务创建人可以改派负责人')
  }

  const nextAssignee = body.assignee !== undefined ? body.assignee : oldTask.assignee
  let nextStatus = body.status !== undefined ? body.status : oldTask.status

  // 待办 = 无人负责；给待办指派负责人，等同于直接开工
  if (nextStatus === 'todo' && nextAssignee) nextStatus = 'doing'
  // 除待办、已取消外，任务必须有负责人
  if (!['todo', 'canceled'].includes(nextStatus) && !nextAssignee) {
    return fail(400, '非待办任务必须有负责人')
  }

  const statusChanged = nextStatus !== oldTask.status

  // 取消/恢复走专用接口，避免和普通编辑混在一起
  if (statusChanged && (nextStatus === 'canceled' || oldTask.status === 'canceled')) {
    return fail(400, '请使用「取消任务 / 恢复任务」操作')
  }

  // 状态流转校验
  if (statusChanged) {
    const v = validateTransition(oldTask.status, nextStatus)
    if (!v.ok) return fail(400, v.msg)
  }

  // 改派校验
  if (body.assignee !== undefined && body.assignee && !project.members.includes(body.assignee)) {
    return fail(400, '被指派人不是该项目的成员')
  }

  // 日期区间校验：创建时间可改（回溯），但截止日期不能早于它
  const nextCreatedAt = body.createdAt !== undefined ? body.createdAt : oldTask.createdAt
  const nextDueDate = body.dueDate !== undefined ? body.dueDate : oldTask.dueDate
  const nextPlannedStart = body.plannedStart !== undefined ? body.plannedStart : oldTask.plannedStart
  const dateError = validateDateRange(nextCreatedAt, nextDueDate) || validatePlanDates(project, nextPlannedStart, nextDueDate)
  if (dateError) return fail(400, dateError)

  // 依赖：同项目、非自身、无环
  if (body.dependsOn !== undefined) {
    const depError = validateDependencies(oldTask.id, oldTask.projectId, body.dependsOn)
    if (depError) return fail(400, depError)
  }

  // 前置未完成时，从待办启动需要显式强制
  if (statusChanged && oldTask.status === 'todo' && nextStatus === 'doing') {
    const pending = pendingDepsOf(oldTask)
    if (pending.length && !body.forceStart) {
      return fail(409, `前置任务未完成：${pending.map((t) => t.title).join('、')}`)
    }
  }

  // 提交验收：任务负责人、项目负责人或管理员
  if (
    statusChanged &&
    oldTask.status === 'doing' &&
    nextStatus === 'done' &&
    !canManage &&
    !isAssignee
  ) {
    return fail(403, '只有任务负责人、项目负责人或管理员可以提交验收')
  }
  // 编辑里直接指派（待办 → 进行中）：仅项目负责人或管理员
  if (statusChanged && oldTask.status === 'todo' && nextStatus === 'doing' && !canManage) {
    return fail(403, '只有项目负责人或管理员可以指派任务')
  }

  // 验收 / 驳回 / 重开：仅项目负责人（PM）或 admin
  const transitionKey = `${oldTask.status}->${nextStatus}`
  if (statusChanged && REVIEW_TRANSITIONS.has(transitionKey) && !canReviewTask(user, project)) {
    return fail(403, '只有项目负责人或管理员可以验收、驳回或重开任务')
  }

  // 必填原因：驳回、重开
  if (statusChanged && ['done->doing', 'accepted->doing'].includes(transitionKey)) {
    if (!String(body.reason || '').trim()) {
      return fail(400, transitionKey === 'accepted->doing' ? '重开任务必须填写原因' : '驳回任务必须填写原因')
    }
  }

  // 阻塞中的任务不能直接提交验收：先解除阻塞，再提交
  if (oldTask.status === 'doing' && nextStatus === 'done' && oldTask.blocked) {
    return fail(400, '任务处于阻塞状态，请先解除阻塞再提交验收')
  }

  // 计算字段变化（独立成 edited 事件，不和状态事件混）
  const changes = diffChanges(oldTask, body)

  const patch = { ...body }
  delete patch.reason
  delete patch.forceStart
  if (body.dependsOn !== undefined) {
    patch.dependsOn = [...new Set((body.dependsOn || []).filter(Boolean))]
  }
  if (body.extra !== undefined) {
    // 整体替换：表单会带上旧值，停用/删除字段的历史值不会被误清空
    patch.extra = body.extra && typeof body.extra === 'object' ? { ...body.extra } : {}
  }
  if (statusChanged) {
    patch.status = nextStatus
    // 兼容卡片上的快速展示字段
    if (statusChanged && nextStatus === 'doing' && oldTask.status === 'accepted') {
      patch.reopenReason = body.reason
      patch.reopenAt = nowISO()
      patch.reopenBy = user?.id || ''
    }
    if (statusChanged && nextStatus === 'doing' && oldTask.status === 'done') {
      patch.rejectReason = body.reason
    }
  }

  db.tasks[idx] = { ...oldTask, ...patch, id }

  // 状态事件
  if (statusChanged) {
    const typeMap = {
      'doing->done': 'submitted',
      'done->accepted': 'accepted',
      'done->doing': 'rejected',
      'accepted->doing': 'reopened',
      'todo->doing': 'assigned'
    }
    logEvent(db.tasks[idx], {
      type: typeMap[transitionKey] || 'status_changed',
      from: oldTask.status,
      to: nextStatus,
      reason: body.reason
    })
  }

  // 字段编辑事件（状态变化同时改了字段时，两条事件各记各的）
  if (changes.length) {
    logEvent(db.tasks[idx], { type: 'edited', changes })
  }

  syncProjectStatus(oldTask.projectId)
  save()
  return ok(stripEvents(db.tasks[idx]))
})

// ——— 删除：软删除（保留数据与事件，供追溯） ———
Mock.mock(/\/api\/tasks\/[\w-]+$/, 'delete', (options) => {
  const id = idOf(options.url)
  const task = db.tasks.find((t) => t.id === id)
  if (!task || task.deletedAt) return fail(404, '任务不存在')
  const project = db.projects.find((p) => p.id === task.projectId)
  const guard = guardProject(project)
  if (guard) return guard
  const user = getCurrentUser()
  if (!canReviewTask(user, project)) return fail(403, '只有项目负责人或管理员可以删除任务')

  task.deletedAt = nowISO()
  logEvent(task, { type: 'deleted' })
  syncProjectStatus(task.projectId)
  save()
  return ok(null)
})

// ——— 认领：assignee 为空才能认领，认领人必须是项目成员 ———
Mock.mock(/\/api\/tasks\/[\w-]+\/claim$/, 'post', (options) => {
  // url 形如 /api/tasks/task_seed_2/claim，取倒数第二段才是任务 id
  const id = idBeforeTail(options.url)
  const body = JSON.parse(options.body)
  const task = db.tasks.find((t) => t.id === id)
  if (!task || task.deletedAt) return fail(404, '任务不存在')
  const project = db.projects.find((p) => p.id === task.projectId)
  const guard = guardProject(project)
  if (guard) return guard
  if (task.assignee) return fail(400, '任务已被指派，无法认领')
  const user = getCurrentUser()
  if (!user) return fail(401, '请先登录')
  if (body.assignee !== user.id) return fail(403, '只能认领任务给自己')
  if (!project.members.includes(body.assignee)) return fail(400, '认领人不是该项目的成员')

  // 前置未完成时，认领（即启动）需要显式强制
  const pending = pendingDepsOf(task)
  if (pending.length && !body.forceStart) {
    return fail(409, `前置任务未完成：${pending.map((t) => t.title).join('、')}`)
  }

  task.assignee = body.assignee
  const from = task.status
  if (task.status === 'todo') task.status = 'doing'
  logEvent(task, { type: 'claimed', from, to: task.status })
  syncProjectStatus(task.projectId)
  save()
  return ok(stripEvents(task))
})

// ——— 阻塞 / 解除阻塞：是标记，不是状态 ———
Mock.mock(/\/api\/tasks\/[\w-]+\/block$/, 'post', (options) => {
  const id = idBeforeTail(options.url)
  const body = JSON.parse(options.body)
  const task = db.tasks.find((t) => t.id === id)
  if (!task || task.deletedAt) return fail(404, '任务不存在')
  const project = db.projects.find((p) => p.id === task.projectId)
  const guard = guardProject(project)
  if (guard) return guard

  const user = getCurrentUser()
  if (!(canReviewTask(user, project) || task.assignee === user?.id)) {
    return fail(403, '只有任务负责人、项目负责人或管理员可以标记阻塞')
  }
  if (task.status === 'canceled') return fail(400, '已取消的任务不能标记阻塞')
  // 阻塞只作用于执行阶段：待验收/已验收的任务执行已结束，发现问题请走驳回
  if (!['todo', 'doing'].includes(task.status)) {
    return fail(400, '只有待办或进行中的任务可以标记阻塞')
  }
  if (task.blocked) return fail(400, '任务已处于阻塞状态')
  const reason = String(body.reason || '').trim()
  if (!reason) return fail(400, '标记阻塞必须填写原因')

  task.blocked = true
  task.blockedReason = reason
  task.blockedAt = nowISO()
  task.blockedBy = user?.id || ''
  logEvent(task, { type: 'blocked', reason })
  save()
  return ok(stripEvents(task))
})

Mock.mock(/\/api\/tasks\/[\w-]+\/unblock$/, 'post', (options) => {
  const id = idBeforeTail(options.url)
  const task = db.tasks.find((t) => t.id === id)
  if (!task || task.deletedAt) return fail(404, '任务不存在')
  const project = db.projects.find((p) => p.id === task.projectId)
  const guard = guardProject(project)
  if (guard) return guard

  const user = getCurrentUser()
  if (!(canReviewTask(user, project) || task.assignee === user?.id)) {
    return fail(403, '只有任务负责人、项目负责人或管理员可以解除阻塞')
  }
  if (!task.blocked) return fail(400, '任务当前没有阻塞')

  task.blocked = false
  task.blockedReason = ''
  task.blockedAt = null
  task.blockedBy = null
  logEvent(task, { type: 'unblocked' })
  save()
  return ok(stripEvents(task))
})

// ——— 取消 / 恢复 ———
Mock.mock(/\/api\/tasks\/[\w-]+\/cancel$/, 'post', (options) => {
  const id = idBeforeTail(options.url)
  const body = JSON.parse(options.body)
  const task = db.tasks.find((t) => t.id === id)
  if (!task || task.deletedAt) return fail(404, '任务不存在')
  const project = db.projects.find((p) => p.id === task.projectId)
  const guard = guardProject(project)
  if (guard) return guard

  const user = getCurrentUser()
  const allowed = canReviewTask(user, project) || task.createdBy === user?.id
  if (!allowed) return fail(403, '只有项目负责人、管理员或任务创建人可以取消任务')
  if (task.status === 'accepted') return fail(400, '已验收的任务不能取消，如需返工请使用重开')
  if (task.status === 'canceled') return fail(400, '任务已取消')

  const reason = String(body.reason || '').trim()
  if (!reason) return fail(400, '取消任务必须填写原因')

  const from = task.status
  task.status = 'canceled'
  task.canceledReason = reason
  task.canceledAt = nowISO()
  task.canceledBy = user?.id || ''
  task.blocked = false
  task.blockedReason = ''
  logEvent(task, { type: 'canceled', from, to: 'canceled', reason })
  syncProjectStatus(task.projectId)
  save()
  return ok(stripEvents(task))
})

Mock.mock(/\/api\/tasks\/[\w-]+\/restore$/, 'post', (options) => {
  const id = idBeforeTail(options.url)
  const task = db.tasks.find((t) => t.id === id)
  if (!task || task.deletedAt) return fail(404, '任务不存在')
  const project = db.projects.find((p) => p.id === task.projectId)
  const guard = guardProject(project)
  if (guard) return guard

  const user = getCurrentUser()
  if (!canReviewTask(user, project)) return fail(403, '只有项目负责人或管理员可以恢复任务')
  if (task.status !== 'canceled') return fail(400, '只有已取消的任务可以恢复')

  // 待办 = 无人负责：恢复时清空负责人，回到任务池重新认领
  task.status = 'todo'
  task.assignee = ''
  logEvent(task, { type: 'restored', from: 'canceled', to: 'todo' })
  syncProjectStatus(task.projectId)
  save()
  return ok(stripEvents(task))
})