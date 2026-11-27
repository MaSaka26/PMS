import request from './request'

export function getMilestones(params = {}) {
  return request.get('/milestones', { params })
}
export function getMilestone(id) {
  return request.get(`/milestones/${id}`)
}
export function createMilestone(data) {
  return request.post('/milestones', data)
}
export function updateMilestone(id, data) {
  return request.put(`/milestones/${id}`, data)
}
export function deleteMilestone(id) {
  return request.delete(`/milestones/${id}`)
}
