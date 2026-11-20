<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowRight } from '@element-plus/icons-vue'

const route = useRoute()

// 从 $route.matched 里提取有 title 的层级，自动生成面包屑数组
const breadcrumbs = computed(() => {
  return route.matched
    .filter(r => r.meta.title && r.name)   // 过滤没 title 或没 name 的
    .map(r => ({
      title: r.meta.title,
      name: r.name
    }))
})
</script>

<template>
  <el-breadcrumb :separator-icon="ArrowRight">
    <!-- 最后一个（当前页）不可点击，其余可跳转 -->
    <el-breadcrumb-item
      v-for="(item, idx) in breadcrumbs"
      :key="item.name"
      :to="idx < breadcrumbs.length - 1 ? { name: item.name } : undefined"
    >
      {{ item.title }}
    </el-breadcrumb-item>
  </el-breadcrumb>
</template>

