import Mock from 'mockjs'
import { db, save } from '../db/index.js'
import { canCreateMember, canEditMember, canManageAccount, canChangeRole, canToggleMemberActive, canDeleteMember, isManager } from '@/utils/permissions'
import { uid } from '../utils/id.js'
import { ROLE, ROLES } from '@/constants/user'
import { fail, ok } from '../utils/response.js'

import { getCurrentUser } from '../services/auth.js'

// 成员返回时附带登录账号（只给用户名，不返回密码）
const withAccount = (member) => {
  const account = (db.users || []).find((u) => u.id === member.id)
  return { ...member, username: account?.username || '' }
}

// 列表：支持 keyword（匹配 name / role / position）
Mock.mock(/\/api\/members(\?.*)?$/, 'get', (options) => {
  const url = new URL(options.url, 'http://localhost')
  const keyword = (url.searchParams.get('keyword') || '').trim()
  const list = keyword
    ? db.members.filter(
        (m) =>
          m.name.includes(keyword) ||
          (m.role || '').includes(keyword) ||
          (m.position || '').includes(keyword)
      )
    : db.members
  return ok(list.map(withAccount))
})

// 新增：admin / pm 可以添加；pm 只能添加普通成员
Mock.mock('/api/members', 'post', (options) => {
  const user = getCurrentUser()
  if (!canCreateMember(user)) {
    return fail(403, '只有管理员或项目经理可以添加成员')
  }

  const body = JSON.parse(options.body)
  const name = String(body.name || '').trim()
  if (!name) return fail(400, '成员姓名不能为空')

  let role = ROLES.includes(body.role) ? body.role : ROLE.MEMBER
  if (isManager(user) && !canManageAccount(user) && role !== ROLE.MEMBER) {
    return fail(403, '项目经理只能添加普通成员')
  }

  // 可选：同时开通登录账号
  const username = String(body.username || '').trim()
  const password = String(body.password || '')
  if (username) {
    if (!canManageAccount(user)) {
      return fail(403, '只有管理员可以开通登录账号')
    }
    if (password.length < 4) return fail(400, '初始密码至少 4 位')
    if (db.users.some((u) => u.username === username)) {
      return fail(400, '用户名已存在')
    }
  }

  const member = {
    id: uid('member'),
    name,
    role,
    position: String(body.position || '').trim(),
    email: String(body.email || '').trim(),
    active: true
  }
  db.members.push(member)
  if (username) {
    db.users.push({
      id: member.id,
      username,
      password,
      name: member.name,
      role: member.role
    })
  }
  save()
  return ok(withAccount(member))
})

// 编辑：admin 可改全部；pm 可改自己或普通成员；普通成员只能改自己
Mock.mock(/\/api\/members\/\w+/, 'put', (options) => {
  const user = getCurrentUser()
  if (!user) return fail(401, '请先登录')

  const id = options.url.split('?')[0].split('/').pop()
  const index = db.members.findIndex((m) => m.id === id)
  if (index === -1) return fail(404, '成员不存在')

  const target = db.members[index]
  if (!canEditMember(user, target)) return fail(403, '没有权限修改该成员')

  const body = JSON.parse(options.body)
  const roleChanged = body.role !== undefined && body.role !== target.role
  // 角色只有管理员可以改；其他人即使传了也直接拒绝
  if (roleChanged && !canChangeRole(user)) {
    return fail(403, '只有管理员可以修改角色')
  }
  if (roleChanged && !ROLES.includes(body.role)) {
    return fail(400, '角色不合法')
  }
  // 不能把最后一个启用管理员降级，否则系统没人能管成员、字段和模板
  if (
    roleChanged &&
    target.role === ROLE.ADMIN &&
    body.role !== ROLE.ADMIN &&
    db.members.filter((m) => m.role === ROLE.ADMIN && m.active !== false).length <= 1
  ) {
    return fail(400, '至少需要保留一个启用状态的管理员')
  }

  const name = String(body.name !== undefined ? body.name : target.name).trim()
  if (!name) return fail(400, '成员姓名不能为空')
  const nextRole = roleChanged ? body.role : target.role

  // 登录账号：只有管理员可以开通 / 重置密码
  const account = (db.users || []).find((u) => u.id === id)
  const wantsAccount = body.username !== undefined || body.password !== undefined
  if (wantsAccount && !canManageAccount(user)) {
    return fail(403, '只有管理员可以管理登录账号')
  }
  if (wantsAccount) {
    const inputUsername =
      body.username !== undefined
        ? String(body.username || '').trim()
        : account?.username || ''
    const inputPassword = body.password !== undefined ? String(body.password) : ''
    if (inputUsername) {
      if (db.users.some((u) => u.username === inputUsername && u.id !== id)) {
        return fail(400, '用户名已存在')
      }
      if (!account) {
        if (inputPassword.length < 4) return fail(400, '初始密码至少 4 位')
        db.users.push({
          id,
          username: inputUsername,
          password: inputPassword,
          name,
          role: nextRole
        })
      } else {
        account.username = inputUsername
        if (inputPassword) {
          if (inputPassword.length < 4) return fail(400, '密码至少 4 位')
          account.password = inputPassword
        }
      }
    } else if (inputPassword) {
      if (!account) return fail(400, '请先填写登录用户名')
      if (inputPassword.length < 4) return fail(400, '密码至少 4 位')
      account.password = inputPassword
    }
  }
  if (account) {
    account.name = name
    account.role = nextRole
  }

  // 停用 / 启用只有管理员可以操作
  if (body.active !== undefined && !canToggleMemberActive(user)) {
    return fail(403, '只有管理员可以停用或启用成员')
  }
  const nextActive =
    body.active !== undefined ? !!body.active : target.active !== false
  if (nextActive === false && target.active !== false) {
    if (target.id === user.id) return fail(400, '不能停用自己')
    if (
      target.role === ROLE.ADMIN &&
      db.members.filter((m) => m.role === ROLE.ADMIN && m.active !== false).length <= 1
    ) {
      return fail(400, '至少需要保留一个启用状态的管理员')
    }
    const pmProjects = db.projects.filter(
      (p) => p.PM === target.id && p.status !== 'archived'
    )
    if (pmProjects.length) {
      return fail(400, '该成员仍是进行中项目的负责人，请先移交负责人')
    }
    const pendingTasks = db.tasks.filter(
      (t) =>
        !t.deletedAt &&
        t.assignee === target.id &&
        !['accepted', 'canceled'].includes(t.status)
    )
    if (pendingTasks.length) {
      return fail(400, '该成员还有未完成任务，请先转派')
    }
  }

  db.members[index] = {
    ...target,
    name,
    role: nextRole,
    position: String(
      body.position !== undefined ? body.position : target.position || ''
    ).trim(),
    email: String(body.email !== undefined ? body.email : target.email || '').trim(),
    active: nextActive,
    id
  }
  save()
  return ok(withAccount(db.members[index]))
})

// 删除：只有管理员可以删除；不能删自己，也不能删最后一个管理员
Mock.mock(/\/api\/members\/\w+/, 'delete', (options) => {
  const user = getCurrentUser()
  if (!canDeleteMember(user)) {
    return fail(403, '只有管理员可以删除成员')
  }

  const id = options.url.split('?')[0].split('/').pop()
  const target = db.members.find((m) => m.id === id)
  if (!target) return fail(404, '成员不存在')
  if (target.id === user.id) return fail(400, '不能删除自己')
  // 与停用口径一致：只统计启用中的管理员。
  // 否则「先停用另一个 admin，再删掉当前唯一启用的 admin」会绕过这条保护。
  if (
    target.role === ROLE.ADMIN &&
    db.members.filter((m) => m.role === ROLE.ADMIN && m.active !== false).length <= 1
  ) {
    return fail(400, '至少需要保留一个启用状态的管理员')
  }

  // 与停用规则保持一致：仍负责进行中项目、或还有未完成任务时不允许删除，
  // 否则项目负责人会被置空、任务负责人会变成孤儿 id
  const pmProjects = db.projects.filter(
    (p) => p.PM === target.id && p.status !== 'archived'
  )
  if (pmProjects.length) {
    return fail(400, '该成员仍是进行中项目的负责人，请先移交负责人')
  }
  const pendingTasks = db.tasks.filter(
    (t) =>
      !t.deletedAt &&
      t.assignee === target.id &&
      !['accepted', 'canceled'].includes(t.status)
  )
  if (pendingTasks.length) {
    return fail(400, '该成员还有未完成任务，请先转派')
  }

  db.members = db.members.filter((m) => m.id !== id)
  db.users = (db.users || []).filter((u) => u.id !== id)
  // 只从项目成员里摘掉；已归档项目的 PM 保留历史引用（界面显示「已删除成员」）
  db.projects.forEach((p) => {
    p.members = (p.members || []).filter((mid) => mid !== id)
  })
  save()
  return ok(null)
})