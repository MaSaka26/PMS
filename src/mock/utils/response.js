export const ok = (data) => ({ code: 200, data, msg: 'success' })

export const fail = (code, msg) => ({ code, data: null, msg })
