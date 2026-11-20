<!-- 侧边栏 -->
<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Folder, List, Setting, Document, User } from '@element-plus/icons-vue'

import { useSystemStore } from '@/stores/system'

const systemStore = useSystemStore()
const route = useRoute()
const isCollapse = computed(() => systemStore.isCollapse)

// 详情页（/project/board/:id、/project/archive/:id）激活时，高亮所属的二级菜单
const activeMenu = computed(() => {
    const parts = route.path.split('/').filter(Boolean)
    if ((parts[0] === 'project' || parts[0] === 'task') && parts.length >= 2) {
        return `/${parts[0]}/${parts[1]}`
    }
    return route.path
})

// 菜单和 router 里的路由一一对应；有 children 的渲染成下拉子菜单
const menus = [
    {
        path: '/project',
        title: '项目管理',
        icon: Folder,
        children: [
            { path: '/project/board', title: '项目看板' },
            { path: '/project/archive', title: '项目归档' },
        ],
    },
    {
        path: '/task',
        title: '任务规划',
        icon: List,
        children: [
            { path: '/task/board', title: '任务看板' },
            { path: '/task/flow', title: '任务流程' },
        ],
    },
    { path: '/field', title: '字段配置', icon: Setting },
    { path: '/template', title: '项目模板', icon: Document },
    { path: '/member', title: '成员管理', icon: User },
]
</script>

<template>
    <!-- router 属性：点击菜单自动跳转到 index 对应的路径 -->
    <el-menu class="aside-menu" :default-active="activeMenu" :collapse="isCollapse" router unique-opened>
        <template v-for="item in menus" :key="item.path">
            <el-sub-menu v-if="item.children" :index="item.path">
                <template #title>
                    <el-icon>
                        <component :is="item.icon" />
                    </el-icon>
                    <span>{{ item.title }}</span>
                </template>
                <el-menu-item v-for="child in item.children" :key="child.path" :index="child.path">
                    {{ child.title }}
                </el-menu-item>
            </el-sub-menu>
            <el-menu-item v-else :index="item.path">
                <el-icon>
                    <component :is="item.icon" />
                </el-icon>
                <template #title>{{ item.title }}</template>
            </el-menu-item>
        </template>
    </el-menu>
</template>

<style scoped>
.aside-menu {
    height: 100%;
    border-right: none;
}
</style>
