<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { useMemberStore } from '@/stores/memberStore'
import { useUserStore } from '@/stores/userStore'
import { canCreateMember, canEditMember, canToggleMemberActive, canManageAccount } from '@/utils/permissions'
import MemberRoleLane from './components/MemberRoleLane.vue'
import MemberDetailDialog from './components/MemberDetailDialog.vue'
import MemberFormDialog from './components/MemberFormDialog.vue'
import MemberHandoverDialog from './components/MemberHandoverDialog.vue'
import { ROLE } from '@/constants/user'

const memberStore = useMemberStore()
const userStore = useUserStore()

const ROLE_LABEL = {
    [ROLE.ADMIN]: '管理员',
    [ROLE.PM]: '项目经理',
    [ROLE.MEMBER]: '成员'
}
const ROLE_LANES = [
    { role: ROLE.ADMIN, label: '管理员', desc: '系统与全局配置' },
    { role: ROLE.PM, label: '项目经理', desc: '项目交付与成员协调' },
    { role: ROLE.MEMBER, label: '成员', desc: '任务执行与协作' }
]
const roleLabel = (role) => ROLE_LABEL[role] || role || '成员'

// ——— 权限 ———
const currentUser = computed(() => userStore.userInfo)
const canCreate = computed(() => canCreateMember(currentUser.value))
const canAssignRole = computed(() => canManageAccount(currentUser.value))
const canManageAccountUser = computed(() => canManageAccount(currentUser.value))
const canEdit = (member) => canEditMember(currentUser.value, member)
const canToggleActive = (member) => canToggleMemberActive(currentUser.value) && member.id !== currentUser.value?.id

// ——— 搜索：只覆盖姓名和角色 ———
const keyword = ref('')
const filteredList = computed(() => {
    const kw = keyword.value.trim().toLowerCase()
    if (!kw) return memberStore.memberList
    return memberStore.memberList.filter(
        (m) =>
            (m.name || '').toLowerCase().includes(kw) ||
            (m.role || '').toLowerCase().includes(kw) ||
            roleLabel(m.role).includes(kw)
    )
})

// 三条泳道；搜索时隐藏没有结果的角色行
const lanes = computed(() =>
    ROLE_LANES.map((lane) => ({
        ...lane,
        members: filteredList.value.filter((m) => m.role === lane.role)
    })).filter((lane) => !keyword.value.trim() || lane.members.length > 0)
)

// ——— 新增 / 编辑 ———
const formVisible = ref(false)
const editingMember = ref(null)

const openCreate = () => {
    if (!canCreate.value) {
        ElMessage.warning('只有管理员或项目经理可以添加成员')
        return
    }
    editingMember.value = null
    formVisible.value = true
}

const openEdit = (member) => {
    if (!canEdit(member)) {
        ElMessage.warning('没有权限修改该成员')
        return
    }
    editingMember.value = member
    formVisible.value = true
}

const submitMember = async (payload) => {
    try {
        if (editingMember.value) {
            await memberStore.editMember(editingMember.value.id, payload)
            ElMessage.success('成员已更新')
        } else {
            await memberStore.addMember(payload)
            ElMessage.success(
                payload.username ? `成员已添加，登录账号：${payload.username}` : '成员已添加'
            )
        }
        formVisible.value = false
        editingMember.value = null
    } catch (error) {
        ElMessage.error(error.message || '保存失败')
    }
}

// ——— 移交 ———
const handoverVisible = ref(false)
const handoverMember = ref(null)

// ——— 停用 / 启用 ———
// 真正提交停用。allowHandover 为 false 时（移交完的自动重试）不再重复弹移交入口，
// 只把错误照常报出来，避免死循环。
const submitToggle = async (member, nextActive, { askHandover = true } = {}) => {
    try {
        await memberStore.editMember(member.id, { active: nextActive })
        ElMessage.success(nextActive ? '成员已启用' : '成员已停用')
        return true
    } catch (error) {
        const msg = error.message || '操作失败'
        // 停用被「还在负责项目 / 还有未完成任务」挡住时，不要只丢一句报错让人自己去翻，
        // 直接给一条出路：现在就把他手上的事交出去。
        const blocked = askHandover && /先移交负责人|先转派/.test(msg)
        if (!blocked) {
            ElMessage.error(msg)
            return false
        }
        try {
            await ElMessageBox.confirm(
                `${msg}\n\n现在就把他手上的项目与任务移交给别人吗？`,
                '需要先移交',
                { type: 'warning', confirmButtonText: '去移交', cancelButtonText: '稍后处理' }
            )
        } catch {
            return false
        }
        handoverMember.value = member
        handoverVisible.value = true
        return false
    }
}

const toggleActive = async (member) => {
    if (!canToggleActive(member)) {
        ElMessage.warning('只有管理员可以停用或启用成员')
        return
    }
    const nextActive = member.active === false
    if (!nextActive) {
        try {
            await ElMessageBox.confirm(
                `停用「${member.name}」后，该成员仍保留在历史记录中，但不能再被选为新任务的负责人。\n\n项目负责人或未完成任务未处理时，系统会阻止停用。`,
                '停用成员',
                { type: 'warning', confirmButtonText: '停用', cancelButtonText: '取消' }
            )
        } catch {
            return
        }
    }
    await submitToggle(member, nextActive)
}

const onHandoverDone = (member) => {
    handoverVisible.value = false
    // 移交完立刻重试停用，用户不用再点一次
    if (member) submitToggle(member, false, { askHandover: false })
}

// ——— 详情 ———
const detailVisible = ref(false)
const selectedMember = ref(null)

const openDetail = (member) => {
    selectedMember.value = member
    detailVisible.value = true
}

const editFromDetail = (member) => {
    detailVisible.value = false
    openEdit(member)
}

const toggleFromDetail = (member) => {
    detailVisible.value = false
    toggleActive(member)
}

onMounted(async () => {
    await userStore.restoreUserInfo()
    memberStore.initMembers().catch(() => {
        ElMessage.error('成员列表加载失败')
    })
})
</script>

<template>
    <div class="page">
        <header class="page-header">
            <div>
                <h1 class="page-title">成员管理</h1>
                <p class="page-subtitle">
                    共 {{ memberStore.memberList.length }} 位成员，按角色分为三条泳道
                </p>
            </div>
            <div class="page-actions">
                <el-input v-model="keyword" placeholder="搜索姓名 / 角色" clearable class="search-input">
                    <template #prefix>
                        <el-icon><Search /></el-icon>
                    </template>
                </el-input>
                <el-button v-if="canCreate" type="primary" @click="openCreate">
                    <el-icon style="margin-right: 4px"><Plus /></el-icon>新增成员
                </el-button>
            </div>
        </header>

        <main class="role-lanes">
            <MemberRoleLane v-for="lane in lanes" :key="lane.role" :role="lane.role" :label="lane.label"
                :desc="lane.desc" :members="lane.members" :can-edit="canEdit"
                @open="openDetail" @edit="openEdit" />

            <el-empty v-if="keyword && !filteredList.length" description="没有匹配的成员" class="global-empty" />
        </main>
    </div>

    <MemberFormDialog v-model="formVisible" :member="editingMember" :can-assign-role="canAssignRole"
        :can-manage-account="canManageAccountUser" @submit="submitMember" />

    <MemberHandoverDialog v-model="handoverVisible" :member="handoverMember" @done="onHandoverDone" />

    <MemberDetailDialog v-model="detailVisible" :member="selectedMember"
        :can-edit="!!selectedMember && canEdit(selectedMember)"
        :can-toggle-active="!!selectedMember && canToggleActive(selectedMember)"
        @edit="editFromDetail" @toggle-active="toggleFromDetail" />
</template>

<style scoped lang="scss">
.page {
    padding: 24px;
}

.page-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
    flex-wrap: wrap;

    .page-title {
        margin: 0 0 4px;
        font-size: 22px;
        font-weight: 600;
        color: #1f2430;
    }

    .page-subtitle {
        margin: 0;
        font-size: 13px;
        color: #9ca3af;
    }

    .page-actions {
        display: flex;
        align-items: center;
        gap: 10px;

        .search-input {
            width: 220px;
        }
    }
}

.role-lanes {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.global-empty {
    padding: 30px 0;
}

@media (max-width: 640px) {
    .page-header .page-actions {
        width: 100%;

        .search-input {
            flex: 1;
            width: auto;
        }
    }
}
</style>