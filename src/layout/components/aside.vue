<!-- 侧边栏 -->
<script setup>
import { computed } from 'vue'
import { useTaskStore } from '@/stores/taskStore'

import { useRoute } from 'vue-router'
import {
    Folder, Tickets, Operation, Document, User,
    MessageBox, Location, Odometer
} from '@element-plus/icons-vue'

import { useSystemStore } from '@/stores/system'

const systemStore = useSystemStore()
const taskStore = useTaskStore()
const mineCount = computed(() => taskStore.myPendingCount)
const route = useRoute()
const isCollapse = computed(() => systemStore.isCollapse)

// 看板类一级菜单统一高亮到 /xxx/board；项目详情归到项目看板
const activeMenu = computed(() => {
    const parts = route.path.split('/').filter(Boolean)
    if (parts[0] === 'project' && parts.length >= 2 && parts[1] !== 'board') {
        return '/project/board'
    }
    return route.path
})

// 菜单和 router 里的路由一一对应，全部为一级直达项
const menus = [
    // 一级菜单直接进看板，不再展开二级下拉
    { path: '/project/board', title: '项目管理', icon: Folder },
    { path: '/milestone/board', title: '里程碑管理', icon: Location },
    { path: '/task/board', title: '任务管理', icon: Odometer },
    { path: '/mine', title: '我的任务', icon: MessageBox },
    { path: '/field', title: '字段配置', icon: Operation },
    { path: '/template', title: '项目模板', icon: Document },
    { path: '/member', title: '成员管理', icon: User },
]
</script>

<template>
    <!-- router 属性：点击菜单自动跳转到 index 对应的路径 -->
    <el-menu class="aside-menu" :default-active="activeMenu" :collapse="isCollapse" router>
        <template v-for="item in menus" :key="item.path">
            <el-menu-item :index="item.path">
                <el-icon>
                    <component :is="item.icon" />
                </el-icon>
                <template #title>
                    <span class="mine-menu-title">
                        <span>{{ item.title }}</span>
                        <span v-if="item.path === '/mine' && mineCount" class="mine-menu-count">{{ mineCount > 99 ? '99+' : mineCount }}</span>
                    </span>
                </template>
            </el-menu-item>
        </template>
    </el-menu>
</template>

<style scoped>
.aside-menu {
    height: 100%;
    border-right: none;
}

.mine-menu-title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}
.mine-menu-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    font-size: 12px;
    line-height: 1;
    color: #fff;
    background: #f56c6c;
    border-radius: 9px;
}

.llline {
    height: 8px;
    background: #ffffff;
    font-size: 10px;
}
</style>
