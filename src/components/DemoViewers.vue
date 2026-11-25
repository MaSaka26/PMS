<script setup>
// 卡片角落的「谁正在看」头像堆叠。
// 数据来自 src/composables/useDemoViewers.js —— 纯前端随机模拟，不是真实在线状态，
// tooltip 里明写了「演示」，避免被当成已实现在线协作。
import { computed, onBeforeUnmount, onMounted, watch, watchEffect } from 'vue'
import { useMemberStore } from '@/stores/memberStore'
import { useUserStore } from '@/stores/userStore'
import {
    demoViewersEnabled,
    registerViewer,
    setViewerPool,
    unregisterViewer,
    viewersOf
} from '@/composables/useDemoViewers'

const props = defineProps({
    // 实体键，形如 project:project_seed_1 / task:task_seed_7
    entityKey: { type: String, default: '' }
})

const memberStore = useMemberStore()
const userStore = useUserStore()

// 候选人池由组件在挂载后同步进去（成员列表是异步拉的，成员变化也要跟着更新）
watchEffect(() => {
    setViewerPool(memberStore.memberList, userStore.userInfo?.id)
})

const viewers = computed(() => viewersOf(props.entityKey))

// 最多显示 3 个，多出来的折成 +N
const MAX_SHOWN = 3
const shown = computed(() => viewers.value.slice(0, MAX_SHOWN))
const overflow = computed(() => Math.max(0, viewers.value.length - MAX_SHOWN))

const names = computed(() => viewers.value.map((v) => v.name).join('、'))
const tipText = computed(() =>
    names.value ? `${names.value} 正在查看（演示数据，非真实在线状态）` : ''
)

const attach = (key) => {
    if (key) registerViewer(key)
}
const detach = (key) => {
    if (key) unregisterViewer(key)
}

onMounted(() => attach(props.entityKey))
onBeforeUnmount(() => detach(props.entityKey))
watch(
    () => props.entityKey,
    (next, prev) => {
        detach(prev)
        attach(next)
    }
)
</script>

<template>
    <span v-if="demoViewersEnabled && viewers.length" class="demo-viewers" @click.stop>
        <el-tooltip :content="tipText" placement="top" :show-after="200">
            <span class="stack">
                <span v-for="person in shown" :key="person.id" class="avatar" :style="{ background: person.color }">{{
                    person.initial }}</span>
                <span v-if="overflow" class="avatar more">+{{ overflow }}</span>
            </span>
        </el-tooltip>
    </span>
</template>

<style scoped lang="scss">
.demo-viewers {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    // 和左边的负责人 / 待认领用一条细线隔开，避免小头像被误读成"又指派了谁"
    padding-left: 6px;
    border-left: 1px solid #eef0f4;
}

.stack {
    display: inline-flex;
    align-items: center;
    // 头像之间靠 margin-left 轻微重叠，读起来像「一群人」，又不至于挤成一片
    cursor: default;

    .avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        margin-left: -5px;
        font-size: 10px;
        font-weight: 600;
        color: #fff;
        border-radius: 50%;
        box-shadow: 0 0 0 1.5px #fff;
        transition: transform 0.15s ease;

        &:first-child {
            margin-left: 0;
        }

        &.more {
            color: #4b5563;
            background: #e5e7eb;
        }
    }
}

.demo-viewers:hover .avatar {
    transform: translateY(-1px);
}

@media (prefers-reduced-motion: reduce) {
    .stack .avatar {
        transition: none;
    }

    .demo-viewers:hover .avatar {
        transform: none;
    }
}
</style>
