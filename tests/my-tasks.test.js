import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMyTaskBuckets, countMyPendingTasks, isTaskOverdue } from '../src/utils/my-tasks.js'

const admin = { id: 'u1', role: 'admin' }
const project = { id: 'p1', PM: 'u1', members: ['u1', 'u2'] }
const getProject = () => project
const task = (over) => ({ id: 'x', status: 'todo', dueDate: '2026-11-01', ...over })

test('我的任务只统计本人负责/待验收/我建待认领，不含全局逾期', () => {
    const tasks = [
        { task: task({ id: 'mine', assignee: 'u1' }), projectId: 'p1' },
        { task: task({ id: 'review', status: 'done', assignee: 'u2' }), projectId: 'p1' },
        { task: task({ id: 'created', assignee: null, createdBy: 'u1' }), projectId: 'p1' },
        { task: task({ id: 'others-overdue', assignee: 'u2', dueDate: '2020-01-01', createdBy: 'u2' }), projectId: 'p1' },
        { task: task({ id: 'canceled', assignee: 'u1', status: 'canceled' }), projectId: 'p1' }
    ]
    const b = buildMyTaskBuckets(tasks, { me: admin, getProject })
    assert.deepEqual(b.mine.map(t=>t.id), ['mine'])
    assert.deepEqual(b.review.map(t=>t.id), ['review'])
    assert.deepEqual(b.created.map(t=>t.id), ['created'])
    assert.deepEqual(b.all.map(t=>t.id).sort(), ['created', 'mine', 'review'])
    assert.equal(countMyPendingTasks(b), 3)
    assert.equal(isTaskOverdue(task({ dueDate: '2020-01-01' })), true)
})

test('逾期只统计本人三类事务里过截止日的', () => {
    const tasks = [
        { task: task({ id: 'mine-overdue', assignee: 'u1', dueDate: '2020-01-01' }), projectId: 'p1' },
        { task: task({ id: 'others-overdue', assignee: 'u2', dueDate: '2020-01-01' }), projectId: 'p1' }
    ]
    const b = buildMyTaskBuckets(tasks, { me: admin, getProject })
    assert.deepEqual(b.overdue.map(t=>t.id), ['mine-overdue'])
})
