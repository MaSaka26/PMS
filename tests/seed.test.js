import test from 'node:test'
import assert from 'node:assert/strict'

import { seedProjects } from '../src/mock/db/seed/projects.js'
import { seedMilestones, seedTasks } from '../src/mock/db/seed/tasks.js'

const projectMap = new Map(seedProjects.map((p) => [p.id, p]))

// 种子数据是静态写入的，不经过 mock 接口校验，所以这里补一层回归测试，
// 避免手工调整任务日期或重新生成 git 种子后出现「任务截止晚于项目结束」之类的矛盾
test('种子任务日期必须满足项目周期与先后顺序', () => {
    for (const task of seedTasks) {
        const project = projectMap.get(task.projectId)
        assert.ok(project, `任务 ${task.id} 找不到所属项目 ${task.projectId}`)

        if (task.createdAt && task.dueDate) {
            assert.ok(
                task.dueDate >= task.createdAt,
                `任务 ${task.id} 截止日期 ${task.dueDate} 早于创建日期 ${task.createdAt}`
            )
        }
        if (task.plannedStart && task.dueDate) {
            assert.ok(
                task.dueDate >= task.plannedStart,
                `任务 ${task.id} 截止日期 ${task.dueDate} 早于计划开始 ${task.plannedStart}`
            )
        }
        if (project.startDate && task.plannedStart) {
            assert.ok(
                task.plannedStart >= project.startDate,
                `任务 ${task.id} 计划开始 ${task.plannedStart} 早于项目开始 ${project.startDate}`
            )
        }
        if (project.endDate && task.dueDate) {
            assert.ok(
                task.dueDate <= project.endDate,
                `任务 ${task.id} 截止日期 ${task.dueDate} 晚于项目结束 ${project.endDate}`
            )
        }
    }
})


test('每个种子项目都有里程碑，任务的 milestoneId 必须指向同项目里程碑', () => {
    const projectIds = new Set(seedProjects.map((p) => p.id))
    const milestoneIds = new Set(seedMilestones.map((m) => m.id))
    assert.equal(milestoneIds.size, seedMilestones.length, '里程碑 id 不能重复')

    for (const project of seedProjects) {
        const own = seedMilestones.filter((m) => m.projectId === project.id && !m.deletedAt)
        assert.ok(own.length >= 1, `项目 ${project.id} 没有里程碑`)
        for (const m of own) {
            assert.ok(projectIds.has(m.projectId), `里程碑 ${m.id} 找不到所属项目`)
            if (m.startDate && m.dueDate) {
                assert.ok(m.dueDate >= m.startDate, `里程碑 ${m.id} 截止日期早于开始日期`)
            }
        }
    }

    for (const task of seedTasks) {
        if (!task.milestoneId) continue
        const ms = seedMilestones.find((m) => m.id === task.milestoneId)
        assert.ok(ms, `任务 ${task.id} 的 milestoneId ${task.milestoneId} 不存在`)
        assert.equal(
            ms.projectId,
            task.projectId,
            `任务 ${task.id} 的里程碑 ${ms.id} 不属于同一个项目`
        )
    }
})

test('种子项目结束日期不早于开始日期', () => {
    for (const project of seedProjects) {
        if (project.startDate && project.endDate) {
            assert.ok(
                project.endDate >= project.startDate,
                `项目 ${project.id} 结束日期 ${project.endDate} 早于开始日期 ${project.startDate}`
            )
        }
    }
})
