import test from 'node:test'
import assert from 'node:assert/strict'
import {
    isAdmin,
    isManager,
    isProjectMember,
    canManageProject,
    canCreateProject,
    canEditTask,
    canDeleteTask,
    canReviewTask,
    isSelfReview,
    canManageFields,
    canManageTemplates
} from '../src/utils/permissions.js'

const admin = { id: 'u1', role: 'admin' }
const pm = { id: 'u2', role: 'pm' }
const member = { id: 'u3', role: 'member' }

const project = { PM: 'u2', members: ['u2', 'u3'] }

test('角色判断', () => {
    assert.equal(isAdmin(admin), true)
    assert.equal(isAdmin(pm), false)
    assert.equal(isManager(admin), true)
    assert.equal(isManager(pm), true)
    assert.equal(isManager(member), false)
})

test('项目成员判断', () => {
    assert.equal(isProjectMember(member, project), true)
    assert.equal(isProjectMember(admin, project), false)
    assert.equal(isProjectMember(null, project), false)
})

test('项目管理权限', () => {
    assert.equal(canManageProject(admin, project), true)
    assert.equal(canManageProject(pm, project), true)
    assert.equal(canManageProject(member, project), false)
    assert.equal(canCreateProject(admin), true)
    assert.equal(canCreateProject(pm), true)
    assert.equal(canCreateProject(member), false)
})

test('任务编辑与删除权限', () => {
    const task = { createdBy: 'u3', assignee: 'u3' }
    assert.equal(canEditTask(admin, project, task), true)
    assert.equal(canEditTask(pm, project, task), true)
    assert.equal(canEditTask(member, project, task), true)
    assert.equal(canEditTask({ id: 'u9', role: 'member' }, project, task), false)

    const otherTask = { createdBy: 'u2', assignee: 'u2' }
    assert.equal(canEditTask(member, project, otherTask), false)
    assert.equal(canDeleteTask(admin, project), true)
    assert.equal(canDeleteTask(pm, project), true)
    assert.equal(canDeleteTask(member, project), false)
})

test('验收权限只认管理员和项目负责人', () => {
    assert.equal(canReviewTask(admin, project), true)
    assert.equal(canReviewTask(pm, project), true)
    assert.equal(canReviewTask(member, project), false)
    // 别的项目的 PM 不能来验收
    const otherProject = { PM: 'u9', members: ['u2', 'u3'] }
    assert.equal(canReviewTask(pm, otherProject), false)
    // 没有项目时不能验收（防止 project 未加载时误开权限）
    assert.equal(canReviewTask(admin, null), true)
    assert.equal(canReviewTask(pm, null), false)
})

test('自己验收自己：只标记不拦截', () => {
    const own = { assignee: 'u1', status: 'done' }
    const others = { assignee: 'u3', status: 'done' }
    assert.equal(isSelfReview(admin, own), true)
    assert.equal(isSelfReview(admin, others), false)
    assert.equal(isSelfReview(null, own), false)
    // 无负责人（待认领）不算自验收
    assert.equal(isSelfReview(admin, { assignee: null }), false)
    // 关键：权限判断本身不受 isSelfReview 影响，否则项目阶段会卡死
    assert.equal(canReviewTask(admin, project), true)
})

test('字段与模板权限', () => {
    assert.equal(canManageFields(admin), true)
    assert.equal(canManageFields(pm), false)
    assert.equal(canManageFields(member), false)
    assert.equal(canManageTemplates(admin), true)
    assert.equal(canManageTemplates(pm), true)
    assert.equal(canManageTemplates(member), false)
})
