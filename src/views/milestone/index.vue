<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Flag, WarningFilled } from '@element-plus/icons-vue'
import { useMilestoneStore } from '@/stores/milestoneStore'
import { useProjectStore } from '@/stores/projectStore'
import { useTaskStore } from '@/stores/taskStore'
import { useMemberStore } from '@/stores/memberStore'
import { useUserStore } from '@/stores/userStore'
import { canManageProject } from '@/utils/permissions'
import { todayLocal } from '@/utils/date'
import { diffDays } from '@/utils/due'
import { TASK_STATUS_LABEL } from '@/constants/status'

const milestoneStore = useMilestoneStore()
const projectStore = useProjectStore()
const taskStore = useTaskStore()
const memberStore = useMemberStore()
const userStore = useUserStore()
const router = useRouter()

const loading = ref(false)
const projectId = ref('')
const keyword = ref('')
const statusFilter = ref('all')
const selected = ref(null)
const childrenVisible = ref(false)

const ROW_H = 34
const STATUS_COLOR = {
  todo: '#909399', doing: '#409eff', done: '#e6a23c',
  accepted: '#67c23a', canceled: '#c0c4cc'
}

const projects = computed(() => projectStore.projectList || [])
const canManage = computed(() => canManageProject(userStore.userInfo, projectStore.getById(projectId.value)))

const all = computed(() => {
  const list = projectId.value
    ? milestoneStore.ofProject(projectId.value)
    : Object.values(milestoneStore.milestoneMap || {})
  return list.filter((m) => !m.deletedAt)
})

const lanes = computed(() => all.value
  .filter((m) => statusFilter.value === 'all' || m.status === statusFilter.value)
  .filter((m) => !keyword.value.trim() || (m.title + ' ' + (m.desc || '')).toLowerCase().includes(keyword.value.toLowerCase()))
  .sort((a, b) => (a.startDate || a.dueDate || '9999').localeCompare(b.startDate || b.dueDate || '9999')))

const dateAdd = (dateStr, days) => {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  const pad = (n) => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}
const diffDate = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000)

const today = computed(() => todayLocal())
const timeline = computed(() => {
  const list = lanes.value
  const dates = list.flatMap((m) => [m.startDate || m.dueDate, m.dueDate || m.startDate]).filter(Boolean).sort()
  if (!dates.length) return { days: [], start: '', todayIndex: -1 }
  let start = dates[0]
  let end = dates[dates.length - 1]
  if (diffDate(start, end) < 13) end = dateAdd(start, 13)
  if (diffDate(start, end) > 89) end = dateAdd(start, 89)
  if (today.value < start) start = today.value
  if (today.value > end) end = today.value
  const days = []
  for (let d = start; d <= end; d = dateAdd(d, 1)) {
    const wd = new Date(d + 'T00:00:00').getDay()
    days.push({ date: d, label: d.slice(5), weekday: ['日', '一', '二', '三', '四', '五', '六'][wd], isToday: d === today.value })
  }
  return { days, start, todayIndex: days.findIndex((x) => x.isToday) }
})

const dayIndex = (date) => date ? timeline.value.days.findIndex((d) => d.date === date) : -1
const barStyle = (m) => {
  const s = dayIndex(m.startDate || m.dueDate)
  const e = dayIndex(m.dueDate || m.startDate)
  if (s < 0 || e < 0) return { display: 'none' }
  const from = Math.min(s, e)
  const to = Math.max(s, e)
  return {
    top: (from * ROW_H + 5) + 'px',
    height: (Math.max(ROW_H - 8, (to - from + 1) * ROW_H - 8)) + 'px',
    background: STATUS_COLOR[m.status] || STATUS_COLOR.todo
  }
}
const statusColor = (m) => STATUS_COLOR[m.status] || STATUS_COLOR.todo
const taskCount = (m) => (taskStore.taskMap?.[m.projectId] || []).filter((t) => t.milestoneId === m.id && !t.deletedAt).length
const doneCount = (m) => (taskStore.taskMap?.[m.projectId] || []).filter((t) => t.milestoneId === m.id && !t.deletedAt && t.status === 'accepted').length
const projectName = (id) => projectStore.getById(id)?.name || id
const ownerName = (id) => memberStore.memberName(id)
const isOverdue = (m) => {
  const due = m.commitment?.dueDate || m.dueDate
  return !!due && diffDays(due, new Date()) < 0 && m.status !== 'canceled'
}
const draggingChildren = computed(() => {
  const m = selected.value
  if (!m) return []
  return (taskStore.taskMap?.[m.projectId] || []).filter((t) => t.milestoneId === m.id && !t.deletedAt)
    .map((t) => {
      const days = t.dueDate ? diffDays(t.dueDate, new Date()) : null
      return { ...t, days, dragging: t.status !== 'accepted' || (days !== null && days < 0) }
    })
    .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
})

const openDetail = async (m) => {
  selected.value = m
  childrenVisible.value = true
  await milestoneStore.openDetail(m.id)
}
const locateTask = (t) => {
  childrenVisible.value = false
  router.push({ path: '/task/board', query: { projectId: t.projectId, taskId: t.id } })
}
const closeDetail = () => { childrenVisible.value = false; selected.value = null }

const createMilestone = async () => {
  if (!projectId.value) { ElMessage.warning('请先选择项目'); return }
  try {
    const { value } = await ElMessageBox.prompt('输入里程碑标题', '新建里程碑', { inputPattern: /\S+/, inputErrorMessage: '标题不能为空' })
    const today = todayLocal()
    await milestoneStore.addMilestone({ projectId: projectId.value, title: value, startDate: today, dueDate: today })
    ElMessage.success('里程碑已创建')
  } catch (e) { if (e !== 'cancel' && e?.message) ElMessage.error(String(e.message)) }
}
const removeMilestone = async (m) => {
  try {
    await ElMessageBox.confirm('确定删除「' + m.title + '」吗？子任务会保留，仅解除关联。', '删除里程碑', { type: 'warning' })
    await milestoneStore.removeMilestone(m.id)
    if (selected.value?.id === m.id) closeDetail()
    ElMessage.success('已删除')
  } catch (e) { if (e !== 'cancel' && e?.message) ElMessage.error(String(e.message)) }
}

watch(projectId, () => { closeDetail() })

onMounted(async () => {
  loading.value = true
  await Promise.all([
    userStore.restoreUserInfo(),
    memberStore.initMembers(),
    projectStore.initProjects(),
    taskStore.initAll(),
    milestoneStore.milestoneList()
  ])
  loading.value = false
})
</script>

<template>
  <div class="ms-page" v-loading="loading">
    <div class="ms-head">
      <div>
        <h2>里程碑看板</h2>
        <p>每个里程碑一条横向泳道，纵向是时间；颜色代表状态。点色块查看里程碑与子任务。</p>
      </div>
      <el-button v-if="canManage" type="primary" @click="createMilestone">新建里程碑</el-button>
    </div>

    <div class="ms-toolbar">
      <el-select v-model="projectId" clearable placeholder="全部项目" style="width: 220px">
        <el-option v-for="p in projects" :key="p.id" :label="p.name" :value="p.id" />
      </el-select>
      <el-input v-model="keyword" clearable placeholder="搜索里程碑" style="width: 220px" />
      <el-radio-group v-model="statusFilter">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="todo">规划中</el-radio-button>
        <el-radio-button value="doing">进行中</el-radio-button>
        <el-radio-button value="done">待验收</el-radio-button>
        <el-radio-button value="accepted">已验收</el-radio-button>
      </el-radio-group>
      <span class="ms-count">共 {{ lanes.length }} 条泳道</span>
    </div>

    <div class="timeline-legend">
      <span v-for="(color, st) in STATUS_COLOR" :key="st" class="legend-item">
        <i :style="{ background: color }"></i>{{ TASK_STATUS_LABEL[st] || st }}
      </span>
      <span class="legend-item"><i class="today-swatch"></i>今天</span>
    </div>

    <div v-if="lanes.length && timeline.days.length" class="timeline-card">
      <div class="timeline-scroll">
        <div class="timeline-grid" :style="{ gridTemplateColumns: '220px repeat(' + lanes.length + ', 180px)' }">
          <div class="tl-corner" style="grid-column:1;grid-row:1">时间 / 里程碑</div>
          <div v-for="(m, mi) in lanes" :key="'h' + m.id" class="tl-head" :style="{ gridColumn: (mi + 2) + '', gridRow: '1' }" @click="openDetail(m)">
            <div class="tl-head-title"><el-icon><Flag /></el-icon>{{ m.title }}</div>
            <div class="tl-head-sub">{{ doneCount(m) }}/{{ taskCount(m) }} 子任务 · {{ ownerName(m.owner) }}</div>
          </div>

          <template v-for="(d, di) in timeline.days" :key="d.date">
            <div class="tl-date" :class="{ 'is-today': d.isToday }" :style="{ gridColumn: '1', gridRow: (di + 2) + '' }">
              <span>{{ d.label }}</span><small>周{{ d.weekday }}</small>
            </div>
            <div v-for="(m, mi) in lanes" :key="m.id + d.date" class="tl-cell" :class="{ 'is-today': d.isToday }" :style="{ gridColumn: (mi + 2) + '', gridRow: (di + 2) + '' }"></div>
          </template>

          <div v-for="(m, mi) in lanes" :key="'bar' + m.id" class="tl-bar-wrap" :style="{ gridColumn: (mi + 2) + '', gridRow: '2 / span ' + timeline.days.length }">
            <div class="tl-bar" :style="barStyle(m)" @click="openDetail(m)" :title="m.title">
              <span class="tl-bar-text">{{ m.title }}</span>
              <el-tag v-if="isOverdue(m)" type="danger" size="small" class="tl-overdue">逾期</el-tag>
            </div>
          </div>

          <div v-if="timeline.todayIndex >= 0" class="tl-today-line"
            :style="{ top: (34 + (timeline.todayIndex + 0.5) * ROW_H) + 'px' }"></div>
        </div>
      </div>
    </div>
    <el-empty v-else description="没有符合条件的里程碑" />

    <el-drawer v-model="childrenVisible" :title="selected?.title + ' · 详情'" size="480px">
      <template v-if="selected">
        <div class="ms-detail-meta">
          <p>{{ selected.desc }}</p>
          <p>状态：<span :style="{ color: statusColor(selected) }">{{ TASK_STATUS_LABEL[selected.status] || selected.status }}</span> · {{ doneCount(selected) }}/{{ taskCount(selected) }} 子任务已完成</p>
          <p>承诺截止：{{ (selected.commitment?.dueDate || selected.dueDate) || '—' }}</p>
          <p v-if="isOverdue(selected)" class="ms-warn"><el-icon><WarningFilled /></el-icon> 里程碑已逾期，下面标红的子任务拖慢了进度：</p>
        </div>
        <div class="child-title">子任务（点「看板定位」跳到对应卡片）</div>
        <div class="child-list">
          <div v-for="t in draggingChildren" :key="t.id" class="child-row" :class="{ 'is-dragging': t.dragging }">
            <div class="child-info">
              <div class="child-name">{{ t.title }}</div>
              <div class="child-meta">
                {{ TASK_STATUS_LABEL[t.status] || t.status }} · 截止 {{ t.dueDate || '—' }}
                <span v-if="t.days !== null && t.days < 0" class="child-overdue">逾期 {{ -t.days }} 天</span>
              </div>
            </div>
            <el-button link type="primary" size="small" @click="locateTask(t)">看板定位</el-button>
          </div>
        </div>
        <el-empty v-if="!draggingChildren.length" description="这个里程碑下还没有子任务" />
        <div v-if="canManage" class="drawer-foot">
          <el-button type="danger" plain size="small" @click="removeMilestone(selected)">删除里程碑</el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
.ms-page { padding: 18px; }
.ms-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;
  h2 { margin: 0 0 4px; font-size: 20px; }
  p { margin: 0; color: #909399; font-size: 13px; }
}
.ms-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
.ms-count { color: #909399; font-size: 12px; margin-left: auto; }
.timeline-legend { display: flex; gap: 14px; align-items: center; margin-bottom: 10px; font-size: 12px; color: #6b7280; }
.legend-item { display: inline-flex; align-items: center; gap: 5px;
  i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
  .today-swatch { background: transparent; border-left: 2px dashed #f56c6c; width: 2px; height: 12px; border-radius: 0; }
}
.timeline-card { background: #fff; border: 1px solid #e8eaef; border-radius: 12px; overflow: hidden; }
.timeline-scroll { overflow: auto; max-height: calc(100vh - 260px); }
.timeline-grid { display: grid; position: relative; min-height: 200px; }
.tl-corner, .tl-head { position: sticky; top: 0; z-index: 4; height: 34px; display: flex; align-items: center; background: #f7f8fa; border-bottom: 1px solid #e8eaef; border-right: 1px solid #eef0f4; font-size: 12px; }
.tl-corner { left: 0; z-index: 6; padding-left: 12px; color: #909399; }
.tl-head { flex-direction: column; align-items: flex-start; justify-content: center; padding: 0 10px; cursor: pointer; gap: 1px;
  &:hover { background: #eef3fb; }
}
.tl-head-title { display: flex; align-items: center; gap: 4px; font-weight: 600; color: #1f2430; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tl-head-sub { color: #9ca3af; font-size: 10px; }
.tl-date { position: sticky; left: 0; z-index: 3; height: 34px; display: flex; align-items: center; gap: 8px; padding: 0 12px; background: #fff; border-bottom: 1px solid #f2f3f5; font-size: 12px; color: #4b5563;
  small { color: #c0c4cc; }
  &.is-today { color: #f56c6c; font-weight: 700; background: #fff8f8; }
}
.tl-cell { height: 34px; border-bottom: 1px solid #f2f3f5; border-right: 1px solid #fafafa;
  &.is-today { background: #fffafa; }
}
.tl-bar-wrap { position: relative; pointer-events: none; z-index: 1; }
.tl-bar { position: absolute; left: 10px; right: 10px; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 6px; color: #fff; font-size: 11px; font-weight: 600; cursor: pointer; pointer-events: auto; box-shadow: 0 4px 10px -4px rgba(0,0,0,.35); transition: transform .15s, box-shadow .15s;
  &:hover { transform: translateY(-1px); box-shadow: 0 8px 16px -6px rgba(0,0,0,.45); }
}
.tl-bar-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tl-overdue { flex: none; }
.tl-today-line { position: absolute; left: 220px; right: 0; border-top: 2px dashed #f56c6c; z-index: 2; pointer-events: none; }
.ms-detail-meta { margin-bottom: 12px; font-size: 13px; p { margin: 4px 0; } }
.ms-warn { color: #f56c6c; display: flex; align-items: center; gap: 4px; }
.child-title { font-size: 12px; color: #909399; margin: 10px 0 6px; }
.child-list { display: flex; flex-direction: column; gap: 6px; }
.child-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border: 1px solid #e8eaef; border-radius: 8px; background: #fff;
  &.is-dragging { border-color: #fecdd3; background: #fff8f8; }
}
.child-name { font-size: 13px; font-weight: 500; }
.child-meta { font-size: 11px; color: #909399; margin-top: 2px; }
.child-overdue { color: #f56c6c; margin-left: 6px; }
.drawer-foot { margin-top: 16px; text-align: right; }
</style>
