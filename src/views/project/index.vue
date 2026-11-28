<script setup>
import Card from './components/card.vue'
import ProjectFormDialog from './components/ProjectFormDialog.vue'
import TemplatePickerDialog from '@/views/template/components/TemplatePickerDialog.vue'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createProject, deleteProject, getProjectList, updateProject, closeProject, reopenProject, pinProject, moveProject } from '@/api/project'
import { StarFilled, Grid, FolderOpened } from '@element-plus/icons-vue'
import { useMemberStore } from '@/stores/memberStore'
import { useTaskStore } from '@/stores/taskStore'
import { useUserStore } from '@/stores/userStore'
import { canCreateProject, canManageProject } from '@/utils/permissions'
import { ROLE } from '@/constants/user'

const memberStore = useMemberStore()
const taskStore = useTaskStore()
const userStore = useUserStore()
const router = useRouter()
const route = useRoute()

// 详情已是独立路由（/project/:id），这个组件只用于看板
// 保留 computed 纯粹为了模板结构清晰
const isBoard = computed(() => route.name === 'ProjectBoard')

// 点击卡片进入项目详情页（归档项目复用同一路由，由项目状态决定只读）
const openDetail = (project) => {
    router.push(`/project/${project.id}`)
}

// 只有项目负责人或管理员能编辑 / 关闭 / 删除项目
const canManage = (project) => canManageProject(userStore.userInfo, project)
const canCreate = computed(() => canCreateProject(userStore.userInfo))
// 项目经理创建项目时，负责人锁定为自己，避免创建后失去管理权
const pmLockedTo = computed(() =>
    userStore.userInfo?.role === ROLE.PM ? userStore.userInfo.id : ''
)

const dialogVisible = ref(false)

// 列表与查询
const projectList = ref([])
// 置顶泳道单独加载，不参与普通泳道分页
const pinnedProjects = ref([])
// 归档泳道：自己持有本地 ref，绝不共用 projectStore.projectList（两个 scope 会互相覆盖）
const archivedProjects = ref([])
const loading = ref(true)
const keyword = ref('')
const page = ref(1)
const pageSize = ref(8)
const total = ref(0)

// 新增 / 编辑：null 表示新增，项目对象表示编辑
const editingProject = ref(null)

// id -> 姓名：直接用 store 提供的方法
const memberName = memberStore.memberName

// 项目卡上的「正在查看」头像 = 该项目所有任务访客的并集，
// 所以看板必须知道每个项目有哪些任务。这里只取 id，卡片自己不去拉任务详情。
const taskIdsOf = (projectId) => (taskStore.taskMap[projectId] || []).map((t) => t.id)

const loadProjects = async () => {
    loading.value = true
    try {
        const [res, pinnedRes, archivedRes] = await Promise.all([
            getProjectList({
                keyword: keyword.value,
                page: page.value,
                size: pageSize.value,
                scope: 'active',
                pinned: 'exclude'
            }),
            getProjectList({
                keyword: keyword.value,
                page: 1,
                size: 100,
                scope: 'active',
                pinned: 'only'
            }),
            getProjectList({
                keyword: keyword.value,
                page: 1,
                size: 100,
                scope: 'archived'
            })
        ])
        projectList.value = res.list
        total.value = res.total
        pinnedProjects.value = pinnedRes.list || []
        archivedProjects.value = archivedRes.list || []
        // 置顶 / 删除后当前页可能变空，回到上一页
        if (!projectList.value.length && page.value > 1) {
            page.value -= 1
            await loadProjects()
        }
    } catch (error) {
        ElMessage.error(error.message || '项目列表加载失败')
    } finally {
        loading.value = false
    }
}

// ——— 置顶与泳道排序 ———
const pinHandler = async (project) => {
    if (!canManage(project)) {
        ElMessage.warning('只有项目负责人或管理员可以置顶项目')
        return
    }
    try {
        await pinProject(project.id, !project.pinned)
        ElMessage.success(project.pinned ? '已取消置顶' : '已置顶')
        page.value = 1
        await loadProjects()
    } catch (error) {
        ElMessage.error(error.message || '操作失败')
    }
}

const moveHandler = async (project, direction) => {
    if (!canManage(project)) {
        ElMessage.warning('只有项目负责人或管理员可以调整项目顺序')
        return
    }
    try {
        await moveProject(project.id, direction)
        await loadProjects()
    } catch (error) {
        ElMessage.error(error.message || '调整顺序失败')
    }
}

const handleSearch = () => {
    page.value = 1
    loadProjects()
}

const handlePageChange = (value) => {
    page.value = value
    loadProjects()
}

const openCreate = () => {
    editingProject.value = null
    dialogVisible.value = true
}

// 新建下拉：空白项目 / 从模板创建
const templatePickerVisible = ref(false)

const handleCreateCommand = (command) => {
    if (command === 'template') {
        templatePickerVisible.value = true
        return
    }
    openCreate()
}

// 模板创建成功后直接进入新项目详情
const handleTemplateApplied = (project) => {
    templatePickerVisible.value = false
    if (project?.id) router.push(`/project/${project.id}`)
}

const openEdit = (project) => {
    if (!canManage(project)) {
        ElMessage.warning('只有项目负责人或管理员可以编辑项目')
        return
    }
    editingProject.value = project
    dialogVisible.value = true
}

// 弹窗只负责收集和校验，保存仍由页面统一处理
const submitProject = async (payload) => {
    try {
        if (editingProject.value) {
            await updateProject(editingProject.value.id, payload)
            ElMessage.success('项目已更新')
        } else {
            await createProject(payload)
            ElMessage.success('项目已创建')
            page.value = 1
        }
        dialogVisible.value = false
        editingProject.value = null
        loadProjects()
    } catch (error) {
        ElMessage.error(error.message || '保存失败')
    }
}

const removeProject = async (project) => {
    if (!canManage(project)) {
        ElMessage.warning('只有项目负责人或管理员可以删除项目')
        return
    }
    try {
        await ElMessageBox.confirm(`确定删除项目「${project.title}」吗？`, '删除确认', { type: 'warning' })
    } catch {
        return
    }
    try {
        await deleteProject(project.id)
        ElMessage.success('项目已删除')
        if (projectList.value.length === 1 && page.value > 1) {
            page.value -= 1
        }
        loadProjects()
    } catch (error) {
        ElMessage.error(error.message || '删除失败')
    }
}

// 关闭项目 → 进入项目看板的归档泳道，数据只读但完整保留
const closeProjectHandler = async (project) => {
    if (!canManage(project)) {
        ElMessage.warning('只有项目负责人或管理员可以关闭项目')
        return
    }
    try {
        await ElMessageBox.confirm(
            `关闭项目「${project.title}」后，项目会进入项目看板的「归档」泳道，所有任务变为只读，历史与时间线完整保留。\n\n如需继续推进，可在归档泳道撤销归档。`,
            '关闭项目',
            { type: 'warning', confirmButtonText: '关闭并归档', cancelButtonText: '取消' }
        )
    } catch {
        return
    }
    try {
        await closeProject(project.id)
        ElMessage.success('项目已关闭并归档')
        if (projectList.value.length === 1 && page.value > 1) {
            page.value -= 1
        }
        loadProjects()
    } catch (error) {
        ElMessage.error(error.message || '关闭项目失败')
    }
}

// 撤销归档：归档泳道上的按钮，只有项目负责人或管理员可用
const reopenHandler = async (project) => {
    if (!canManage(project)) {
        ElMessage.warning('只有项目负责人或管理员可以撤销归档')
        return
    }
    try {
        await ElMessageBox.confirm(
            `确定撤销项目「${project.title}」的归档吗？项目会重新出现在普通泳道，任务恢复可编辑。`,
            '撤销归档',
            { type: 'warning', confirmButtonText: '撤销归档', cancelButtonText: '取消' }
        )
    } catch {
        return
    }
    try {
        await reopenProject(project.id)
        ElMessage.success('撤销归档成功')
        loadProjects()
    } catch (error) {
        ElMessage.error(error.message || '撤销归档失败')
    }
}

onMounted(() => {
    // 页面进来再兜底触发一次（幂等，不会重复请求）
    memberStore.initMembers()
    // 只是为了让项目卡能汇总任务上的「正在查看」头像，失败不影响看板本身
    taskStore.initAll().catch(() => {})
    loadProjects()
})
</script>

<template>
  <div class="project-page-root">
    <!-- 兼容：非看板模式下仍保留路由出口（当前详情已独立路由，不会进入） -->
    <RouterView v-if="!isBoard" />
    <template v-else>
        <!-- 数据到达前整块隐藏，避免空态与加载态来回跳变 -->
        <div :style="{ visibility: loading ? 'hidden' : 'visible' }">
        <div class="search">
            <div class="search-left">
                <el-input v-model="keyword" placeholder="请输入项目名称" style="width: 240px" clearable
                    @keyup.enter="handleSearch" />
                <el-button type="primary" @click="handleSearch">查询</el-button>
            </div>
            <el-dropdown v-if="canCreate" trigger="click" @command="handleCreateCommand">
                <el-button type="primary">
                    <el-icon style="margin-right: 4px"><Plus /></el-icon>新建项目
                    <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                    <el-dropdown-menu>
                        <el-dropdown-item command="blank">新建空白项目</el-dropdown-item>
                        <el-dropdown-item command="template">从模板创建</el-dropdown-item>
                    </el-dropdown-menu>
                </template>
            </el-dropdown>
        </div>
        <el-divider />
        <!-- 置顶泳道：横向排列，不参与普通项目分页 -->
        <section v-if="pinnedProjects.length" class="pinned-lane">
            <div class="lane-head">
                <span class="lane-title">
                    <el-icon><StarFilled /></el-icon>置顶项目
                    <span class="lane-count">{{ pinnedProjects.length }}</span>
                </span>
                <span class="lane-hint">横向滑动查看，可与普通泳道分开排序</span>
            </div>
            <div class="pinned-scroll">
                <Card v-for="(item, index) in pinnedProjects" :key="item.id" class="pinned-card"
                    :title="item.title" :type="item.type" :icon="item.icon" :created-at="item.createdAt"
                    :owner="memberName(item.PM)" :desc="item.desc" :priority="item.priority" :status="item.status"
                    :pinned="true" :can-close="canManage(item)" :can-edit="canManage(item)"
                    :can-delete="canManage(item)" :can-pin="canManage(item)" :can-move-up="index > 0"
                    :can-move-down="index < pinnedProjects.length - 1" :project-id="item.id"
                    :task-ids="taskIdsOf(item.id)" @open="openDetail(item)"
                    @edit="openEdit(item)" @delete="removeProject(item)" @close="closeProjectHandler(item)"
                    @pin="pinHandler(item)" @move-up="moveHandler(item, 'up')"
                    @move-down="moveHandler(item, 'down')" />
            </div>
        </section>

        <!-- 普通泳道：未置顶项目 -->
        <section class="normal-lane">
            <div class="lane-head">
                <span class="lane-title lane-title-normal">
                    <el-icon><Grid /></el-icon> 全部项目
                    <span class="lane-count lane-count-normal">{{ total }}</span>
                </span>
                <span class="lane-hint">未置顶的项目</span>
            </div>
            <div v-loading="loading" class="card-container">
                <Card v-for="(item, index) in projectList" :key="item.id" :title="item.title" :type="item.type"
                    :icon="item.icon" :created-at="item.createdAt" :owner="memberName(item.PM)" :desc="item.desc"
                    :priority="item.priority" :status="item.status" :pinned="false" :can-close="canManage(item)"
                    :can-edit="canManage(item)" :can-delete="canManage(item)" :can-pin="canManage(item)"
                    :can-move-up="index > 0" :can-move-down="index < projectList.length - 1"
                    :project-id="item.id" :task-ids="taskIdsOf(item.id)" @open="openDetail(item)"
                    @edit="openEdit(item)" @delete="removeProject(item)"
                    @close="closeProjectHandler(item)" @pin="pinHandler(item)"
                    @move-up="moveHandler(item, 'up')" @move-down="moveHandler(item, 'down')" />
                <el-empty v-if="!loading && !projectList.length && !pinnedProjects.length" description="暂无项目"
                    class="empty" />
            </div>
        </section>
        <div v-if="total > pageSize" class="pagination">
            <el-pagination background layout="prev, pager, next" :total="total" :page-size="pageSize"
                :current-page="page" @current-change="handlePageChange" />
        </div>
        <!-- 归档泳道：已关闭项目只读，负责人/管理员可撤销归档 -->
        <section class="archived-lane">
            <div class="lane-head">
                <span class="lane-title archived-title">
                    <el-icon><FolderOpened /></el-icon>归档项目
                    <span class="lane-count archived-count">{{ archivedProjects.length }}</span>
                </span>
                <span class="lane-hint">只读保留历史，可撤销归档恢复编辑</span>
            </div>
            <div class="card-container archived-container">
                <Card v-for="item in archivedProjects" :key="item.id" :title="item.title" :type="item.type"
                    :icon="item.icon" :created-at="item.createdAt" :owner="memberName(item.PM)" :desc="item.desc"
                    :priority="item.priority" :status="item.status" :pinned="false" :can-close="false"
                    :can-edit="false" :can-delete="false" :can-pin="false" :can-move-up="false" :can-move-down="false"
                    :can-reopen="canManage(item)" :project-id="item.id" :task-ids="taskIdsOf(item.id)"
                    @open="openDetail(item)" @reopen="reopenHandler(item)" />
                <el-empty v-if="!archivedProjects.length" description="暂无归档项目" class="empty" />
            </div>
        </section>
        <ProjectFormDialog v-model="dialogVisible" :project="editingProject" :pm-locked-to="pmLockedTo"
            @submit="submitProject" />
        <TemplatePickerDialog v-model="templatePickerVisible" @applied="handleTemplateApplied" />
        </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.search {
    display: flex;
    justify-content: space-between;
    margin: 20px;
    gap: 10px;
    .search-left{
        display: flex;
        align-items: center;
        gap: 8px;
    }
}

.pinned-lane,
.normal-lane,
.archived-lane {
    padding: 0 20px;
}

.lane-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
}

.lane-title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: #92400e;

    .el-icon {
        color: #f59e0b;
    }
}

.lane-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    font-size: 11px;
    color: #92400e;
    background: #fef3c7;
    border-radius: 999px;
}

.lane-hint {
    font-size: 11px;
    color: #9ca3af;
}

// 普通泳道标题：与置顶泳道区分，但不抢视觉
.lane-title-normal {
    color: #1f2430;

    .el-icon {
        color: #9ca3af;
    }
}

.lane-count-normal {
    color: #6b7280;
    background: #f1f5f9;
}

.archived-title {
    color: #6b7280;

    .el-icon {
        color: #9ca3af;
    }
}

.archived-count {
    color: #6b7280;
    background: #f1f5f9;
}

.archived-container {
    min-height: 140px;
}

.pinned-scroll {
    display: flex;
    align-items: stretch;
    gap: 16px;
    overflow-x: auto;
    // 上下留白：卡片 hover 会上移，避免被滚动容器裁切
    padding: 14px 2px 18px;
    scrollbar-width: thin;
}

.pinned-card {
    // Card 自带 16px padding，用 border-box 才能和普通泳道的 280px 对齐
    flex: 0 0 280px;
    box-sizing: border-box;
}

.card-container {
    // 顶部留白与置顶泳道一致，hover 上移也不会被裁切
    padding: 14px 0 20px;
    display: grid;
    // 与置顶泳道卡片同宽，两条泳道视觉尺寸一致
    grid-template-columns: repeat(auto-fill, 280px);
    gap: 16px;
    align-items: stretch;
    min-height: 200px;
}

@media (max-width: 720px) {
    .card-container {
        grid-template-columns: 1fr;
    }

    .pinned-card {
        flex-basis: 260px;
    }
}

.empty {
    grid-column: 1 / -1;
}

.pagination {
    display: flex;
    justify-content: flex-end;
    padding: 0 20px 20px;
}

</style>
