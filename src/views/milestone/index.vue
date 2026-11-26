<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Flag, Calendar, WarningFilled } from '@element-plus/icons-vue'
import { useMilestoneStore } from '@/stores/milestoneStore'
import { useProjectStore } from '@/stores/projectStore'
import { useTaskStore } from '@/stores/taskStore'
import { useMemberStore } from '@/stores/memberStore'
import { useUserStore } from '@/stores/userStore'
import { canManageProject, isAdmin } from '@/utils/permissions'
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

const projects = computed(() => projectStore.projectList || [])
const canManage = computed(() => canManageProject(userStore.userInfo, projectStore.getById(projectId.value)))

const all = computed(() => {
  const list = projectId.value
    ? milestoneStore.ofProject(projectId.value)
    : Object.values(milestoneStore.milestoneMap || {})
  return list.filter((m) => !m.deletedAt)
})

const rows = computed(() => all.value
  .filter((m) => statusFilter.value === 'all' || m.status === statusFilter.value)
  .filter((m) => !keyword.value.trim() || (m.title + ' ' + (m.desc || '')).toLowerCase().includes(keyword.value.toLowerCase()))
  .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999')))

const taskCount = (m) => (taskStore.taskMap?.[m.projectId] || []).filter((t) => t.milestoneId === m.id && !t.deletedAt).length
const doneCount = (m) => (taskStore.taskMap?.[m.projectId] || []).filter((t) => t.milestoneId === m.id && !t.deletedAt && t.status === 'accepted').length
const projectName = (id) => projectStore.getById(id)?.name || id
const ownerName = (id) => memberStore.memberName(id)

const delayDays = (m) => {
  const due = m.commitment?.dueDate || m.dueDate
  return due ? -diffDays(due, new Date()) : 0
}
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
    .filter((t) => t.dragging)
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
    await ElMessageBox.confirm(`确定删除「${m.title}」吗？子任务会保留，仅解除关联。`, '删除里程碑', { type: 'warning' })
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
        <h2>里程碑管理</h2>
        <p>里程碑是一段可验收的交付阶段；状态由底下任务汇总，日期单独标红。</p>
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
      <span class="ms-count">共 {{ rows.length }} 条</span>
    </div>

    <el-table :data="rows" style="width: 100%" row-key="id" @row-click="openDetail">
      <el-table-column label="里程碑" min-width="220">
        <template #default="{ row }">
          <div class="ms-title"><el-icon><Flag /></el-icon><span>{{ row.title }}</span></div>
          <div class="ms-desc">{{ row.desc || '—' }}</div>
        </template>
      </el-table-column>
      <el-table-column label="项目" width="160">
        <template #default="{ row }">{{ projectName(row.projectId) }}</template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }"><span class="ms-status" :class="'st-' + row.status">{{ TASK_STATUS_LABEL[row.status] || row.status }}</span></template>
      </el-table-column>
      <el-table-column label="子任务" width="110">
        <template #default="{ row }">{{ doneCount(row) }}/{{ taskCount(row) }}</template>
      </el-table-column>
      <el-table-column label="负责人" width="110">
        <template #default="{ row }">{{ ownerName(row.owner) }}</template>
      </el-table-column>
      <el-table-column label="承诺截止" width="140">
        <template #default="{ row }">
          {{ (row.commitment?.dueDate || row.dueDate) || '—' }}
          <el-tag v-if="isOverdue(row)" type="danger" size="small">逾期 {{ delayDays(row) }} 天</el-tag>
        </template>
      </el-table-column>
      <el-table-column v-if="canManage" label="操作" width="90" fixed="right">
        <template #default="{ row }">
          <el-button link type="danger" size="small" @click.stop="removeMilestone(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-drawer v-model="childrenVisible" :title="selected?.title + ' · 子任务'" size="520px">
      <template v-if="selected">
        <div class="ms-detail-meta">
          <p>{{ selected.desc }}</p>
          <p>承诺截止：{{ (selected.commitment?.dueDate || selected.dueDate) || '—' }}</p>
          <p v-if="isOverdue(selected)" class="ms-warn"><el-icon><WarningFilled /></el-icon> 里程碑已逾期 {{ delayDays(selected) }} 天，下面这些子任务拖慢了进度：</p>
        </div>
        <el-table :data="draggingChildren" size="small">
          <el-table-column label="任务" min-width="180" prop="title" />
          <el-table-column label="状态" width="90">
            <template #default="{ row }">{{ TASK_STATUS_LABEL[row.status] || row.status }}</template>
          </el-table-column>
          <el-table-column label="截止日期" width="120" prop="dueDate" />
          <el-table-column label="操作" width="90" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click.stop="locateTask(row)">看板定位</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!draggingChildren.length" description="没有拖慢进度的子任务" />
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
.ms-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
.ms-count { color: #909399; font-size: 12px; margin-left: auto; }
.ms-title { display: flex; align-items: center; gap: 6px; font-weight: 600; }
.ms-desc { color: #909399; font-size: 11px; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 280px; }
.ms-status { font-size: 12px; }
.st-todo { color: #909399; } .st-doing { color: #409eff; } .st-done { color: #e6a23c; } .st-accepted { color: #67c23a; } .st-canceled { color: #c0c4cc; }
.ms-detail-meta { margin-bottom: 12px; font-size: 13px; p { margin: 4px 0; } }
.ms-warn { color: #f56c6c; display: flex; align-items: center; gap: 4px; }
</style>
