import request from './request'

// 字段配置列表（可按 targetType / enabled 过滤）
export const getFieldList = (params) => request.get('/fields', { params })

export const createField = (data) => request.post('/fields', data)

export const updateField = (id, data) => request.put(`/fields/${id}`, data)

export const deleteField = (id) => request.delete(`/fields/${id}`)

// 整体重排：按传入的 id 顺序写入 order
export const reorderFields = (ids) => request.put('/fields/reorder', { ids })
