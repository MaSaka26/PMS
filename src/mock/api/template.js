import Mock from 'mockjs'
import { db, save } from '../db/index.js'
import { canManageTemplates, isManager, canManageAccount } from '@/utils/permissions'
import { syncProjectStatus } from '@/domain/project-status.js'
import { PROJECT_STATUS } from '@/constants/status'
import { nowISO } from '../utils/date.js'
import { uid } from '../utils/id.js'
import { fail, ok } from '../utils/response.js'

const templatesOf = () => (Array.isArray(db.templates) ? db.templates : (db.templates = []))

const pad = (n) => String(n).padStart(2, '0')
const todayLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const addDays = (dateStr, days) => {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

import { getCurrentUser } from '../services/auth.js'

const requireManager = () => {
  const user = getCurrentUser()
  if (!canManageTemplates(user)) {
    return { code: 403, data: null, msg: '只有管理员或项目经理可以维护模板' }
  }
  return null
}

const normalizeTasks = (tasks) =>
  (Array.isArray(tasks) ? tasks : []).map((t, index) => ({
    key: String(t.key),
    title: String(t.title || '').trim(),
    description: String(t.description || '').trim(),
    priority: ['低', '中', '高'].includes(t.priority) ? t.priority : '中',
    startOffset: Math.max(0, Number(t.startOffset) || 0),
    duration: Math.max(1, Number(t.duration) || 1),
    dependsOn: [...new Set((t.dependsOn || []).filter(Boolean))],
    order: index
  }))

// 模板校验：标题、工期、前置存在性、环检测
const validateTemplate = (body, excludeId) => {
  const name = String(body.name || '').trim()
  if (!name) return '模板名称不能为空'
  if (templatesOf().some((t) => t.id !== excludeId && t.name === name)) {
    return '已存在同名模板'
  }

  const tasks = Array.isArray(body.tasks) ? body.tasks : []
  if (!tasks.length) return '至少添加一个任务'

  const keys = new Set()
  for (const t of tasks) {
    const key = String(t.key || '').trim()
    if (!key) return '任务缺少内部标识'
    if (keys.has(key)) return '任务标识重复'
    keys.add(key)
    if (!String(t.title || '').trim()) return '任务标题不能为空'
    if (Number(t.duration) < 1) return '任务工期至少 1 天'
    if (Number(t.startOffset) < 0) return '相对开始天数不能为负数'
  }

  const byKey = new Map(tasks.map((t) => [t.key, t]))
  for (const t of tasks) {
    for (const dep of t.dependsOn || []) {
      if (!keys.has(dep)) return '前置任务不存在'
      if (dep === t.key) return '任务不能依赖自己'
    }
  }

  const visiting = new Set()
  const visited = new Set()
  const hasCycle = (key) => {
    if (visiting.has(key)) return true
    if (visited.has(key)) return false
    visiting.add(key)
    const deps = byKey.get(key)?.dependsOn || []
    for (const dep of deps) {
      if (hasCycle(dep)) return true
    }
    visiting.delete(key)
    visited.add(key)
    return false
  }
  for (const t of tasks) {
    if (hasCycle(t.key)) return '任务前置关系存在循环'
  }

  return ''
}

const logCreatedEvent = (task, by) => {
  if (!Array.isArray(task.events)) task.events = []
  task.events.push({
    id: uid('ev'),
    taskId: task.id,
    projectId: task.projectId,
    type: 'created',
    by,
    at: nowISO(),
    to: task.status
  })
}

// ——— 列表 ———
Mock.mock(/\/api\/templates(\?.*)?$/, 'get', () => ok([...templatesOf()]))

// ——— 新增 ———
Mock.mock('/api/templates', 'post', (options) => {
  const denied = requireManager()
  if (denied) return denied
  const body = JSON.parse(options.body)
  const error = validateTemplate(body)
  if (error) return fail(400, error)

  const template = {
    id: uid('template'),
    name: String(body.name).trim(),
    projectType: String(body.projectType || '').trim(),
    priority: ['低', '中', '高'].includes(body.priority) ? body.priority : '中',
    description: String(body.description || '').trim(),
    fieldIds: [...new Set((body.fieldIds || []).filter(Boolean))],
    tasks: normalizeTasks(body.tasks),
    enabled: body.enabled !== false,
    createdAt: nowISO(),
    updatedAt: nowISO()
  }
  templatesOf().unshift(template)
  save()
  return ok(template)
})

// ——— 编辑 ———
Mock.mock(/\/api\/templates\/[\w-]+$/, 'put', (options) => {
  const denied = requireManager()
  if (denied) return denied
  const id = options.url.split('?')[0].split('/').pop()
  const index = templatesOf().findIndex((t) => t.id === id)
  if (index === -1) return fail(400, '模板不存在')

  const body = JSON.parse(options.body)
  const old = templatesOf()[index]
  const next = { ...old, ...body }
  const error = validateTemplate(next, id)
  if (error) return fail(400, error)

  templatesOf()[index] = {
    ...old,
    name: String(next.name).trim(),
    projectType: String(next.projectType || '').trim(),
    priority: ['低', '中', '高'].includes(next.priority) ? next.priority : '中',
    description: String(next.description || '').trim(),
    fieldIds: [...new Set((next.fieldIds || []).filter(Boolean))],
    tasks: normalizeTasks(next.tasks),
    enabled: next.enabled !== false,
    updatedAt: nowISO()
  }
  save()
  return ok(templatesOf()[index])
})

// ——— 删除：只删模板，不影响已生成项目 ———
Mock.mock(/\/api\/templates\/[\w-]+$/, 'delete', (options) => {
  const denied = requireManager()
  if (denied) return denied
  const id = options.url.split('?')[0].split('/').pop()
  const exists = templatesOf().some((t) => t.id === id)
  if (!exists) return fail(400, '模板不存在')
  db.templates = templatesOf().filter((t) => t.id !== id)
  save()
  return ok(null)
})

// ——— 套用模板：一次性生成项目 + 任务 + 前置关系 ———
Mock.mock(/\/api\/templates\/[\w-]+\/apply$/, 'post', (options) => {
  const denied = requireManager()
  if (denied) return denied
  const id = options.url.split('?')[0].split('/').filter(Boolean).slice(-2)[0]
  const template = templatesOf().find((t) => t.id === id)
  if (!template) return fail(400, '模板不存在')
  if (!template.enabled) return fail(400, '模板已停用，无法使用')

  const body = JSON.parse(options.body)
  const title = String(body.name || '').trim() || template.name
  const startDate = body.startDate
  if (!startDate) return fail(400, '请选择项目开始日期')

  const user = getCurrentUser()
  const PM = body.PM || user?.id || ''
  if (!PM) return fail(400, '请选择项目负责人')
  if (isManager(user) && !canManageAccount(user) && PM !== user?.id) {
    return fail(400, '项目经理使用模板创建项目时，负责人必须是本人')
  }
  const members = [...new Set([PM, ...(body.members || [])])].filter(Boolean)

  // 只保留仍然存在的项目字段
  const validFieldIds = new Set(
    (db.fields || [])
      .filter((f) => f.targetType === 'project' && f.enabled)
      .map((f) => f.id)
  )
  const fieldIds = (template.fieldIds || []).filter((fid) => validFieldIds.has(fid))

  // 先算任务日期，项目结束日取最晚的截止日期
  const keyToId = new Map()
  const tasks = [...template.tasks]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((t) => {
      const taskId = uid('task')
      keyToId.set(t.key, taskId)
      const plannedStart = addDays(startDate, t.startOffset || 0)
      return {
        id: taskId,
        key: t.key,
        title: t.title,
        description: t.description || '',
        priority: t.priority || '中',
        plannedStart,
        dueDate: addDays(plannedStart, Math.max(1, t.duration || 1) - 1),
        dependsOnKeys: t.dependsOn || []
      }
    })

  const endDate = tasks.reduce(
    (max, t) => (t.dueDate > max ? t.dueDate : max),
    startDate
  )

  const projectId = uid('project')
  const project = {
    id: projectId,
    icon: 'Apple',
    title,
    type: template.projectType || '通用',
    desc: template.description || '',
    priority: template.priority || '中',
    PM,
    members,
    status: PROJECT_STATUS.DRAFT,
    createdAt: todayLocal(),
    startDate,
    endDate,
    closedAt: null,
    closedBy: null,
    // 模板勾选的项目字段：限定该项目表单展示哪些字段
    fieldIds,
    extra: {},
    events: []
  }

  const createdBy = user?.id || PM
  for (const t of tasks) {
    const task = {
      id: t.id,
      projectId,
      title: t.title,
      desc: t.description,
      priority: t.priority,
      assignee: '',
      dueDate: t.dueDate,
      status: 'todo',
      createdAt: todayLocal(),
      plannedStart: t.plannedStart,
      dependsOn: t.dependsOnKeys.map((k) => keyToId.get(k)).filter(Boolean),
      createdBy,
      blocked: false,
      blockedReason: '',
      blockedAt: null,
      blockedBy: null,
      deletedAt: null,
      extra: {},
      events: []
    }
    logCreatedEvent(task, createdBy)
    db.tasks.push(task)
  }

  db.projects.unshift(project)
  // 生成的任务默认都是待办，项目应进入「规划」而不是停在「立项」
  syncProjectStatus(project.id)
  save()
  return ok(project)
})