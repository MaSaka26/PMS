// domain 层规则单测：不加载 mock 数据层、不碰 localStorage，验证「纯函数真的纯」。
import test from 'node:test'
import assert from 'node:assert/strict'
import { deriveProjectStage } from '../src/domain/project-status.js'
import { validateDependencies, validateTransition, diffChanges } from '../src/domain/task-rules.js'

const tasks = (list, projectId = 'p1') => list.map((s) => ({ id: s[0], projectId, status: s[1], dependsOn: [] }))

test('deriveProjectStage 纯函数：只依赖传入的任务数组', () => {
    assert.equal(deriveProjectStage([]), 'draft')
    assert.equal(deriveProjectStage(tasks([['a', 'todo']])), 'planning')
    assert.equal(deriveProjectStage(tasks([['a', 'doing']])), 'active')
    assert.equal(deriveProjectStage(tasks([['a', 'done']])), 'accepting')
    assert.equal(deriveProjectStage(tasks([['a', 'accepted']])), 'iterating')
    // 已取消的不算活跃任务
    assert.equal(deriveProjectStage(tasks([['a', 'canceled']])), 'draft')
})

test('validateDependencies 接受注入的任务集，无需加载 mock db', () => {
    const list = tasks([['a', 'doing'], ['b', 'todo']])
    list[1].dependsOn = ['a']
    assert.equal(validateDependencies('b', 'p1', ['a'], list), '')
    list[0].dependsOn = ['b']
    assert.match(validateDependencies('b', 'p1', ['a'], list), /环/)
    assert.match(validateDependencies('b', 'p1', ['b'], list), /自己/)
})

test('状态机与字段留痕是纯函数', () => {
    assert.equal(validateTransition('todo', 'doing').ok, true)
    assert.equal(validateTransition('todo', 'accepted').ok, false)
    assert.equal(diffChanges({ title: '旧' }, { title: '新' })[0].field, 'title')
})
