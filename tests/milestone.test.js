import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deriveMilestoneStatus, milestoneDelayDetails, deriveProjectStage } from '../src/domain/milestone.js'

const ms = (id, status = 'accepted', due = '2026-11-20') => ({ id, status, commitment: { dueDate: due } })
const child = (id, mid, status, due = '2026-11-18') => ({ id, milestoneId: mid, status, dueDate: due })

test('里程碑状态由子任务汇总', () => {
  assert.equal(deriveMilestoneStatus(ms('m1'), [child('c1','m1','accepted'), child('c2','m1','accepted')]), 'accepted')
  assert.equal(deriveMilestoneStatus(ms('m1'), [child('c1','m1','accepted'), child('c2','m1','done')]), 'done')
  assert.equal(deriveMilestoneStatus(ms('m1'), [child('c1','m1','doing')]), 'doing')
  assert.equal(deriveMilestoneStatus(ms('m1'), [child('c1','m1','todo')]), 'todo')
  assert.equal(deriveMilestoneStatus(ms('m1','accepted'), []), 'accepted')
})

test('项目阶段按里程碑汇总，逾期完成不改阶段', () => {
  const tasks = [child('c1','m1','accepted','2026-11-25')]
  const ms1 = ms('m1','accepted','2026-11-20')
  assert.equal(deriveProjectStage(tasks, [ms1]), 'iterating')
})

test('里程碑逾期下钻列出拖慢子任务，已验收但迟交也算', () => {
  const m = ms('m1', 'accepted', '2026-11-20')
  const tasks = [
    child('c1','m1','doing','2026-11-24'),
    child('c2','m1','done','2026-11-23'),
    child('c3','m1','accepted','2026-11-22'),
    child('c4','m1','todo','2026-12-01'),
    child('c5','m1','accepted','2026-12-20')
  ]
  const late = milestoneDelayDetails(m, tasks, new Date(2026,10,26))
  assert.deepEqual(late.map(x=>x.id), ['c3','c2','c1','c4'])
  assert.equal(milestoneDelayDetails(ms('m2','accepted','2026-12-01'), tasks, new Date(2026,10,26)).length, 0)
})
