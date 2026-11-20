import Mock from 'mockjs'
import { db, save, uid } from './db'

// 第一版只服务任务字段；类型保持最小可用集合
const TYPES = ['text', 'textarea', 'number', 'date', 'select']

const ok = (data) => ({ code: 200, data, msg: 'success' })
const fail = (msg) => ({ code: 400, data: null, msg })

import { getCurrentUser } from './auth'

const requireAdmin = () => {
  const user = getCurrentUser()
  if (!user || user.role !== 'admin') {
    return { code: 403, data: null, msg: '只有管理员可以修改字段配置' }
  }
  return null
}

const fieldsOf = () => (Array.isArray(db.fields) ? db.fields : (db.fields = []))

const normalizeOptions = (options) =>
  Array.isArray(options)
    ? [...new Set(options.map((x) => String(x).trim()).filter(Boolean))]
    : []

const sortedFields = () => [...fieldsOf()].sort((a, b) => a.order - b.order)

const validate = (body, excludeId) => {
  const label = String(body.label || '').trim()
  if (!label) return '字段名称不能为空'
  if (body.type && !TYPES.includes(body.type)) return '字段类型不合法'
  if (body.type === 'select' && !normalizeOptions(body.options).length) {
    return '单选字段至少需要一个选项'
  }
  // 任务字段和项目字段是两个命名空间，允许同名；同一对象内不允许重名
  const targetType = body.targetType === 'project' ? 'project' : 'task'
  const duplicated = fieldsOf().some(
    (f) => f.id !== excludeId && f.targetType === targetType && f.label === label
  )
  if (duplicated) return '已存在同名字段'
  return ''
}

// ——— 列表：支持 targetType / enabled 过滤 ———
Mock.mock(/\/api\/fields(\?.*)?$/, 'get', (options) => {
  const url = new URL(options.url, 'http://localhost')
  const targetType = url.searchParams.get('targetType')
  const enabled = url.searchParams.get('enabled')
  let list = sortedFields()
  if (targetType) list = list.filter((f) => f.targetType === targetType)
  if (enabled === '1') list = list.filter((f) => f.enabled)
  // 过滤后再按 order 排一次：两种对象的 order 各自从 0 开始
  list = [...list].sort((a, b) => a.order - b.order)
  return ok(list)
})

// ——— 排序：整体重排（必须注册在通用 PUT 之前，否则会被 /fields/:id 抢先匹配） ———
Mock.mock('/api/fields/reorder', 'put', (options) => {
  const denied = requireAdmin()
  if (denied) return denied
  const body = JSON.parse(options.body)
  const ids = Array.isArray(body.ids) ? body.ids : []
  ids.forEach((id, index) => {
    const field = fieldsOf().find((f) => f.id === id)
    if (field) field.order = index
  })
  save()
  return ok(sortedFields())
})

// ——— 新增 ———
Mock.mock('/api/fields', 'post', (options) => {
  const denied = requireAdmin()
  if (denied) return denied
  const body = JSON.parse(options.body)
  const type = body.type || 'text'
  const error = validate({ ...body, type })
  if (error) return fail(error)

  const targetType = body.targetType === 'project' ? 'project' : 'task'
  // 排序只在同一作用对象内累加
  const maxOrder = fieldsOf()
    .filter((f) => f.targetType === targetType)
    .reduce((max, f) => Math.max(max, f.order ?? 0), -1)
  const field = {
    id: uid('field'),
    label: String(body.label).trim(),
    type,
    targetType,
    required: !!body.required,
    options: type === 'select' ? normalizeOptions(body.options) : [],
    description: String(body.description || '').trim(),
    enabled: body.enabled !== false,
    order: maxOrder + 1
  }
  fieldsOf().push(field)
  save()
  return ok(field)
})

// ——— 编辑 ———
Mock.mock(/\/api\/fields\/[\w-]+$/, 'put', (options) => {
  const denied = requireAdmin()
  if (denied) return denied
  const id = options.url.split('/').pop()
  const idx = fieldsOf().findIndex((f) => f.id === id)
  if (idx === -1) return fail('字段不存在')

  const body = JSON.parse(options.body)
  const old = fieldsOf()[idx]
  const next = { ...old, ...body }
  next.type = TYPES.includes(next.type) ? next.type : old.type
  next.label = String(next.label || '').trim()
  next.required = !!next.required
  next.enabled = next.enabled !== false
  next.description = String(next.description || '').trim()
  next.options = next.type === 'select' ? normalizeOptions(next.options) : []
  next.targetType = old.targetType

  const error = validate(next, id)
  if (error) return fail(error)

  fieldsOf()[idx] = next
  save()
  return ok(next)
})

// ——— 删除：只删定义，任务里已填的值保留但不再展示 ———
Mock.mock(/\/api\/fields\/[\w-]+$/, 'delete', (options) => {
  const denied = requireAdmin()
  if (denied) return denied
  const id = options.url.split('/').pop()
  const exists = fieldsOf().some((f) => f.id === id)
  if (!exists) return fail('字段不存在')
  db.fields = fieldsOf().filter((f) => f.id !== id)
  // 删除后重排，避免出现空洞
  sortedFields().forEach((f, index) => {
    f.order = index
  })
  save()
  return ok(null)
})
