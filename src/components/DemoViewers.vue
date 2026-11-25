<script setup>
// 卡片角落的「谁正在看」头像堆叠。
// 数据来自 src/composables/useDemoViewers.js —— 纯前端随机模拟，不是真实在线状态，
// tooltip 里明写了「演示」，避免被当成已实现在线协作。
//
// 人只归属到任务（叶子）。所以一种卡片对应一种用法：
//   - 任务卡：传 task-id，显示这个任务上的访客
//   - 项目卡：传 project-id + task-ids，显示该项目所有任务访客的并集
// 项目卡之所以要把任务 id 传进来，是因为"谁在看这个项目"在语义上就等于
// "谁在这个项目的某个任务里"，项目本身不是一个可以进去的地方。
import { computed, onBeforeUnmount, onMounted, watch, watchEffect } from 'vue'
import { useMemberStore } from '@/stores/memberStore'
import { useUserStore } from '@/stores/userStore'
import {
    demoViewersEnabled,
    registerTaskSlot,
    setViewerPool,
    unregisterTaskSlot,
    viewersOfProject,
    viewersOfTask
} from '@/composables/useDemoViewers'

const props = defineProps({
    // 任务卡：只看这一个任务
    taskId: { type: String, default: '' },
    // 任务所属项目，汇总时用来归组
    projectId: { type: String, default: '' },
    // 项目卡：它下面有哪些任务（汇总用）
    taskIds: { type: Array, default: () => [] }
})

const memberStore = useMemberStore()
const userStore = useUserStore()

// 候选人池由组件在挂载后同步进去（成员列表是异步拉的，成员变化也要跟着更新）
watchEffect(() => {
    setViewerPool(memberStore.memberList, userStore.userInfo?.id)
})

// 需要登记的格子：任务卡是单个，项目卡是它名下所有任务
const slots = computed(() => {
    if (props.taskId) return [{ taskId: props.taskId, projectId: props.projectId }]
    return props.taskIds.map((id) => ({ taskId: id, projectId: props.projectId }))
})

const viewers = computed(() => {
    if (props.taskId) return viewersOfTask(props.taskId)
    return viewersOfProject(props.projectId)
})

// 同一批格子成对地注册 / 注销，避免项目卡刷新列表后旧格子一直占着人
let attached = []
const attach = (list) => {
    attached = list.filter((s) => s.taskId)
    for (const slot of attached) registerTaskSlot(slot.taskId, slot.projectId)
}
const detach = () => {
    for (const slot of attached) unregisterTaskSlot(slot.taskId)
    attached = []
}

onMounted(() => attach(slots.value))
onBeforeUnmount(detach)
watch(
    () => slots.value.map((s) => s.taskId).join(','),
    () => {
        detach()
        attach(slots.value)
    }
)

// 最多显示 3 个，多出来的折成 +N
const MAX_SHOWN = 3
const shown = computed(() => viewers.value.slice(0, MAX_SHOWN))
const overflow = computed(() => Math.max(0, viewers.value.length - MAX_SHOWN))

const names = computed(() => viewers.value.map((v) => v.name).join('、'))
const tipText = computed(() =>
    names.value ? `${names.value} 正在查看（演示数据，非真实在线状态）` : ''
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
