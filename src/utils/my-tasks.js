// 侧栏徽标与「我的任务」页面共用同一份收件箱口径。
// 原则：只算本人该做的任务（我负责 / 待我验收 / 我建的待认领），
// 再把其中已过截止日的作为「逾期」；管理员管别人的任务不算进来。
import { canReviewTask } from '@/utils/permissions'
import { getDueLevel } from '@/utils/due'

export const isTaskOverdue = (task) => getDueLevel(task?.dueDate, task?.status)?.level === 'overdue'

// 返回 { mine, review, created, all, overdue }，同一任务可同时落入多个桶
export function buildMyTaskBuckets(tasks, { me, getProject }) {
    const buckets = { mine: [], review: [], created: [], all: [], overdue: [] }
    if (!me?.id) return buckets
    for (const { task, projectId } of tasks || []) {
        if (!task || task.deletedAt || task.status === 'canceled') continue
        let bucketThis = false
        if (task.assignee === me.id && task.status !== 'accepted') {
            buckets.mine.push(task)
            bucketThis = true
        }
        if (task.status === 'done' && task.assignee !== me.id && canReviewTask(me, getProject?.(projectId))) {
            buckets.review.push(task)
            bucketThis = true
        }
        if (!task.assignee && task.status === 'todo' && task.createdBy === me.id) {
            buckets.created.push(task)
            bucketThis = true
        }
        if (bucketThis) {
            buckets.all.push(task)
            if (isTaskOverdue(task)) buckets.overdue.push(task)
        }
    }
    return buckets
}

export const countMyPendingTasks = (buckets) => new Set(buckets.all.map((t) => t.id)).size
