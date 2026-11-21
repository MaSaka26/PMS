import test from 'node:test'
import assert from 'node:assert/strict'

import { seedProjects } from '../src/mock/db/seed/projects.js'
import { seedTasks } from '../src/mock/db/seed/tasks.js'

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
