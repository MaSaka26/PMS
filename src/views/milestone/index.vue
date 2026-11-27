<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Flag, Sort, WarningFilled } from '@element-plus/icons-vue'
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
const axis = ref('time-x') // time-x: 横轴时间；ms-x: 横轴里程碑
const swapped = computed(() => axis.value === 'ms-x')

// 横轴是时间（列），纵轴是里程碑（行）
const COL_W = 96
const ROW_H = 40
const HEAD_H = 34
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

// 坐标轴固定用全量数据：筛选只控制内容显示，不改变行数/列数/日期范围
const lanes = computed(() => [...all.value]
  .sort((a, b) => (a.startDate || a.dueDate || '9999').localeCompare(b.startDate || b.dueDate || '9999')))
const isMatched = (m) => (statusFilter.value === 'all' || m.status === statusFilter.value)
  && (!keyword.value.trim() || (m.title + ' ' + (m.desc || '')).toLowerCase().includes(keyword.value.toLowerCase()))
const matchedCount = computed(() => lanes.value.filter(isMatched).length)

const dateAdd = (dateStr, days) => {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  const pad = (n) => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}
const diffDate = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000)
const planEnd = (m) => dateAdd(m.startDate || m.dueDate, Math.max(1, Number(m.duration) || 1) - 1)

const today = computed(() => todayLocal())
const timeline = computed(() => {
  const list = all.value
  const dates = []
  for (const m of list) {
    if (m.startDate) dates.push(m.startDate)
    if (m.dueDate) dates.push(m.dueDate)
    if (m.startDate) dates.push(planEnd(m))
    if (m.commitment?.dueDate) dates.push(m.commitment.dueDate)
  }
  dates.sort()
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
  const from = dayIndex(m.startDate || m.dueDate)
  if (from < 0) return { display: 'none' }
  let to = from + Math.max(1, Number(m.duration) || 1) - 1
  const actual = dayIndex(m.dueDate)
  if (actual > to) to = actual
  if (to >= timeline.value.days.length) to = timeline.value.days.length - 1
  return {
    left: (from * COL_W + 8) + 'px',
    width: ((to - from + 1) * COL_W - 16) + 'px',
    background: STATUS_COLOR[m.status] || STATUS_COLOR.todo
  }
}
const deadlineLeft = (m) => {
  const i = dayIndex(m.commitment?.dueDate || m.dueDate)
  return i < 0 ? '-9999px' : ((i + 0.5) * COL_W) + 'px'
}
// 横轴里程碑时的竖向色块与承诺横线
const spanOf = (m) => {
  const from = dayIndex(m.startDate || m.dueDate)
  if (from < 0) return null
  let to = from + Math.max(1, Number(m.duration) || 1) - 1
  const actual = dayIndex(m.dueDate)
  if (actual > to) to = actual
  if (to >= timeline.value.days.length) to = timeline.value.days.length - 1
  return { from, to }
}
const barStyleV = (m) => {
  const s = spanOf(m)
  if (!s) return { display: 'none' }
  return {
    top: (s.from * ROW_H + 5) + 'px',
    height: ((s.to - s.from + 1) * ROW_H - 10) + 'px',
    background: STATUS_COLOR[m.status] || STATUS_COLOR.todo
  }
}
const deadlineTop = (m) => {
  const i = dayIndex(m.commitment?.dueDate || m.dueDate)
  return i < 0 ? '-9999px' : ((i + 0.5) * ROW_H) + 'px'
}
const statusColor = (m) => STATUS_COLOR[m.status] || STATUS_COLOR.todo
const taskCount = (m) => (taskStore.taskMap?.[m.projectId] || []).filter((t) => t.milestoneId === m.id && !t.deletedAt).length
const doneCount = (m) => (taskStore.taskMap?.[m.projectId] || []).filter((t) => t.milestoneId === m.id && !t.deletedAt && t.status === 'accepted').length
const projectName = (id) => projectStore.getById(id)?.name || id
const ownerName = (id) => memberStore.memberName(id)
const isOverdue = (m) => {
  if (!m || m.status === 'canceled') return false
  const committed = m.commitment?.dueDate || m.dueDate
  if (!committed) return false
  // 已验收：只有「实际结束晚于承诺截止」才算逾期；历史里程碑按提交日交付，不该因为今天更晚就标红
  if (m.status === 'accepted') {
    const actual = m.dueDate || committed
    return actual > committed
  }
  return diffDays(committed, new Date()) < 0
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
    const start = todayLocal()
    await milestoneStore.addMilestone({ projectId: projectId.value, title: value, startDate: start, duration: 3 })
    ElMessage.success('里程碑已创建，默认计划工期 3 天')
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
        <p v-if="!swapped">横轴是时间，纵轴是每个里程碑一条泳道；色块长度是计划工期，颜色是状态，白色竖线是承诺截止。点色块看子任务。</p>
        <p v-else>横轴是每个里程碑，纵轴是时间；色块高度是计划工期，颜色是状态，横线是承诺截止。点色块看子任务。</p>
      </div>
      <div class="ms-head-actions">
        <el-button @click="axis = swapped ? 'time-x' : 'ms-x'"><el-icon><Sort /></el-icon>{{ swapped ? '横轴改为时间' : '横轴改为里程碑' }}</el-button>
        <el-button v-if="canManage" type="primary" @click="createMilestone">新建里程碑</el-button>
      </div>
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
      <span class="ms-count">显示 {{ matchedCount }} / {{ lanes.length }} 条里程碑（筛选只隐藏内容，不改变坐标轴）</span>
    </div>

    <div class="timeline-legend">
      <span v-for="(color, st) in STATUS_COLOR" :key="st" class="legend-item">
        <i :style="{ background: color }"></i>{{ TASK_STATUS_LABEL[st] || st }}
      </span>
      <span class="legend-item"><i class="deadline-swatch"></i>承诺截止</span>
      <span class="legend-item"><i class="today-swatch"></i>今天</span>
    </div>

    <div v-if="all.length && timeline.days.length" class="timeline-card">
      <div v-if="!swapped" class="timeline-scroll">
        <div class="timeline-grid" :style="{ gridTemplateColumns: '220px repeat(' + timeline.days.length + ', ' + COL_W + 'px)' }">
          <div class="tl-corner" style="grid-column:1;grid-row:1">里程碑 / 时间</div>

          <div v-for="(d, di) in timeline.days" :key="d.date" class="tl-date" :class="{ 'is-today': d.isToday }"
            :style="{ gridColumn: (di + 2) + '', gridRow: '1' }">
            <span>{{ d.label }}</span><small>周{{ d.weekday }}</small>
          </div>

          <template v-for="(m, mi) in lanes" :key="m.id">
            <div class="tl-name" :class="{ 'is-filtered': !isMatched(m) }" :style="{ gridColumn: '1', gridRow: (mi + 2) + '' }" @click="openDetail(m)">
              <div class="tl-name-title"><el-icon><Flag /></el-icon>{{ m.title }}</div>
              <div class="tl-name-sub">{{ doneCount(m) }}/{{ taskCount(m) }} 子任务 · {{ ownerName(m.owner) }} · 工期 {{ m.duration || 1 }} 天</div>
            </div>
            <div v-for="d in timeline.days" :key="m.id + d.date" class="tl-cell" :class="{ 'is-today': d.isToday, 'is-filtered': !isMatched(m) }" :style="{ gridColumn: timeline.days.indexOf(d) + 2 + '', gridRow: (mi + 2) + '' }"></div>
            <div class="tl-bar-wrap" :class="{ 'is-filtered': !isMatched(m) }" :style="{ gridColumn: '2 / span ' + timeline.days.length, gridRow: (mi + 2) + '' }">
              <div class="tl-bar" :style="barStyle(m)" @click="openDetail(m)" :title="m.title + '（计划工期 ' + (m.duration || 1) + ' 天）'">
                <span class="tl-bar-text">{{ m.title }}</span>
                <el-tag v-if="isOverdue(m)" type="danger" size="small" class="tl-overdue">逾期</el-tag>
              </div>
              <div class="tl-deadline" :style="{ left: deadlineLeft(m) }" :title="'承诺截止：' + (m.commitment?.dueDate || m.dueDate || '—')"></div>
            </div>
          </template>

          <div v-if="timeline.todayIndex >= 0" class="tl-today-line"
            :style="{ gridColumn: (timeline.todayIndex + 2) + '', gridRow: '2 / span ' + lanes.length }"></div>
        </div>
      </div>
      <div v-else class="timeline-scroll">
        <div class="timeline-grid" :style="{ gridTemplateColumns: '96px repeat(' + lanes.length + ', 220px)' }">
          <div class="tl-corner" style="grid-column:1;grid-row:1">时间 / 里程碑</div>
          <div v-for="(m, mi) in lanes" :key="'h' + m.id" class="tl-colhead" :class="{ 'is-filtered': !isMatched(m) }" :style="{ gridColumn: (mi + 2) + '', gridRow: '1' }" @click="openDetail(m)">
            <div class="tl-colhead-title"><el-icon><Flag /></el-icon>{{ m.code || m.title }}</div>
            <div class="tl-colhead-sub">{{ m.title }}</div>
          </div>
          <template v-for="(d, di) in timeline.days" :key="d.date">
            <div class="tl-rowhead" :class="{ 'is-today': d.isToday }" :style="{ gridColumn: '1', gridRow: (di + 2) + '' }">{{ d.label }}<small>周{{ d.weekday }}</small></div>
            <div v-for="m in lanes" :key="m.id + d.date" class="tl-cell" :class="{ 'is-today': d.isToday, 'is-filtered': !isMatched(m) }" :style="{ gridColumn: lanes.indexOf(m) + 2 + '', gridRow: (di + 2) + '' }"></div>
          </template>
          <template v-for="(m, mi) in lanes" :key="'b' + m.id">
            <div class="tl-bar-wrap-v" :class="{ 'is-filtered': !isMatched(m) }" :style="{ gridColumn: (mi + 2) + '', gridRow: '2 / span ' + timeline.days.length }">
              <div class="tl-bar-v" :style="barStyleV(m)" @click="openDetail(m)" :title="m.title + '（计划工期 ' + (m.duration || 1) + ' 天）'">
                <span class="tl-bar-v-text">{{ m.title }}</span>
                <el-tag v-if="isOverdue(m)" type="danger" size="small" class="tl-overdue">逾期</el-tag>
              </div>
              <div class="tl-deadline-v" :style="{ top: deadlineTop(m) }" :title="'承诺截止：' + (m.commitment?.dueDate || m.dueDate || '—')"></div>
            </div>
          </template>
          <div v-if="timeline.todayIndex >= 0" class="tl-today-line-v" :style="{ gridColumn: '2 / span ' + lanes.length, gridRow: (timeline.todayIndex + 2) + '' }"></div>
        </div>
      </div>
    </div>
    <el-empty v-else description="没有符合条件的里程碑" />

    <el-drawer v-model="childrenVisible" :title="selected?.title + ' · 详情'" size="480px">
      <template v-if="selected">
        <div class="ms-detail-meta">
          <p>{{ selected.desc }}</p>
          <p>状态：<span :style="{ color: statusColor(selected) }">{{ TASK_STATUS_LABEL[selected.status] || selected.status }}</span> · {{ doneCount(selected) }}/{{ taskCount(selected) }} 子任务已完成</p>
          <p>计划：{{ selected.startDate || '—' }} 起，工期 {{ selected.duration || 1 }} 天，计划结束 {{ planEnd(selected) }}</p>
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
  .deadline-swatch { background: #fff; border-left: 2px solid #303133; width: 2px; height: 12px; border-radius: 0; }
  .today-swatch { background: transparent; border-left: 2px dashed #f56c6c; width: 2px; height: 12px; border-radius: 0; }
}
.timeline-card { background: #fff; border: 1px solid #e8eaef; border-radius: 12px; overflow: hidden; }
.timeline-scroll { overflow: auto; max-height: calc(100vh - 260px); }
.timeline-grid { display: grid; position: relative; min-height: 200px; width: max-content; }
.tl-corner, .tl-date { position: sticky; top: 0; z-index: 5; height: 34px; display: flex; align-items: center; justify-content: center; background: #f7f8fa; border-bottom: 1px solid #e8eaef; border-right: 1px solid #eef0f4; font-size: 12px; }
.tl-corner { left: 0; z-index: 8; justify-content: flex-start; padding-left: 12px; color: #909399; }
.tl-date { gap: 3px; color: #4b5563;
  small { color: #c0c4cc; font-size: 10px; }
  &.is-today { color: #f56c6c; font-weight: 700; background: #fff8f8; }
}
.tl-name { position: sticky; left: 0; z-index: 4; height: 40px; padding: 0 10px; display: flex; flex-direction: column; justify-content: center; gap: 2px; background: #fff; border-bottom: 1px solid #f2f3f5; border-right: 1px solid #e8eaef; cursor: pointer;
  &:hover { background: #f5f9ff; }
}
.tl-name-title { display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: #1f2430; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tl-name-sub { font-size: 10px; color: #9ca3af; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tl-cell { height: 40px; border-bottom: 1px solid #f2f3f5; border-right: 1px solid #fafafa;
  &.is-today { background: #fffafa; }
}
.tl-bar-wrap { position: relative; pointer-events: none; z-index: 2; }
.tl-bar { position: absolute; top: 7px; height: 26px; border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 6px; color: #fff; font-size: 11px; font-weight: 600; cursor: pointer; pointer-events: auto; box-shadow: 0 4px 10px -4px rgba(0,0,0,.35); transition: transform .15s, box-shadow .15s;
  &:hover { transform: translateY(-1px); box-shadow: 0 8px 16px -6px rgba(0,0,0,.45); }
}
.tl-bar-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tl-overdue { flex: none; }
.tl-deadline { position: absolute; top: 4px; height: 32px; width: 2px; background: #303133; opacity: .85; pointer-events: none; }
.tl-today-line { border-left: 2px dashed #f56c6c; z-index: 3; pointer-events: none; }
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
.ms-head-actions { display: flex; align-items: center; gap: 8px; }
.ms-head-actions .el-icon { margin-right: 4px; }
.tl-colhead { position: sticky; top: 0; z-index: 5; height: 40px; padding: 0 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; background: #f7f8fa; border-bottom: 1px solid #e8eaef; border-right: 1px solid #eef0f4; cursor: pointer; }
.tl-colhead:hover { background: #f5f9ff; }
.tl-colhead-title { display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: #1f2430; }
.tl-colhead-sub { max-width: 100%; font-size: 10px; color: #9ca3af; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tl-rowhead { position: sticky; left: 0; z-index: 4; height: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #fff; border-bottom: 1px solid #f2f3f5; border-right: 1px solid #e8eaef; font-size: 11px; color: #4b5563; }
.tl-rowhead small { font-size: 9px; color: #c0c4cc; }
.tl-rowhead.is-today { color: #f56c6c; font-weight: 700; background: #fff8f8; }
.tl-bar-wrap-v { position: relative; pointer-events: none; z-index: 2; }
.tl-bar-v { position: absolute; left: 8px; width: calc(100% - 16px); border-radius: 8px; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0 6px; color: #fff; font-size: 11px; font-weight: 600; cursor: pointer; pointer-events: auto; box-shadow: 0 4px 10px -4px rgba(0,0,0,.35); transition: transform .15s, box-shadow .15s; }
.tl-bar-v:hover { transform: translateX(-1px); box-shadow: 0 8px 16px -6px rgba(0,0,0,.45); }
.tl-bar-v-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tl-deadline-v { position: absolute; left: 4px; right: 4px; height: 2px; background: #303133; opacity: .85; pointer-events: none; }
.tl-today-line-v { border-top: 2px dashed #f56c6c; z-index: 3; pointer-events: none; }
/* 筛选只隐藏内容，坐标轴保持不变 */
.tl-name.is-filtered, .tl-colhead.is-filtered { opacity: .35; }
.tl-cell.is-filtered { background: #fafafa; }
.tl-bar-wrap.is-filtered, .tl-bar-wrap-v.is-filtered { visibility: hidden; }
</style>
