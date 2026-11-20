// Header.vue
<script setup>
import { ref, computed } from 'vue'
import { useUserStore } from '@/stores/userStore'
import { useSystemStore } from '@/stores/system'
import { ElementPlus, Expand, Fold, UserFilled } from '@element-plus/icons-vue'

const userStore = useUserStore()
const systemStore = useSystemStore()
const isCollapse = computed(() => {
    return systemStore.isCollapse
})

const title = ref('项目管理系统')
const username = computed(() => {
    // 刷新后 userInfo 可能还是 null（正在异步恢复），用可选链兜底
    const name = userStore.userInfo?.name
    if (!name) return '加载中…'
    // admin 角色给个专属显示，其他人直接显示名字
    if (userStore.userInfo?.role === 'admin') return `${name}（管理员）`
    return name
})
</script>

<template>
    <div class="header">
        <div class="left">
            <div class="title"><el-icon class="icon"><ElementPlus/></el-icon>{{ title }}</div>
            <div @click="systemStore.toggleCollapse" class="collapse">
                <el-icon v-if="!isCollapse">
                    <Fold />
                </el-icon>
                <el-icon v-else>
                    <Expand />
                </el-icon>
            </div>
        </div>
        <div class="user-info">
            <el-avatar :size="32" :icon="UserFilled" class="avatar" />
            <el-popconfirm
                title="确定要退出登录吗？"
                confirm-button-text="退出"
                cancel-button-text="取消"
                @confirm="userStore.logoutUser"
            >
                <template #reference>
                    <span class="username">{{ username }}</span>
                </template>
            </el-popconfirm>
        </div>
    </div>
</template>

<style scoped lang="scss">
.header {
    height: 60px;
    line-height: 60px;
    text-align: center;
    font-size: 20px;
    font-weight: bold;
    color: #fff;
    background: var(--primary-color);
    display: flex;
    padding: 0 20px;
    justify-content: space-between;
    align-items: center;

    .left {
        .title{
            font-size: 24px;
            display: flex;
            align-items: center;
            gap: 5px;
            .icon {
                font-size: 36px;
            }
        }
        display: flex;
        align-items: center;
        gap: 10px;

        .collapse {
            height: 60px;
            width: 60px;
            display: flex;
            align-items: center;
            justify-content: center;
                cursor: pointer;

            &:hover {
                opacity: 0.8;
                background: #71b3ff;
            }
        }
    }

    .user-info {
        display: flex;
        align-items: center;
        gap: 8px;

        .avatar {
            background: #fff;
            color: var(--primary-color);
            flex-shrink: 0;
        }

        .username {
            font-size: 16px;
            font-weight: normal;
            cursor: pointer;

            &:hover {
                opacity: 0.8;
            }
        }
    }
}
</style>
