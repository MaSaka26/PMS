import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSystemStore = defineStore('system', ()=>{
    //  系统状态管理
    const isCollapse = ref(false)
    //  切换侧边栏状态
    const toggleCollapse = () => {
        isCollapse.value = !isCollapse.value
    }
    return {
        isCollapse,
        toggleCollapse,
    }
})
