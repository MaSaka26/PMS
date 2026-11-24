<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { WarningFilled, Search } from '@element-plus/icons-vue'

import { useTaskStore } from '@/stores/taskStore'
import { useProjectStore } from '@/stores/projectStore'
import { useMemberStore } from '@/stores/memberStore'
import { useUserStore } from '@/stores/userStore'
import { TASK_STATUS_LABEL, PRIORITY_ORDER } from '@/constants/status'
import { getDueLevel } from '@/utils/due'
import DueBadge from '@/components/DueBadge.vue'
import TaskDrawer from '@/views/task/components/TaskDrawer.vue'

const router = useRouter()
const taskStore = useTaskStore()
const projectStore = useProjectStore()
const memberStore = useMemberStore()
const userStore = useUserStore()

const loading = ref(false)
const drawerVisible = ref(false)
const drawerTaskId = ref('')

// 归属维度：我的任务分四种「事务」，用分段控件切换
const SCOPES = [
    { value: 'mine', label: '我负责的', hint: '指派给我、还没验收完的任务' },
    { value: 'review', label: '待我验收', hint: '别人提交了、等我点头的' },
    { value: 'created', label: '我建的待认领', hint: '我创建但还没人接的' },
    { value: 'all', label: '全部', hint: '上面三类合起来看' }
]
const scope = ref('mine')
const keyword = ref('')
const priorityFilter = ref('all')
const statusFilter = ref('all')
const showDone = ref(true)

const me = computed(() => userStore.userInfo || {})
const isAdmin = computed(() => me.value.role === 'admin')

const projectMap = computed(() => {
    const map = new Map()
    for (const p of projectStore.projectList) map.set(p.id, p)
    return map
})
const archivedIds = computed(() => {
    const set = new Set()
    for (const p of projectStore.projectList) {
        if (p.status === 'archived') set.add(p.id)
    }
    return set
})

// 全量任务拍平：taskMap 是 projectId → 数组
const allTasks = computed(() => {
    const out = []
    for (const [projectId, list] of Object.entries(taskStore.taskMap || {})) {
        for (const t of list || []) {
            if (t.deletedAt) continue
            if (archivedIds.value.has(projectId)) continue
            out.push({ ...t, projectId })
        }
    }
    return out
})

const isOverdue = (t) => getDueLevel(t.dueDate, t.status)?.level === 'overdue'

// 三类归属事务，同一任务可能同时命中（自己建又自己做的），按 scope 各自独立统计
const buckets = computed(() => {
    const myId = me.value.id
    const mine = []
    const review = []
    const created = []
    for (const t of allTasks.value) {
        if (t.status === 'canceled') continue
        const isMine = t.assignee === myId && t.status !== 'accepted'
        const isReview = t.status === 'done' && t.assignee !== myId
            && (projectMap.value.get(t.projectId)?.PM === myId || isAdmin.value)
        const isCreated = !t.assignee && t.status === 'todo' && t.createdBy === myId
        if (isMine) mine.push(t)
        if (isReview) review.push(t)
        if (isCreated) created.push(t)
    }
    return { mine, review, created, all: [...mine, ...review, ...created] }
})

// 统计卡绑定的是全量 buckets，不受当前筛选影响，否则数字会跟着筛选乱跳
const summary = computed(() => {
    const { mine, review, created } = buckets.value
    return {
        mine: mine.length,
        doing: mine.filter((t) => t.status === 'doing').length,
        review: review.length,
        created: created.length,
        overdue: buckets.value.all.filter(isOverdue).length
    }
})

const scopedTasks = computed(() => {
    const list = buckets.value[scope.value] || []
    return list.filter((t) => {
        if (priorityFilter.value !== 'all' && t.priority !== priorityFilter.value) return false
        if (statusFilter.value !== 'all' && t.status !== statusFilter.value) return false
        if (!showDone.value && (t.status === 'done' || t.status === 'accepted')) return false
        if (keyword.value.trim()) {
            const kw = keyword.value.trim().toLowerCase()
            const title = String(t.title || '').toLowerCase()
            if (!title.includes(kw)) return false
        }
        return true
    })
})

// 默认按截止日期升序，没有截止日期的排最后（不参与「先做哪个」的排序）
const sortedTasks = computed(() => {
    return [...scopedTasks.value].sort((a, b) => {
        if (a.dueDate && b.dueDate) return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0
        if (a.dueDate) return -1
        if (b.dueDate) return 1
        return 0
    })
})

const overdueCount = computed(() => sortedTasks.value.filter(isOverdue).length)

const projectTitle = (id) => projectMap.value.get(id)?.title || '未知项目'
const memberName = (id) => memberStore.memberName(id)
const isPMOf = (t) => projectMap.value.get(t.projectId)?.PM === me.value.id

const rowClassName = ({ row }) => (isOverdue(row) ? 'my-row is-overdue' : 'my-row')

const openTask = (row) => {
    drawerTaskId.value = row.id
    drawerVisible.value = true
}
const goBoard = (row) => {
    router.push({ path: '/task/board', query: { projectId: row.projectId } })
}

const scopeHint = computed(() => SCOPES.find((s) => s.value === scope.value)?.hint || '')

onMounted(async () => {
    loading.value = true
    try {
        await userStore.restoreUserInfo()
        await Promise.all([
            memberStore.initMembers().catch(() => {}),
            projectStore.initProjects().catch(() => {}),
            taskStore.initAll().catch(() => {})
        ])
    } finally {
        loading.value = false
    }
})
</script>

<template>
    <div class="mine-page">
        <header class="page-head">
            <div class="head-main">
                <h2>我的任务</h2>
                <p class="head-sub">
                    看板回答「这个项目走到哪了」，这一页回答「我今天该干什么」。
                    按截止日期升序排，越急越靠上。
                </p>
            </div>
            <div class="head-user">
                <span class="avatar">{{ (me.name || '?').trim().charAt(0) }}</span>
                <div class="user-meta">
                    <strong>{{ me.name || '未登录' }}</strong>
                    <span>{{ me.position || me.role }}</span>
                </div>
            </div>
        </header>

        <!-- 四张事务卡：点一下切到对应归属 -->
        <section class="scope-cards">
            <button type="button" class="scope-card" :class="{ active: scope === 'mine' }"
                @click="scope = 'mine'">
                <span class="sc-label">我负责的</span>
                <span class="sc-value">{{ summary.mine }}</span>
                <span class="sc-foot">其中进行中 {{ summary.doing }} 条</span>
            </button>
            <button type="button" class="scope-card tone-review" :class="{ active: scope === 'review' }"
                @click="scope = 'review'">
                <span class="sc-label">待我验收</span>
                <span class="sc-value">{{ summary.review }}</span>
                <span class="sc-foot">别人提交、等我点头</span>
            </button>
            <button type="button" class="scope-card tone-created" :class="{ active: scope === 'created' }"
                @click="scope = 'created'">
                <span class="sc-label">我建的待认领</span>
                <span class="sc-value">{{ summary.created }}</span>
                <span class="sc-foot">派下去了但没人接</span>
            </button>
            <button type="button" class="scope-card tone-overdue" :class="{ active: scope === 'all' }"
                @click="scope = 'all'">
                <span class="sc-label">
                    <el-icon><WarningFilled /></el-icon>逾期
                </span>
                <span class="sc-value">{{ summary.overdue }}</span>
                <span class="sc-foot">三类事务里已过截止日</span>
            </button>
        </section>

        <!-- 工具条 -->
        <section class="toolbar">
            <el-radio-group v-model="scope" size="small">
                <el-radio-button v-for="s in SCOPES" :key="s.value" :value="s.value">{{ s.label }}
                </el-radio-button>
            </el-radio-group>
            <el-input v-model="keyword" size="small" placeholder="搜索任务标题" clearable style="width: 200px">
                <template #prefix>
                    <el-icon><Search /></el-icon>
                </template>
            </el-input>
            <el-select v-model="priorityFilter" size="small" style="width: 120px">
                <el-option label="全部优先级" value="all" />
                <el-option v-for="p in PRIORITY_ORDER" :key="p" :label="p" :value="p" />
            </el-select>
            <el-select v-model="statusFilter" size="small" style="width: 130px">
                <el-option label="全部状态" value="all" />
                <el-option label="待办" value="todo" />
                <el-option label="进行中" value="doing" />
                <el-option label="待验收" value="done" />
                <el-option label="已验收" value="accepted" />
            </el-select>
            <el-checkbox v-model="showDone" size="small">显示已完成</el-checkbox>
            <span class="toolbar-count">
                {{ sortedTasks.length }} 条
                <template v-if="overdueCount">· 逾期 {{ overdueCount }}</template>
            </span>
        </section>

        <p class="scope-hint">{{ scopeHint }}</p>

        <!-- 列表 -->
        <div v-loading="loading" class="list-wrap">
            <el-table :data="sortedTasks" style="width: 100%" :row-class-name="rowClassName"
                empty-text="这一类暂时没有事，换个分类看看" @row-click="openTask">
                <el-table-column label="任务" min-width="260">
                    <template #default="{ row }">
                        <div class="task-cell">
                            <span class="task-name">{{ row.title }}</span>
                            <span v-if="row.blocked" class="mini-tag is-blocked">
                                <el-icon><WarningFilled /></el-icon>阻塞
                            </span>
                            <span v-if="isOverdue(row)" class="mini-tag is-overdue">逾期</span>
                            <span v-if="isPMOf(row)" class="mini-tag is-pm">我负责这个项目</span>
                        </div>
                    </template>
                </el-table-column>
                <el-table-column label="项目" width="180">
                    <template #default="{ row }">
                        <span class="project-link" @click.stop="goBoard(row)">{{ projectTitle(row.projectId) }}</span>
                    </template>
                </el-table-column>
                <el-table-column label="状态" width="100">
                    <template #default="{ row }">
                        <span class="status-text" :class="`st-${row.status}`">
                            {{ TASK_STATUS_LABEL[row.status] || row.status }}
                        </span>
                    </template>
                </el-table-column>
                <el-table-column label="优先级" width="90">
                    <template #default="{ row }">
                        <span class="priority-text" :class="`p-${row.priority}`">{{ row.priority || '—' }}</span>
                    </template>
                </el-table-column>
                <el-table-column label="负责人" width="120">
                    <template #default="{ row }">
                        <span v-if="row.assignee">{{ memberName(row.assignee) }}</span>
                        <span v-else class="muted">待认领</span>
                    </template>
                </el-table-column>
                <el-table-column label="截止日期" width="160">
                    <template #default="{ row }">
                        <span v-if="row.dueDate" class="due-cell">
                            {{ row.dueDate }}
                            <DueBadge :due-date="row.dueDate" :status="row.status" />
                        </span>
                        <span v-else class="muted">未排期</span>
                    </template>
                </el-table-column>
            </el-table>
        </div>

        <TaskDrawer v-model="drawerVisible" :task-id="drawerTaskId" />
    </div>
</template>

<style scoped lang="scss">
.mine-page {
    padding: 24px 16px 16px 16px;
    min-height: 100%;
}

.page-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 18px;

    .head-main {
        h2 {
            margin: 0 0 6px 0;
            font-size: 20px;
            font-weight: 600;
            color: #1f2430;
        }

        .head-sub {
            margin: 0;
            font-size: 13px;
            color: #6b7280;
            max-width: 720px;
            line-height: 1.6;
        }
    }

    .head-user {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 14px;
        background: #fff;
        border: 1px solid #e8eaef;
        border-radius: 12px;

        .avatar {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 34px;
            height: 34px;
            border-radius: 50%;
            background: linear-gradient(135deg, #409eff, #6366f1);
            color: #fff;
            font-weight: 600;
        }

        .user-meta {
            display: flex;
            flex-direction: column;
            line-height: 1.3;

            strong {
                font-size: 13px;
                color: #1f2430;
            }

            span {
                font-size: 12px;
                color: #9ca3af;
            }
        }
    }
}

.scope-cards {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 16px;

    .scope-card {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 14px 16px;
        text-align: left;
        background: #fff;
        border: 1px solid #e8eaef;
        border-radius: 12px;
        cursor: pointer;
        font-family: inherit;
        transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;

        &:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 18px -10px rgba(16, 24, 40, 0.3);
        }

        &.active {
            border-color: #409eff;
            box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.12);
        }

        .sc-label {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            color: #6b7280;
        }

        .sc-value {
            font-size: 22px;
            font-weight: 700;
            line-height: 1.2;
            color: #1f2430;
        }

        .sc-foot {
            font-size: 11px;
            color: #9ca3af;
        }

        &.tone-review .sc-value { color: #e6a23c; }
        &.tone-created .sc-value { color: #6366f1; }
        &.tone-overdue .sc-value { color: #b45309; }
        &.tone-overdue.active { border-color: #fca5a5; }
    }
}

.toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 6px;

    .toolbar-count {
        font-size: 12px;
        color: #9ca3af;
    }
}

.scope-hint {
    margin: 0 0 10px 0;
    font-size: 12px;
    color: #9ca3af;
}

.list-wrap {
    background: #fff;
    border: 1px solid #e8eaef;
    border-radius: 12px;
    padding: 4px 4px 8px 4px;
}

.task-cell {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;

    .task-name {
        font-weight: 500;
        color: #1f2430;
    }
}

.mini-tag {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 1px 7px;
    font-size: 11px;
    border-radius: 999px;

    &.is-blocked {
        color: #be123c;
        background: #fff1f2;
    }

    &.is-overdue {
        color: #b91c1c;
        background: #fee2e2;
    }

    &.is-pm {
        color: #4f46e5;
        background: #eef2ff;
    }
}

.project-link {
    color: #409eff;
    cursor: pointer;

    &:hover {
        text-decoration: underline;
    }
}

.status-text {
    font-size: 12px;

    &.st-todo { color: #909399; }
    &.st-doing { color: #409eff; }
    &.st-done { color: #e6a23c; }
    &.st-accepted { color: #67c23a; }
}

.priority-text {
    font-size: 12px;
    font-weight: 500;

    &.p-高 { color: #f43f5e; }
    &.p-中 { color: #e6a23c; }
    &.p-低 { color: #909399; }
}

.due-cell {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.muted {
    color: #9ca3af;
    font-style: italic;
}

:deep(.my-row) {
    cursor: pointer;
}

:deep(.my-row.is-overdue) {
    background: #fff7f7;

    td {
        color: #b91c1c;
    }

    .task-name {
        color: #b91c1c;
    }
}

@media (max-width: 1100px) {
    .scope-cards {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 720px) {
    .scope-cards {
        grid-template-columns: 1fr;
    }

    .page-head {
        flex-direction: column;
    }
}
</style>
