// 把项目结构提取成「项目模板」草稿：任务按计划开始日排序并计算相对偏移
import { todayLocal } from '@/utils/date'
const diffDays = (a, b) =>
    Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000)

export function buildTemplateDraft({ project, tasks, enabledProjectFields = [] }) {
    const list = (tasks || []).filter((t) => t.status !== 'canceled')
    if (!list.length) return null

    const sorted = [...list].sort((a, b) => {
        const sa = a.plannedStart || a.createdAt || ''
        const sb = b.plannedStart || b.createdAt || ''
        if (sa !== sb) return sa < sb ? -1 : 1
        return (a.createdAt || '') < (b.createdAt || '') ? -1 : 1
    })

    const base =
        project.startDate ||
        sorted[0]?.plannedStart ||
        sorted[0]?.createdAt ||
        todayLocal()

    const included = new Set(list.map((t) => t.id))
    const keyOf = (id) => `t_${id}`

    return {
        name: `${project.title}模板`,
        projectType: project.type || '',
        priority: project.priority || '中',
        description: project.desc || '',
        fieldIds: Array.isArray(project.fieldIds)
            ? [...project.fieldIds]
            : enabledProjectFields.map((f) => f.id),
        enabled: true,
        tasks: sorted.map((t) => {
            const start = t.plannedStart || t.createdAt || base
            return {
                key: keyOf(t.id),
                title: t.title,
                description: t.desc || '',
                priority: t.priority || '中',
                startOffset: Math.max(0, diffDays(base, start)),
                duration: t.dueDate ? Math.max(1, diffDays(start, t.dueDate) + 1) : 1,
                dependsOn: (t.dependsOn || [])
                    .filter((id) => included.has(id))
                    .map(keyOf)
            }
        })
    }
}