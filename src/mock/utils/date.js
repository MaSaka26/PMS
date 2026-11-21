// 统一时间戳：事件必须带时分秒，否则时间线里分不清先后
export const nowISO = () => new Date().toISOString()

// 本地日期（YYYY-MM-DD），和前端表单保持一致，避免时区偏移
export const todayLocal = () => {
    const d = new Date()
    const p = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
