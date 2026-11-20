import request from './request'

// 某项目下的全部任务
export const getTasksByProject = (projectId) =>
  request.get('/tasks', { params: { projectId } })

// 全部任务（可选，跨项目视图用）
export const getAllTasks = () => request.get('/tasks')

// 任务详情（含完整事件日志）
export const getTaskDetail = (id) => request.get(`/tasks/${id}`)

// 新增任务
export const createTask = (data) => request.post('/tasks', data)

// 编辑任务
export const updateTask = (id, data) => request.put(`/tasks/${id}`, data)

// 删除任务（软删除，数据保留可追溯）
export const deleteTask = (id) => request.delete(`/tasks/${id}`)

// 认领（只能认领 assignee 为空的任务；前置未完成时需 forceStart）
export const claimTask = (id, memberId, forceStart = false) =>
  request.post(`/tasks/${id}/claim`, { assignee: memberId, forceStart })

// 标记阻塞 / 解除阻塞（标记，不是状态）
export const blockTask = (id, reason) => request.post(`/tasks/${id}/block`, { reason })
export const unblockTask = (id) => request.post(`/tasks/${id}/unblock`)

// 取消 / 恢复（必须填原因）
export const cancelTask = (id, reason) => request.post(`/tasks/${id}/cancel`, { reason })
export const restoreTask = (id) => request.post(`/tasks/${id}/restore`)
