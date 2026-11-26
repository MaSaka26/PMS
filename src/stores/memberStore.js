import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createIdempotentLoader } from '@/utils/async'
import {
    getMemberList as fetchMemberList,
    createMember as createMemberApi,
    updateMember as updateMemberApi,
    deleteMember as deleteMemberApi
} from '@/api/member'
import { useUserStore } from '@/stores/userStore'

export const useMemberStore = defineStore('member', () => {
    const memberList = ref([])
    const userStore = useUserStore()

    // 幂等初始化锁：确保全局只发一次拉取请求
    // 并发调用共享一次拉取；完成后释放，允许后续显式刷新
    const initMembers = createIdempotentLoader(async () => {
        memberList.value = (await fetchMemberList()) || []
        return memberList.value
    })

    // 强制全量刷新（成员管理页增删改后可调用）
    const refreshMembers = async () => {
        memberList.value = (await fetchMemberList()) || []
        return memberList.value
    }

    // id -> 姓名（项目卡片、下拉都用）
    const memberName = (id) => {
        if (!id) return '未指定'
        return memberList.value.find((m) => m.id === id)?.name || '已删除成员'
    }

    // 新增：乐观更新
    const addMember = async (data) => {
        const member = await createMemberApi(data)
        memberList.value.push(member)
        return member
    }

    // 编辑：乐观更新
    const editMember = async (id, data) => {
        const updated = await updateMemberApi(id, data)
        const idx = memberList.value.findIndex((m) => m.id === id)
        if (idx !== -1) memberList.value[idx] = updated
        // 改的是自己：立即刷新当前用户，角色 / 停用状态马上生效
        if (userStore.userInfo?.id === id) {
            await userStore.restoreUserInfo()
        }
        return updated
    }

    // 删除
    const removeMember = async (id) => {
        await deleteMemberApi(id)
        memberList.value = memberList.value.filter((m) => m.id !== id)
        if (userStore.userInfo?.id === id) {
            await userStore.restoreUserInfo()
        }
    }

    return {
        memberList,
        initMembers,
        refreshMembers,
        memberName,
        addMember,
        editMember,
        removeMember
    }
})