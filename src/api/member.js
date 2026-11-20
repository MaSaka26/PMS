import request from './request'

// 成员列表（支持 keyword）
export function getMemberList(params = {}) {
  return request.get('/members', { params })
}

// 新增成员
export function createMember(data) {
  return request.post('/members', data)
}

// 编辑成员
export function updateMember(id, data) {
  return request.put(`/members/${id}`, data)
}

// 删除成员
export function deleteMember(id) {
  return request.delete(`/members/${id}`)
}
