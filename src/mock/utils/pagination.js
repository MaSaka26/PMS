// 简易分页工具
export function paginate(list, page = 1, size = 10) {
    const start = (page - 1) * size
    return { list: list.slice(start, start + size), total: list.length }
}
