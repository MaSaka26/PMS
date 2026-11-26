import Mock from 'mockjs'
import { db, save } from '../db/index.js'
import { canManageProject, isAdmin, isProjectMember } from '@/utils/permissions'
import { PROJECT_STATUS } from '@/constants/status'
import { uid } from '../utils/id.js'
import { nowISO, todayLocal } from '@/utils/date.js'
import { fail, ok } from '../utils/response.js'
import { getCurrentUser } from '../services/auth.js'
import { deriveMilestoneStatus, milestoneDelayDetails } from '@/domain/milestone.js'

const MS_STATUSES = ['todo', 'doing', 'done', 'accepted', 'canceled']

const stripTasks = (m) => ({ ...m })

// 列表：支持 ?projectId=，附带子任务进度（纯计算，不改数据）
Mock.mock(/\/api\/milestones(\?.*)?$/, 'get', (options) => {
  const url = new URL(options.url, 'http://localhost')
  const projectId = url.searchParams.get('projectId') || ''
  let list = (db.milestones || []).filter((m) => !m.deletedAt)
  if (projectId) list = list.filter((m) => m.projectId === projectId)
  return ok(list.map((m) => {
    const children = (db.tasks || []).filter((t) => t.milestoneId === m.id && !t.deletedAt)
    const status = deriveMilestoneStatus(m, db.tasks || [])
    const delay = milestoneDelayDetails(m, db.tasks || [])
    const done = children.filter((t) => t.status === 'accepted').length
    return { ...stripTasks(m), status, progress: { done, total: children.length }, delayDays: delay.length ? Math.abs(Math.min(...children.filter(t=>t.dueDate).map(t=>new Date(t.dueDate).getTime() - new Date(todayLocal()).getTime()).concat([0])) / 86400000) || 0 : 0, hasDelay: delay.length > 0 }
  }))
})

// 详情：含子任务
Mock.mock(/\/api\/milestones\/[\w-]+$/, 'get', (options) => {
  const id = options.url.split('/').pop()
  const m = (db.milestones || []).find((x) => x.id === id && !x.deletedAt)
  if (!m) return fail(404, '里程碑不存在')
  const children = (db.tasks || []).filter((t) => t.milestoneId === m.id && !t.deletedAt)
  return ok({ ...m, status: deriveMilestoneStatus(m, db.tasks || []), children, delay: milestoneDelayDetails(m, db.tasks || []) })
})

// 新建：仅管理员 / 项目负责人
Mock.mock('/api/milestones', 'post', (options) => {
  const user = getCurrentUser()
  if (!user) return fail(401, '请先登录')
  const body = JSON.parse(options.body)
  const project = db.projects.find((p) => p.id === body.projectId)
  if (!project) return fail(404, '项目不存在')
  if (!canManageProject(user, project)) return fail(403, '只有项目负责人或管理员可以新建里程碑')
  const title = String(body.title || '').trim()
  if (!title) return fail(400, '里程碑标题不能为空')
  if (body.dueDate && body.startDate && body.dueDate < body.startDate) return fail(400, '截止日期不能早于开始日期')
  const duration = body.duration === undefined || body.duration === null || body.duration === '' ? 1 : Number(body.duration)
  if (!Number.isInteger(duration) || duration < 1 || duration > 365) return fail(400, '计划工期必须是 1-365 的整数（天）')
  const m = {
    id: uid('ms'), projectId: body.projectId, title,
    desc: String(body.desc || ''), code: String(body.code || ''),
    status: 'todo', owner: body.owner || user.id,
    startDate: body.startDate || todayLocal(), dueDate: body.dueDate || body.startDate || '', duration,
    commitment: body.commitment || null,
    commitHashes: [], deletedAt: null, createdAt: nowISO(), createdBy: user.id
  }
  db.milestones.push(m)
  save()
  return ok(m)
})

// 编辑
Mock.mock(/\/api\/milestones\/[\w-]+$/, 'put', (options) => {
  const id = options.url.split('/').pop()
  const m = (db.milestones || []).find((x) => x.id === id && !x.deletedAt)
  if (!m) return fail(404, '里程碑不存在')
  const project = db.projects.find((p) => p.id === m.projectId)
  const user = getCurrentUser()
  if (!canManageProject(user, project)) return fail(403, '只有项目负责人或管理员可以编辑里程碑')
  const body = JSON.parse(options.body)
  if (body.title !== undefined) {
    const title = String(body.title).trim()
    if (!title) return fail(400, '里程碑标题不能为空')
    m.title = title
  }
  for (const key of ['desc', 'code', 'status', 'startDate', 'dueDate', 'commitment']) {
    if (body[key] !== undefined) m[key] = body[key]
  }
  if (body.duration !== undefined) {
    const duration = Number(body.duration)
    if (!Number.isInteger(duration) || duration < 1 || duration > 365) return fail(400, '计划工期必须是 1-365 的整数（天）')
    m.duration = duration
  }
  save()
  return ok(m)
})

// 删除（软删除，子任务解除关联但保留）
Mock.mock(/\/api\/milestones\/[\w-]+$/, 'delete', (options) => {
  const id = options.url.split('/').pop()
  const m = (db.milestones || []).find((x) => x.id === id && !x.deletedAt)
  if (!m) return fail(404, '里程碑不存在')
  const project = db.projects.find((p) => p.id === m.projectId)
  const user = getCurrentUser()
  if (!canManageProject(user, project)) return fail(403, '只有项目负责人或管理员可以删除里程碑')
  m.deletedAt = nowISO()
  for (const t of db.tasks || []) if (t.milestoneId === id) t.milestoneId = ''
  save()
  return ok(null)
})
