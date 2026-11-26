<!-- 侧边栏 -->
<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
    Folder, Tickets, Operation, Document, User,
    MessageBox, Odometer, FolderOpened, Share, Grid, Guide, Flag
} from '@element-plus/icons-vue'

import { useSystemStore } from '@/stores/system'

const systemStore = useSystemStore()
const route = useRoute()
const isCollapse = computed(() => systemStore.isCollapse)

// 详情页（/project/board/:id、/project/archive/:id）激活时，高亮所属的二级菜单
const activeMenu = computed(() => {
    const parts = route.path.split('/').filter(Boolean)
    if (['project', 'task', 'milestone'].includes(parts[0]) && parts.length >= 2) {
        return `/${parts[0]}/${parts[1]}`
    }
    return route.path
})

// 菜单和 router 里的路由一一对应；有 children 的渲染成下拉子菜单
const menus = [
    // 子项图标不用 CaretRight：那个箭头看起来像还能再展开一层
    {
        path: '/project',
        title: '项目管理',
        icon: Folder,
        children: [
            { path: '/project/board', title: '项目看板', icon: Odometer },
            { path: '/project/archive', title: '项目归档', icon: FolderOpened },
            { path: '/project/flow', title: '项目流程', icon: Share },
        ],
    },
    {
        path: '/task',
        title: '任务管理',
        icon: Tickets,
        children: [
            { path: '/task/board', title: '任务看板', icon: Grid },
            { path: '/task/flow', title: '任务流程', icon: Guide },
        ],
    },
    {
        path: '/milestone',
        title: '里程碑管理',
        icon: Flag,
        children: [
            { path: '/milestone/board', title: '里程碑看板', icon: Odometer },
        ],
    },
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
            <el-sub-menu v-if="item.children" :index="item.path">
                <template #title>
                    <el-icon>
                        <component :is="item.icon" />
                    </el-icon>
                    <span>{{ item.title }}</span>
                </template>
                <el-menu-item v-for="child in item.children" :key="child.path" :index="child.path">
                    <el-icon>
                        <component :is="child.icon" />
                    </el-icon>
                    <span>{{ child.title }}</span>
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

.llline {
    height: 8px;
    background: #ffffff;
    font-size: 10px;
}
</style>
