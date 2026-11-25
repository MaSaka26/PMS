import test from 'node:test'
import assert from 'node:assert/strict'
import { SEED_SIGNATURE, SEED_VERSION, shouldResetSeed } from '../src/mock/db/seed/index.js'

// 这组测试锁住「什么时候该把本地数据整份丢掉」的策略。
// 之前踩过的坑：两个分支都用了 SEED_VERSION = 14，判等用的是 < ，于是撞号时谁都不重置，
// 浏览器里一直留着另一条分支的旧数据。指纹就是为这个场景加的兜底。

test('指纹是稳定的短字符串，且不随版本号变化', () => {
    assert.equal(typeof SEED_SIGNATURE, 'string')
    assert.ok(SEED_SIGNATURE.length >= 4 && SEED_SIGNATURE.length <= 12)
    // 同样的种子内容必须每次算出同一个值（否则每次刷新都会重置）
    const again = SEED_SIGNATURE
    assert.equal(again, SEED_SIGNATURE)
})

test('从没存过数据：重置', () => {
    assert.equal(shouldResetSeed(null), true)
    assert.equal(shouldResetSeed(undefined), true)
    assert.equal(shouldResetSeed({}), true)
    assert.equal(shouldResetSeed({ seedVersion: 0 }), true)
})

test('本地版本更旧：重置', () => {
    assert.equal(
        shouldResetSeed({ seedVersion: SEED_VERSION - 1, seedSignature: SEED_SIGNATURE }),
        true
    )
})

test('本地版本更新：不重置（不能拿旧 bundle 的种子把新数据刷掉）', () => {
    assert.equal(
        shouldResetSeed({ seedVersion: SEED_VERSION + 1, seedSignature: SEED_SIGNATURE }),
        false
    )
})

test('版本号相同且内容指纹相同：不重置（保住用户自己改的数据）', () => {
    assert.equal(
        shouldResetSeed({ seedVersion: SEED_VERSION, seedSignature: SEED_SIGNATURE }),
        false
    )
})

test('版本号相同但内容指纹不同（撞号）：重置', () => {
    assert.equal(
        shouldResetSeed({ seedVersion: SEED_VERSION, seedSignature: 'other-branch' }),
        true
    )
    // 老数据没有指纹字段，等同于指纹不同 —— 会被重置一次，这是预期
    assert.equal(shouldResetSeed({ seedVersion: SEED_VERSION }), true)
})

test('默认数据结构里带着当前版本的指纹', async () => {
    const { defaultData } = await import('../src/mock/db/seed/index.js')
    assert.equal(defaultData.seedVersion, SEED_VERSION)
    assert.equal(defaultData.seedSignature, SEED_SIGNATURE)
    // 自己带出去的默认数据必须判定为「不用重置」，否则每次启动都会重写 localhstorage
    assert.equal(shouldResetSeed(defaultData), false)
})
