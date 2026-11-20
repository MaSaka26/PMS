import request from './request'

// 项目列表（keyword / page / size / scope: active | archived | all）
export function getProjectList(params) {
  return request.get('/projects', { params })
}

// 新增项目
export function createProject(data) {
  return request.post('/projects', data)
}

// 编辑项目
export function updateProject(id, data) {
  return request.put(`/projects/${id}`, data)
}

// 删除项目（软删除）
export function deleteProject(id) {
  return request.delete(`/projects/${id}`)
}

// 关闭项目 → 自动进入项目归档视图
export function closeProject(id, reason) {
  return request.post(`/projects/${id}/close`, { reason })
}

// 撤销归档 → 项目恢复为执行中
export function reopenProject(id) {
  return request.post(`/projects/${id}/reopen`)
}

// 项目详情
export function getProjectDetail(id) {
  return request.get(`/projects/${id}`)
}

// 项目动态（聚合事件）
export function getProjectActivities(id, params) {
  return request.get(`/projects/${id}/activities`, { params })
}
