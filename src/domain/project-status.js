import { db, save } from '@/mock/db/index.js'
import { PROJECT_STATUS } from '@/constants/status'
import { nowISO } from '@/mock/utils/date.js'
import { uid } from '@/mock/utils/id.js'

// 阶段只进不退：用序号比较，避免任何任务变化把项目状态拉回去
const STAGE_ORDER = {
  [PROJECT_STATUS.DRAFT]: 0,
  [PROJECT_STATUS.PLANNING]: 1,
  [PROJECT_STATUS.ACTIVE]: 2,
  [PROJECT_STATUS.ACCEPTING]: 3,
  [PROJECT_STATUS.ITERATING]: 4
}

import { getCurrentUser } from '@/mock/services/auth.js'

/**
 * 根据项目下的未取消任务推导阶段：
 * 无任务 → 立项；全待办 → 规划；有进行中 → 执行；
 * 无待办/进行中且至少一个待验收 → 验收；全部已验收 → 收尾。
 */
export const deriveProjectStage = (tasks) => {
  const active = (tasks || []).filter((t) => !t.deletedAt && t.status !== 'canceled')
  if (!active.length) return PROJECT_STATUS.DRAFT
  if (active.every((t) => t.status === 'accepted')) return PROJECT_STATUS.ITERATING

  const hasTodo = active.some((t) => t.status === 'todo')
  const hasDoing = active.some((t) => t.status === 'doing')
  const hasDone = active.some((t) => t.status === 'done')

  if (!hasTodo && !hasDoing && hasDone) return PROJECT_STATUS.ACCEPTING
  if (hasDoing) return PROJECT_STATUS.ACTIVE
  return PROJECT_STATUS.PLANNING
}

// 只在推导阶段更高时推进，并留一条项目级事件
const applyDerived = (project) => {
  if (!project || project.status === PROJECT_STATUS.ARCHIVED) return false

  const derived = deriveProjectStage(
    db.tasks.filter((t) => t.projectId === project.id)
  )
  const currentRank = STAGE_ORDER[project.status] ?? -1
  const derivedRank = STAGE_ORDER[derived] ?? 0
  if (derivedRank <= currentRank) return false

  const from = project.status
  project.status = derived
  const user = getCurrentUser()
  if (!Array.isArray(project.events)) project.events = []
  project.events.push({
    id: uid('pev'),
    projectId: project.id,
    type: 'project_status',
    by: user?.id || '',
    at: nowISO(),
    from,
    to: derived
  })
  return true
}

// 任务写操作后调用：同步单个项目
export const syncProjectStatus = (projectId) => {
  const project = db.projects.find((p) => p.id === projectId)
  if (!project) return null
  if (applyDerived(project)) save()
  return project
}

// 读取项目列表/详情时兜底：批量规范化，只保存一次
export const normalizeProjectStatuses = (projects) => {
  let changed = false
  for (const project of projects || []) {
    if (applyDerived(project)) changed = true
  }
  if (changed) save()
}