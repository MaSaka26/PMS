<script setup>
import { computed } from 'vue'
import { Flag, WarningFilled } from '@element-plus/icons-vue'
import { TASK_STATUS_LABEL } from '@/constants/status'
import { deriveMilestoneStatus, milestoneDelayDetails } from '@/domain/milestone'

const props = defineProps({
  milestones: { type: Array, default: () => [] },
  tasks: { type: Array, default: () => [] },
  memberName: { type: Function, required: true },
  today: { type: String, default: '' }
})
const emit = defineEmits(['open-board'])

const STATUS_COLOR = {
  todo: '#909399', doing: '#409eff', done: '#e6a23c',
  accepted: '#67c23a', canceled: '#c0c4cc'
}

const rows = computed(() => props.milestones.map((m) => {
  const children = props.tasks.filter((t) => t.milestoneId === m.id && !t.deletedAt)
  const status = deriveMilestoneStatus(m, props.tasks)
  const done = children.filter((t) => t.status === 'accepted').length
  const committed = m.commitment?.dueDate || m.dueDate
  const hadDelay = milestoneDelayDetails(m, props.tasks, props.today ? new Date(props.today + 'T00:00:00') : new Date()).length > 0
  const actual = m.dueDate || committed
  const overdue = !!committed && (status === 'accepted' ? actual > committed : hadDelay)
  return { ...m, derivedStatus: status, total: children.length, done, committed, overdue }
}))

const statusText = (s) => TASK_STATUS_LABEL[s] || s
const statusColor = (s) => STATUS_COLOR[s] || STATUS_COLOR.todo
</script>

<template>
  <div class="milestone-list">
    <div class="ms-toolbar">
      <div>
        <div class="ms-title">项目里程碑</div>
        <div class="ms-hint">按交付物看阶段刻度；状态由下面的子任务汇总，点「里程碑看板」查看时间线。</div>
      </div>
      <el-button type="primary" plain :icon="Flag" @click="emit('open-board')">打开里程碑看板</el-button>
    </div>
    <div v-if="rows.length" class="ms-grid">
      <div v-for="m in rows" :key="m.id" class="ms-card" :class="{ 'is-overdue': m.overdue }">
        <div class="ms-card-head">
          <span class="ms-code">{{ m.code || 'M' }}</span>
          <span class="ms-name">{{ m.title }}</span>
          <span class="ms-status" :style="{ color: statusColor(m.derivedStatus), background: statusColor(m.derivedStatus) + '1f' }">
            {{ statusText(m.derivedStatus) }}
          </span>
        </div>
        <div v-if="m.desc" class="ms-desc">{{ m.desc }}</div>
        <div class="ms-meta">
          <span>负责人：{{ memberName(m.owner) || '—' }}</span>
          <span>计划：{{ m.startDate || '—' }} · 工期 {{ m.duration || 1 }} 天</span>
          <span>承诺截止：{{ m.committed || '—' }}</span>
          <span v-if="m.overdue" class="ms-overdue"><el-icon><WarningFilled /></el-icon> 逾期</span>
        </div>
        <div class="ms-progress">
          <el-progress :percentage="m.total ? Math.round((m.done / m.total) * 100) : 0" :stroke-width="5" />
          <span class="ms-count">{{ m.done }}/{{ m.total }} 子任务已验收</span>
        </div>
      </div>
    </div>
    <el-empty v-else description="这个项目还没有里程碑" />
  </div>
</template>

<style scoped lang="scss">
.milestone-list { padding: 4px 0; }
.ms-toolbar { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
.ms-title { font-size: 14px; font-weight: 600; color: #1f2430; }
.ms-hint { margin-top: 4px; font-size: 12px; color: #9ca3af; }
.ms-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.ms-card { padding: 14px 16px; background: #fff; border: 1px solid #e8eaef; border-radius: 12px;
  &.is-overdue { border-color: #fecdd3; background: #fff8f9; }
}
.ms-card-head { display: flex; align-items: center; gap: 8px; }
.ms-code { padding: 2px 8px; font-size: 11px; font-weight: 700; color: #6366f1; background: #eef2ff; border-radius: 6px; }
.ms-name { flex: 1; font-size: 14px; font-weight: 600; color: #1f2430; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ms-status { padding: 2px 8px; font-size: 11px; border-radius: 999px; }
.ms-desc { margin-top: 8px; font-size: 12px; line-height: 1.6; color: #6b7280; white-space: pre-line; }
.ms-meta { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 8px; font-size: 11px; color: #9ca3af; }
.ms-overdue { display: inline-flex; align-items: center; gap: 3px; color: #f43f5e; }
.ms-progress { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
.ms-progress :deep(.el-progress) { flex: 1; }
.ms-count { flex: none; font-size: 11px; color: #9ca3af; }
@media (max-width: 900px) { .ms-grid { grid-template-columns: 1fr; } }
</style>
