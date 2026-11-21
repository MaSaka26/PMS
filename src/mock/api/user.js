import Mock from 'mockjs'
import { authenticate, getCurrentUser } from '../services/auth.js'
import { ok } from '../utils/response.js'

// 登录：账号密码来自 users，身份与状态来自 members
Mock.mock('/api/login', 'post', (options) => {
  const body = JSON.parse(options.body)
  const result = authenticate(body.username, body.password)
  if (!result.user) {
    return { code: result.code, data: null, msg: result.msg }
  }
  // 用 id 当 token（mock 不需要 JWT）
  const token = `token_${result.user.id}_${Date.now()}`
  return ok({ token, user: result.user })
})

// 获取当前用户信息（已停用 / token 失效返回 401）
Mock.mock('/api/info', 'get', () => {
  const user = getCurrentUser()
  if (!user) {
    return { code: 401, data: null, msg: '账号已停用或登录已失效' }
  }
  return ok(user)
})
