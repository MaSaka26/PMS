import Mock from 'mockjs'
import { db, save } from '../db/index.js'
import { normalizeProjectStatuses, syncProjectStatus } from '../rules/projectStatus.js'
import { PROJECT_STATUS } from '@/constants/status'
import { nowISO } from '../utils/date.js'
import { idBeforeTail, uid } from '../utils/id.js'
import { paginate } from '../utils/pagination.js'
import { fail, ok } from '../utils/response.js'

import { getCurrentUser } from '../services/auth.js'

const isAdmin = (user) => user?.role === 'admin'
const isPM = (user, project) => !!user && project?.PM === user.id

// 项目计划周期校验
const validateProjectDates = (startDate, endDate) =>
  startDate && endDate && endDate < startDate ? '项目结束日期不能早于开始日期' : ''

// 项目级事件（关闭 / 撤销归档），和任务事件分开存
const logProjectEvent = (project, { type, reason }) => {
  const user = getCurrentUser()
  if (!Array.isArray(project.events)) project.events = []
  project.events.push({
    id: uid('pev'),
    projectId: project.id,
    type,
    by: user?.id || '',
    at: nowISO(),
    ...(reason ? { reason } : {})
  })
}

// 列表：支持关键字、分页、归档范围（active=未归档 / archived=已归档 / all=全部）
// 归档不是"搬家"，只是同一份数据的另一个筛选条件
Mock.mock(/\/api\/projects(\?.*)?$/, 'get', (options) => {
  const url = new URL(options.url, 'http://localhost')
  const keyword = (url.searchParams.get('keyword') || '').trim()
  const page = Number(url.searchParams.get('page')) || 1
  const size = Number(url.searchParams.get('size')) || 10
  const scope = url.searchParams.get('scope') || 'active'
  // all：全部；exclude：只看普通项目；only：只看置顶项目
  const pinned = url.searchParams.get('pinned') || 'all'

  let list = db.projects
  if (scope === 'active') list = list.filter((p) => p.status !== PROJECT_STATUS.ARCHIVED)
  else if (scope === 'archived') list = list.filter((p) => p.status === PROJECT_STATUS.ARCHIVED)

  if (pinned === 'only') list = list.filter((p) => !!p.pinned)
  else if (pinned === 'exclude') list = list.filter((p) => !p.pinned)

  // 非项目成员看不到项目（admin 全局可见）
  const user = getCurrentUser()
  if (user && !isAdmin(user)) {
    list = list.filter((p) => p.PM === user.id || (p.members || []).includes(user.id))
  }

  if (keyword) {
    list = list.filter((p) => p.title.includes(keyword) || p.type.includes(keyword))
  }
  // 读取时兜底：把任务已经推进、但项目状态还落后的数据补上
  normalizeProjectStatuses(list)
  return ok(paginate(list, page, size))
})

// 新增：新项目状态固定为立项，负责人必须出现在成员里
Mock.mock('/api/projects', 'post', (options) => {
  const body = JSON.parse(options.body)
  const user = getCurrentUser()
  if (!user || !['admin', 'pm'].includes(user.role)) {
    return fail(403, '只有管理员或项目经理可以创建项目')
  }
  if (!body.PM) return fail(400, '请选择项目负责人')
  if (user.role === 'pm' && body.PM !== user.id) {
    return fail(403, '项目经理创建项目时，负责人必须是本人')
  }
  const dateError = validateProjectDates(body.startDate, body.endDate)
  if (dateError) return fail(400, dateError)
  const project = {
    id: uid('project'),
    ...body,
    status: PROJECT_STATUS.DRAFT,
    createdAt: body.createdAt || new Date().toISOString().slice(0, 10),
    startDate: body.startDate || body.createdAt || new Date().toISOString().slice(0, 10),
    endDate: body.endDate || '',
    closedAt: null,
    closedBy: null,
    events: [],
    // 置顶：置顶项目进入独立泳道，不再出现在普通项目泳道
    pinned: false,
    members: [...new Set([body.PM, ...(body.members || [])])].filter(Boolean),
    // 项目自定义字段值：{ [fieldId]: value }
    extra: body.extra && typeof body.extra === 'object' ? { ...body.extra } : {},
  }
  db.projects.unshift(project)
  save()
  return ok(project)
})

// 置顶 / 取消置顶：项目负责人或管理员
Mock.mock(/\/api\/projects\/[\w-]+\/pin$/, 'put', (options) => {
  const id = idBeforeTail(options.url)
  const body = JSON.parse(options.body)
  const project = db.projects.find((p) => p.id === id)
  if (!project) return fail(404, '项目不存在')
  const user = getCurrentUser()
  if (!(isAdmin(user) || isPM(user, project))) {
    return fail(403, '只有项目负责人或管理员可以置顶项目')
  }
  project.pinned = !!body.pinned
  save()
  return ok(project)
})

// 调整同一泳道内的顺序：与相邻项目交换数组位置
Mock.mock(/\/api\/projects\/[\w-]+\/move$/, 'put', (options) => {
  const id = idBeforeTail(options.url)
  const body = JSON.parse(options.body)
  const project = db.projects.find((p) => p.id === id)
  if (!project) return fail(404, '项目不存在')
  const user = getCurrentUser()
  if (!(isAdmin(user) || isPM(user, project))) {
    return fail(403, '只有项目负责人或管理员可以调整项目顺序')
  }
  const lane = db.projects.filter((p) => !!p.pinned === !!project.pinned)
  const pos = lane.findIndex((p) => p.id === id)
  const target = body.direction === 'up' ? pos - 1 : pos + 1
  if (target < 0 || target >= lane.length) return ok(project)
  const a = db.projects.indexOf(lane[pos])
  const b = db.projects.indexOf(lane[target])
  ;[db.projects[a], db.projects[b]] = [db.projects[b], db.projects[a]]
  save()
  return ok(project)
})

// 编辑：已归档项目只读
Mock.mock(/\/api\/projects\/\w+$/, 'put', (options) => {
  const id = options.url.split('?')[0].split('/').pop()
  const body = JSON.parse(options.body)
  const index = db.projects.findIndex((p) => p.id === id)
  if (index === -1) return fail(404, '项目不存在')
  const current = db.projects[index]
  const user = getCurrentUser()
  if (!(isAdmin(user) || isPM(user, current))) {
    return fail(403, '只有项目负责人或管理员可以编辑项目')
  }
  if (!isAdmin(user) && body.PM !== undefined && body.PM !== current.PM) {
    return fail(403, '只有管理员可以变更项目负责人')
  }
  if (current.status === PROJECT_STATUS.ARCHIVED) {
    return fail(403, '项目已归档，仅可查看')
  }
  const nextStart = body.startDate !== undefined ? body.startDate : db.projects[index].startDate
  const nextEnd = body.endDate !== undefined ? body.endDate : db.projects[index].endDate
  const dateError = validateProjectDates(nextStart, nextEnd)
  if (dateError) return fail(400, dateError)
  db.projects[index] = {
    ...db.projects[index],
    ...body,
    id,
    members: [...new Set([body.PM, ...(body.members || [])])].filter(Boolean),
    extra: body.extra !== undefined
      ? (body.extra && typeof body.extra === 'object' ? { ...body.extra } : {})
      : (db.projects[index].extra || {}),
  }
  save()
  return ok(db.projects[index])
})

// 删除：项目软删除 + 任务级联软删除（保留数据，供追溯）
Mock.mock(/\/api\/projects\/\w+$/, 'delete', (options) => {
  const id = options.url.split('?')[0].split('/').pop()
  const project = db.projects.find((p) => p.id === id)
  if (!project) return fail(404, '项目不存在')
  const user = getCurrentUser()
  if (!(isAdmin(user) || isPM(user, project))) {
    return fail(403, '只有项目负责人或管理员可以删除项目')
  }
  db.projects = db.projects.filter((p) => p.id !== id)
  const at = nowISO()
  db.tasks.forEach((t) => {
    if (t.projectId === id && !t.deletedAt) t.deletedAt = at
  })
  save()
  return ok(null)
})

// 关闭项目 → 自动进入归档视图
Mock.mock(/\/api\/projects\/\w+\/close$/, 'post', (options) => {
  const id = options.url.split('?')[0].split('/').filter(Boolean).slice(-2)[0]
  const body = JSON.parse(options.body || '{}')
  const project = db.projects.find((p) => p.id === id)
  if (!project) return fail(404, '项目不存在')
  const user = getCurrentUser()
  if (!(isAdmin(user) || isPM(user, project))) {
    return fail(403, '只有项目负责人或管理员可以关闭项目')
  }
  if (project.status === PROJECT_STATUS.ARCHIVED) return fail(400, '项目已归档')

  project.status = PROJECT_STATUS.ARCHIVED
  project.closedAt = nowISO()
  project.closedBy = user?.id || ''
  logProjectEvent(project, { type: 'project_closed', reason: body.reason })
  save()
  return ok(project)
})

// 撤销归档：项目恢复为执行中，任务原样恢复可编辑（不恢复已软删除的任务）
Mock.mock(/\/api\/projects\/\w+\/reopen$/, 'post', (options) => {
  const id = options.url.split('?')[0].split('/').filter(Boolean).slice(-2)[0]
  const project = db.projects.find((p) => p.id === id)
  if (!project) return fail(404, '项目不存在')
  const user = getCurrentUser()
  if (!(isAdmin(user) || isPM(user, project))) {
    return fail(403, '只有项目负责人或管理员可以撤销归档')
  }
  if (project.status !== PROJECT_STATUS.ARCHIVED) return fail(400, '项目未归档')

  // 回到立项后按任务重新推导，避免固定在“执行中”
  project.status = PROJECT_STATUS.DRAFT
  project.closedAt = null
  project.closedBy = null
  logProjectEvent(project, { type: 'project_reopened' })
  syncProjectStatus(project.id)
  save()
  return ok(project)
})

// 项目详情：非成员不可见（admin 全局可见）
Mock.mock(/\/api\/projects\/[\w-]+$/, 'get', (options) => {
  const id = options.url.split('?')[0].split('/').pop()
  const project = db.projects.find((p) => p.id === id)
  if (!project) return fail(404, '项目不存在')
  const user = getCurrentUser()
  const allowed = isAdmin(user) || isPM(user, project) || (project.members || []).includes(user?.id)
  if (!allowed) return fail(403, '你不是该项目成员，无权查看')
  syncProjectStatus(project.id)
  return ok(project)
})

// 项目动态：聚合该项目下所有任务事件 + 项目级事件，按时间倒序分页
// 默认过滤编辑类噪音（includeEdited=1 时返回）
Mock.mock(/\/api\/projects\/\w+\/activities(\?.*)?$/, 'get', (options) => {
  const url = new URL(options.url, 'http://localhost')
  const id = options.url.split('?')[0].split('/').filter(Boolean).slice(-2)[0]
  const project = db.projects.find((p) => p.id === id)
  if (!project) return fail(404, '项目不存在')
  const user = getCurrentUser()
  const allowed = isAdmin(user) || isPM(user, project) || (project.members || []).includes(user?.id)
  if (!allowed) return fail(403, '你不是该项目成员，无权查看')

  const page = Number(url.searchParams.get('page')) || 1
  const size = Number(url.searchParams.get('size')) || 30
  const includeEdited = url.searchParams.get('includeEdited') === '1'

  let list = []
  for (const t of db.tasks) {
    if (t.projectId !== id) continue
    for (const ev of t.events || []) {
      list.push({ ...ev, taskTitle: t.title, source: 'task' })
    }
  }
  for (const ev of project.events || []) {
    list.push({ ...ev, source: 'project' })
  }
  list.sort((a, b) => String(b.at).localeCompare(String(a.at)))
  if (!includeEdited) list = list.filter((ev) => ev.type !== 'edited')

  return ok(paginate(list, page, size))
})
