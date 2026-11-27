import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createIdempotentLoader } from '@/utils/async'
import { getMilestones as fetchMilestones, getMilestone as fetchMilestone, createMilestone as createMilestoneApi, updateMilestone as updateMilestoneApi, deleteMilestone as deleteMilestoneApi } from '@/api/milestone'

export const useMilestoneStore = defineStore('milestone', () => {
  const milestoneMap = ref({})
  const milestoneDetail = ref(null)

  const milestoneList = createIdempotentLoader(async (projectId = '') => {
    const list = await fetchMilestones(projectId ? { projectId } : {}) || []
    for (const m of list) milestoneMap.value[m.id] = m
    return list
  })

  const refreshProject = async (projectId) => {
    const list = await fetchMilestones({ projectId }) || []
    for (const m of list) milestoneMap.value[m.id] = m
    return list
  }

  const openDetail = async (id) => {
    milestoneDetail.value = await fetchMilestone(id)
    return milestoneDetail.value
  }
  const addMilestone = async (data) => {
    const m = await createMilestoneApi(data)
    milestoneMap.value[m.id] = m
    return m
  }
  const editMilestone = async (id, data) => {
    const m = await updateMilestoneApi(id, data)
    milestoneMap.value[id] = { ...milestoneMap.value[id], ...m }
    return m
  }
  const removeMilestone = async (id) => {
    await deleteMilestoneApi(id)
    delete milestoneMap.value[id]
  }
  const ofProject = (projectId) => Object.values(milestoneMap.value).filter((m) => m.projectId === projectId && !m.deletedAt)
  const nameOf = (id) => milestoneMap.value[id]?.title || ''

  return { milestoneMap, milestoneDetail, milestoneList, refreshProject, openDetail, addMilestone, editMilestone, removeMilestone, ofProject, nameOf }
})
