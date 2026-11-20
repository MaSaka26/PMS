<script setup>
import Card from './components/card.vue'
import ProjectFormDialog from './components/ProjectFormDialog.vue'
import TemplatePickerDialog from '@/views/template/components/TemplatePickerDialog.vue'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createProject, deleteProject, getProjectList, updateProject, closeProject } from '@/api/project'
import { useMemberStore } from '@/stores/memberStore'
import { useUserStore } from '@/stores/userStore'
import { canCreateProject, canManageProject } from '@/utils/permissions'

const memberStore = useMemberStore()
const userStore = useUserStore()
const router = useRouter()
const route = useRoute()

// 看板既承担列表页，也是「项目详情」的父路由：
// 当前若是子路由（详情），本组件只渲染 RouterView，避免看板内容叠加在详情页上
const isBoard = computed(() => route.name === 'ProjectBoard')

// 点击卡片进入项目详情页（挂在看板路由下，面包屑可显示完整层级）
const openDetail = (project) => {
    router.push(`/project/board/${project.id}`)
}

// 只有项目负责人或管理员能编辑 / 关闭 / 删除项目
const canManage = (project) => canManageProject(userStore.userInfo, project)
const canCreate = computed(() => canCreateProject(userStore.userInfo))
// 项目经理创建项目时，负责人锁定为自己，避免创建后失去管理权
const pmLockedTo = computed(() =>
    userStore.userInfo?.role === 'pm' ? userStore.userInfo.id : ''
)

const dialogVisible = ref(false)

// 列表与查询
const projectList = ref([])
const loading = ref(false)
const keyword = ref('')
const page = ref(1)
const pageSize = ref(8)
const total = ref(0)

// 新增 / 编辑：null 表示新增，项目对象表示编辑
const editingProject = ref(null)

// id -> 姓名：直接用 store 提供的方法
const memberName = memberStore.memberName

const loadProjects = async () => {
    loading.value = true
    try {
        const res = await getProjectList({
            keyword: keyword.value,
            page: page.value,
            size: pageSize.value,
            scope: 'active'
        })
        projectList.value = res.list
        total.value = res.total
    } catch (error) {
        ElMessage.error(error.message || '项目列表加载失败')
    } finally {
        loading.value = false
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
    if (project?.id) router.push(`/project/board/${project.id}`)
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

// 关闭项目 → 自动归档到「项目归档」页，数据只读但完整保留
const closeProjectHandler = async (project) => {
    if (!canManage(project)) {
        ElMessage.warning('只有项目负责人或管理员可以关闭项目')
        return
    }
    try {
        await ElMessageBox.confirm(
            `关闭项目「${project.title}」后，项目会进入「项目归档」，所有任务变为只读，历史与时间线完整保留。\n\n如需继续推进，可在归档页撤销归档。`,
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

onMounted(() => {
    // 页面进来再兜底触发一次（幂等，不会重复请求）
    memberStore.initMembers()
    loadProjects()
})
</script>

<template>
    <!-- 子路由（项目详情）激活时，看板只作为路由出口 -->
    <RouterView v-if="!isBoard" />
    <template v-else>
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
        <div v-loading="loading" class="card-container">
            <Card v-for="item in projectList" :key="item.id" :title="item.title" :type="item.type" :icon="item.icon"
                :created-at="item.createdAt" :owner="memberName(item.PM)" :desc="item.desc" :priority="item.priority"
                :status="item.status" :can-close="canManage(item)" :can-edit="canManage(item)"
                :can-delete="canManage(item)" @open="openDetail(item)" @edit="openEdit(item)"
                @delete="removeProject(item)" @close="closeProjectHandler(item)" />
            <el-empty v-if="!loading && !projectList.length" description="暂无项目" class="empty" />
        </div>
        <div v-if="total > pageSize" class="pagination">
            <el-pagination background layout="prev, pager, next" :total="total" :page-size="pageSize"
                :current-page="page" @current-change="handlePageChange" />
        </div>
        <ProjectFormDialog v-model="dialogVisible" :project="editingProject" :pm-locked-to="pmLockedTo"
            @submit="submitProject" />
        <TemplatePickerDialog v-model="templatePickerVisible" @applied="handleTemplateApplied" />
    </template>
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

.card-container {
    padding: 20px;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
    min-height: 200px;
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
