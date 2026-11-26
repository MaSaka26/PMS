// 幂等加载器：同一时刻同一任务只允许一个请求在飞，结束后自动释放锁。
// 三个 store 之前各写了一遍 initPromise / initPromises / isInitialized，
// 语义不同却都叫「防重复拉」，收敛到这里避免以后各改各的。

/**
 * 单个任务幂等：并发调用共享同一个 promise，完成后释放，
 * 后续可以再次调用（用于显式刷新）。
 */
export function createIdempotentLoader(loader) {
    let pending = null
    const run = (...args) => {
        if (pending) return pending
        let result
        try {
            result = loader(...args)
        } catch (error) {
            return Promise.reject(error)
        }
        pending = Promise.resolve(result).finally(() => { pending = null })
        return pending
    }
    run.isPending = () => !!pending
    return run
}

/**
 * 按 key 隔离的幂等：projectStore 按 scope（active / archived / all）
 * 分别缓存，避免「看归档时拿不到活动项目」这类互相覆盖。
 */
export function createKeyedIdempotentLoader(loader) {
    const pending = new Map()
    const run = (key, ...args) => {
        if (pending.has(key)) return pending.get(key)
        let result
        try {
            result = loader(key, ...args)
        } catch (error) {
            return Promise.reject(error)
        }
        const promise = Promise.resolve(result).finally(() => { pending.delete(key) })
        pending.set(key, promise)
        return promise
    }
    run.isPending = (key) => pending.has(key)
    return run
}
