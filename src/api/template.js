import request from './request'

export const getTemplateList = () => request.get('/templates')

export const createTemplate = (data) => request.post('/templates', data)

export const updateTemplate = (id, data) => request.put(`/templates/${id}`, data)

export const deleteTemplate = (id) => request.delete(`/templates/${id}`)

// 套用模板：生成项目 + 任务
export const applyTemplate = (id, data) => request.post(`/templates/${id}/apply`, data)
