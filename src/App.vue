<script setup>
import { onMounted } from 'vue'
import { useMemberStore } from '@/stores/memberStore'

// 进入系统即预加载成员列表（幂等：全局只发一次请求）
onMounted(() => {
    useMemberStore().initMembers().catch(() => {
        // 静默失败：成员数据仅用于下拉/展示，不阻塞页面
    })
})
</script>

<template>
  <router-view />
</template>
