<script setup>
import { computed } from 'vue'
import Header from './components/header.vue'
import Aside from './components/aside.vue'
import Breadcrumb from './components/Breadcrumb.vue'
import { useSystemStore } from '@/stores/system'

const systemStore = useSystemStore()
// 侧边栏收起时同步收缩 el-aside，让 el-main 铺满剩余空间
const asideWidth = computed(() => (systemStore.isCollapse ? '64px' : '200px'))
</script>

<template>
  <el-container class="layout">
    <el-header style="padding: 0;">
      <Header />
    </el-header>
    <el-container>
      <el-aside :width="asideWidth">
        <Aside />
      </el-aside>
      <el-main>
        <Breadcrumb />
        <el-scrollbar class="content">
          <RouterView></RouterView>
        </el-scrollbar>
      </el-main>
    </el-container>
  </el-container>
</template>


<style scoped lang="scss">
.layout {
  height: 100vh;
  overflow: hidden;

  // 让内部容器可以收缩，滚动只发生在 content 里
  :deep(.el-container) {
    min-height: 0;
  }

  :deep(.el-aside) {
    overflow-y: auto;
  }

  // main 变成纵向 flex：面包屑固定，content 自己滚
  :deep(.el-main) {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  :deep(.el-breadcrumb) {
    flex-shrink: 0;
  }
}

.content {
  flex: 1 1 0;
  min-height: 0;
  margin-top: 20px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  box-shadow: 0 5px 25px 5px rgba(0, 0, 0, 0.1);

  // 页面里的 min-height: 100% 仍然按可视区域计算
  :deep(.el-scrollbar__view) {
    min-height: 100%;
  }
}
</style>
