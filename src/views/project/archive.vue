<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { RefreshLeft, Search } from '@element-plus/icons-vue'
import { getProjectList, reopenProject } from '@/api/project'
import { useMemberStore } from '@/stores/memberStore'
import { useUserStore } from '@/stores/userStore'
import { canManageProject } from '@/utils/permissions'

const router = useRouter()
const route = useRoute()
const memberStore = useMemberStore()
const userStore = useUserStore()

// 归档页同时是「归档项目详情」的父路由：子路由激活时只渲染 RouterView
const isArchive = computed(() => route.name === 'ProjectArchive')

const list = ref([])
const loading = ref(false)
const keyword = ref('')
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)

const memberName = (id) => memberStore.memberName(id)

const canManage = (project) => canManageProject(userStore.userInfo, project)

const formatTime = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const load = async () => {
    loading.value = true
    try {
        const res = await getProjectList({
            keyword: keyword.value,
            page: page.value,
            size: pageSize.value,
            scope: 'archived'
        })
        list.value = res.list || []
        total.value = res.total || 0
    } catch (error) {
        ElMessage.error(error.message || '归档项目加载失败')
    } finally {
        loading.value = false
    }
}

const handleSearch = () => {
    page.value = 1
    load()
}

const handlePageChange = (value) => {
    page.value = value
    load()
}

// 点击行进入项目详情（挂在归档路由下，面包屑可显示完整层级）
const openDetail = (row) => {
    router.push(`/project/archive/${row.id}`)
}

const reopenHandler = async (project) => {
    try {
        await ElMessageBox.confirm(
            `撤销归档后，「${project.title}」会回到项目看板并恢复编辑。\n\n已删除的任务不会被自动恢复。`,
            '撤销归档',
            { type: 'warning', confirmButtonText: '撤销归档', cancelButtonText: '取消' }
        )
    } catch {
        return
    }
    try {
        await reopenProject(project.id)
        ElMessage.success('项目已撤销归档，回到项目看板')
        if (list.value.length === 1 && page.value > 1) page.value -= 1
        load()
    } catch (error) {
        ElMessage.error(error.message || '撤销归档失败')
    }
}

onMounted(() => {
    memberStore.initMembers()
    load()
})
</script>

<template>
    <!-- 子路由（归档项目详情）激活时，归档列表只作为路由出口 -->
    <RouterView v-if="!isArchive" />
    <div v-else class="archive-page">
        <header class="page-head">
            <div class="head-text">
                <h1>项目归档</h1>
                <p>已关闭的项目只读保留，历史记录和任务时间线完整可查；需要继续推进时可撤销归档。</p>
            </div>
            <div class="head-actions">
                <el-input v-model="keyword" placeholder="搜索项目名称 / 类型" clearable style="width: 240px"
                    @keyup.enter="handleSearch">
                    <template #prefix>
                        <el-icon>
                            <Search />
                        </el-icon>
                    </template>
                </el-input>
                <el-button type="primary" @click="handleSearch">查询</el-button>
            </div>
        </header>

        <div v-loading="loading" class="table-wrap">
            <el-table :data="list" stripe style="width: 100%" empty-text="暂无归档项目" row-class-name="archive-row"
                @row-click="openDetail">
                <el-table-column prop="title" label="项目" min-width="150">
                    <template #default="{ row }">
                        <div class="project-cell">
                            <span class="dot" aria-hidden="true"></span>
                            <div class="cell-text">
                                <span class="name">{{ row.title }}</span>
                                <span class="type">{{ row.type }}</span>
                            </div>
                        </div>
                    </template>
                </el-table-column>
                <el-table-column label="负责人" width="100" align="center">
                    <template #default="{ row }">{{ memberName(row.PM) }}</template>
                </el-table-column>
                <el-table-column label="成员数" width="90" align="center">
                    <template #default="{ row }">{{ (row.members || []).length }}</template>
                </el-table-column>
                <el-table-column label="创建时间" width="120" align="center">
                    <template #default="{ row }">{{ row.createdAt || '—' }}</template>
                </el-table-column>
                <el-table-column label="关闭时间" width="170" align="center">
                    <template #default="{ row }">{{ formatTime(row.closedAt) }}</template>
                </el-table-column>
                <el-table-column label="操作" width="130" align="center">
                    <template #default="{ row }">
                        <el-button v-if="canManage(row)" link type="primary" :icon="RefreshLeft"
                            @click.stop="reopenHandler(row)">
                            撤销归档
                        </el-button>
                        <span v-else class="readonly-tip">只读</span>
                    </template>
                </el-table-column>
            </el-table>
        </div>

        <div v-if="total > pageSize" class="pagination">
            <el-pagination background layout="prev, pager, next" :total="total" :page-size="pageSize"
                :current-page="page" @current-change="handlePageChange" />
        </div>
    </div>
</template>

<style scoped lang="scss">
.archive-page {
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.page-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;

    .head-text {
        h1 {
            margin: 0 0 6px;
            font-size: 18px;
            color: #1f2430;
        }

        p {
            margin: 0;
            font-size: 12px;
            line-height: 1.6;
            color: #6b7280;
        }
    }

    .head-actions {
        display: flex;
        align-items: center;
        gap: 10px;
    }
}

.table-wrap {
    background: #fff;
    border: 1px solid #e8eaef;
    border-radius: 12px;
    overflow: hidden;
    min-height: 160px;

    :deep(.archive-row) {
        cursor: pointer;
    }
}

.project-cell {
    display: flex;
    align-items: center;
    gap: 10px;

    .dot {
        width: 8px;
        height: 8px;
        flex-shrink: 0;
        background: #94a3b8;
        border-radius: 50%;
        box-shadow: 0 0 0 4px rgba(148, 163, 184, 0.15);
    }

    .cell-text {
        display: flex;
        flex-direction: column;
        min-width: 0;
    }

    .name {
        font-weight: 600;
        color: #1f2430;
    }

    .type {
        font-size: 11px;
        color: #9ca3af;
    }
}

.readonly-tip {
    font-size: 12px;
    color: #c0c4cc;
}

.pagination {
    display: flex;
    justify-content: flex-end;
}
</style>