// 全项目统一的日期口径：本地日期（YYYY-MM-DD），避免 UTC 截断在东八区 00:00–08:00 多算一天逾期。
// 时间戳事件仍用 ISO UTC；这里只处理「哪一天」的语义。

// 本地日期（YYYY-MM-DD），和表单、逾期徽标保持一致
export const todayLocal = (date = new Date()) => {
    const p = (n) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

// ISO 时间戳：事件必须带时分秒，否则时间线里分不清先后
export const nowISO = () => new Date().toISOString()
