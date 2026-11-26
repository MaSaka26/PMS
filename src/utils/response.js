// mock 接口统一响应包
export const ok = (data) => ({ code: 200, data, msg: 'success' })
export const fail = (code, msg) => ({ code, data: null, msg })
