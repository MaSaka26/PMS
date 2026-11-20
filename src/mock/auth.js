import { db } from './db.js'

const parseTokenUserId = () => {
  const token = localStorage.getItem('pm_token') || ''
  const match = token.match(/^token_(.+)_\d+$/)
  return match ? match[1] : ''
}

export const memberOf = (id) =>
  (db.members || []).find((member) => member.id === id) || null

export const findByCredentials = (username, password) =>
  (db.users || []).find(
    (user) => user.username === username && user.password === password
  ) || null

// 用户信息以 members 为准：姓名、角色、岗位、启用状态
export const toPublicUser = (user) => {
  const { password: _pw, ...safe } = user
  const member = memberOf(user.id)
  return {
    ...safe,
    name: member?.name ?? user.name,
    role: member?.role ?? user.role,
    position: member?.position ?? '',
    active: member ? member.active !== false : true,
  }
}

// 账号密码校验 + 停用检查；返回 { user } 或 { code, msg }
export const authenticate = (username, password) => {
  const user = findByCredentials(username, password)
  if (!user) return { code: 401, msg: '账号或密码错误' }
  const member = memberOf(user.id)
  if (member && member.active === false) {
    return { code: 403, msg: '账号已停用，请联系管理员' }
  }
  return { user: toPublicUser(user) }
}

// 当前登录用户；已停用或 token 无效时返回 null
export const getCurrentUser = () => {
  const id = parseTokenUserId()
  if (!id) return null
  const user = (db.users || []).find((item) => item.id === id)
  if (!user) return null
  const member = memberOf(id)
  if (member && member.active === false) return null
  return toPublicUser(user)
}
