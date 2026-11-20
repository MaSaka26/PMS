import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
    getMemberList as fetchMemberList,
    createMember as createMemberApi,
    updateMember as updateMemberApi,
    deleteMember as deleteMemberApi
} from '@/api/member'

export const useMemberStore = defineStore('member', () => {
    const memberList = ref([])

    // 幂等初始化锁：确保全局只发一次拉取请求
    let initPromise = null
    const isInitialized = ref(false)

    const initMembers = () => {
        if (isInitialized.value) return Promise.resolve(memberList.value)
        if (initPromise) return initPromise

        initPromise = fetchMemberList()
            .then((list) => {
                memberList.value = list || []
                isInitialized.value = true
                return memberList.value
            })
            .finally(() => {
                initPromise = null
            })

        return initPromise
    }

    // 强制全量刷新（成员管理页增删改后可调用）
    const refreshMembers = async () => {
        memberList.value = await fetchMemberList() || []
        isInitialized.value = true
        return memberList.value
    }

    // id -> 姓名（项目卡片、下拉都用）
    const memberName = (id) =>
        memberList.value.find((m) => m.id === id)?.name || id

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
        return updated
    }

    // 删除
    const removeMember = async (id) => {
        await deleteMemberApi(id)
        memberList.value = memberList.value.filter((m) => m.id !== id)
    }

    return {
        memberList,
        isInitialized,
        initMembers,
        refreshMembers,
        memberName,
        addMember,
        editMember,
        removeMember
    }
})
