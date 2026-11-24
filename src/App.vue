<script setup>
import { onMounted } from 'vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { useMemberStore } from '@/stores/memberStore'

// 中文语言包在这里下发：main.js 改为按需注册 Element Plus 后不再有
// app.use(ElementPlus, { locale: zhCn })，改用 <el-config-provider> 包一层，
// 日期选择器、分页等组件的文案才会是中文。
onMounted(() => {
    useMemberStore().initMembers().catch(() => {
        // 静默失败：成员数据仅用于下拉/展示，不阻塞页面
    })
})
</script>

<template>
  <el-config-provider :locale="zhCn">
    <router-view />
  </el-config-provider>
</template>
