import test from 'node:test'
import assert from 'node:assert/strict'
import { diffDays, getDueLevel } from '../src/utils/due.js'

const today = new Date(2026, 10, 19) // 2026-11-19 本地时间

test('diffDays 按本地日期计算', () => {
    assert.equal(diffDays('2026-11-19', today), 0)
    assert.equal(diffDays('2026-11-20', today), 1)
    assert.equal(diffDays('2026-11-18', today), -1)
    assert.equal(diffDays('2026-11-22', today), 3)
})

test('紧急度分级', () => {
    assert.equal(getDueLevel('2026-11-19', 'doing', today).level, 'urgent')
    assert.equal(getDueLevel('2026-11-19', 'doing', today).text, '今天到期')
    assert.equal(getDueLevel('2026-11-21', 'todo', today).level, 'urgent')
    assert.equal(getDueLevel('2026-11-22', 'todo', today).level, 'soon')
    assert.equal(getDueLevel('2026-11-23', 'todo', today).level, 'soon')
    assert.equal(getDueLevel('2026-11-24', 'todo', today).level, 'safe')
    assert.equal(getDueLevel('2026-11-18', 'doing', today).level, 'overdue')
    assert.equal(getDueLevel('2026-11-18', 'doing', today).text, '已逾期 1 天')
})

test('终态或无截止日期不展示', () => {
    assert.equal(getDueLevel('', 'doing', today), null)
    assert.equal(getDueLevel('2026-11-19', 'accepted', today), null)
    assert.equal(getDueLevel('2026-11-19', 'canceled', today), null)
})
