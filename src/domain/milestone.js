import { PROJECT_STATUS } from '@/constants/status'
import { diffDays } from '@/utils/due'

// 里程碑是一类独立实体（不是任务），状态由它下面的子任务汇总（人只管做任务）。
// 状态与日期分离：逾期完成仍算完成，日期上单独标记。
export const deriveMilestoneStatus = (milestone, tasks) => {
  const children = (tasks || []).filter((t) => t.milestoneId === milestone?.id && !t.deletedAt)
  if (!children.length) return milestone?.status || 'todo'
  if (children.every((t) => t.status === 'accepted')) return 'accepted'
  if (children.some((t) => t.status === 'canceled')) {
    const active = children.filter((t) => t.status !== 'canceled')
    if (!active.length) return 'canceled'
    if (active.every((t) => t.status === 'accepted')) return 'accepted'
  }
  if (children.some((t) => t.status === 'done')) return 'done'
  if (children.some((t) => t.status === 'doing')) return 'doing'
  if (children.every((t) => t.status === 'todo')) return 'todo'
  return milestone?.status || 'todo'
}

// 里程碑承诺逾期时，列出拖慢进度的子任务：未验收的 + 已验收但自己也逾期的（迟交）。
export const milestoneDelayDetails = (milestone, tasks, today = new Date()) => {
  const due = milestone?.commitment?.dueDate || milestone?.dueDate
  if (!due || diffDays(due, today) >= 0) return []
  return (tasks || [])
    .filter((t) => t.milestoneId === milestone?.id && !t.deletedAt && t.status !== 'canceled')
    .map((t) => {
      const days = t.dueDate ? diffDays(t.dueDate, today) : null
      const pending = t.status !== 'accepted'
      return {
        id: t.id,
        title: t.title,
        status: t.status,
        dueDate: t.dueDate,
        days,
        overdue: days !== null && days < 0,
        doneLate: t.status === 'accepted' && days !== null && days < 0,
        pending
      }
    })
    .filter((x) => x.pending || x.doneLate)
    .sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999))
}

// 项目阶段：有里程碑的项目由里程碑汇总；没有里程碑的旧项目保持原任务汇总逻辑。
export const deriveProjectStage = (tasks, milestones = []) => {
  const ms = (milestones || []).filter((m) => !m.deletedAt && m.status !== 'canceled')
  const active = ms.length
    ? ms.map((m) => ({ ...m, status: deriveMilestoneStatus(m, tasks) }))
    : (tasks || []).filter((t) => !t.deletedAt && t.status !== 'canceled')
  if (!active.length) return PROJECT_STATUS.DRAFT
  if (active.every((t) => t.status === 'accepted')) return PROJECT_STATUS.ITERATING
  const hasTodo = active.some((t) => t.status === 'todo')
  const hasDoing = active.some((t) => t.status === 'doing')
  const hasDone = active.some((t) => t.status === 'done')
  if (!hasTodo && !hasDoing && hasDone) return PROJECT_STATUS.ACCEPTING
  if (hasDoing) return PROJECT_STATUS.ACTIVE
  return PROJECT_STATUS.PLANNING
}
