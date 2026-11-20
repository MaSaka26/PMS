<script setup>
import { computed } from 'vue'
import { ArrowDown, ArrowUp, Plus } from '@element-plus/icons-vue'
import { PRIORITY_ORDER } from '@/constants/status'

const props = defineProps({
    modelValue: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue'])

const tasks = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

const newKey = () => `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

const addTask = () => {
    tasks.value = [
        ...tasks.value,
        {
            key: newKey(),
            title: '',
            description: '',
            priority: '中',
            startOffset: 0,
            duration: 1,
            dependsOn: []
        }
    ]
}

const removeTask = (index) => {
    const removed = tasks.value[index]
    tasks.value = tasks.value
        .filter((_, i) => i !== index)
        .map((t) => ({
            ...t,
            dependsOn: (t.dependsOn || []).filter((key) => key !== removed.key)
        }))
}

const moveTask = (index, direction) => {
    const target = index + direction
    if (target < 0 || target >= tasks.value.length) return
    const next = [...tasks.value]
    ;[next[index], next[target]] = [next[target], next[index]]
    tasks.value = next
}

// 前置任务只能选其它任务
const depOptions = (task) =>
    tasks.value.filter((t) => t.key !== task.key)
</script>

<template>
    <div class="task-editor">
        <div v-for="(task, index) in tasks" :key="task.key" class="task-item">
            <div class="task-head">
                <span class="task-index">任务 {{ index + 1 }}</span>
                <div class="task-tools">
                    <el-button link size="small" :icon="ArrowUp" :disabled="index === 0" aria-label="上移"
                        @click="moveTask(index, -1)" />
                    <el-button link size="small" :icon="ArrowDown" :disabled="index === tasks.length - 1"
                        aria-label="下移" @click="moveTask(index, 1)" />
                    <el-button link type="danger" size="small" @click="removeTask(index)">删除</el-button>
                </div>
            </div>

            <div class="task-grid">
                <label class="cell wide">
                    <span>标题</span>
                    <el-input v-model="task.title" placeholder="任务标题" maxlength="60" />
                </label>
                <label class="cell narrow">
                    <span>优先级</span>
                    <el-select v-model="task.priority">
                        <el-option v-for="p in PRIORITY_ORDER" :key="p" :label="p" :value="p" />
                    </el-select>
                </label>
                <label class="cell narrow">
                    <span>开始（T+N）</span>
                    <el-input-number v-model="task.startOffset" :min="0" :controls="false" />
                </label>
                <label class="cell narrow">
                    <span>工期（天）</span>
                    <el-input-number v-model="task.duration" :min="1" :controls="false" />
                </label>
                <label class="cell full">
                    <span>前置任务</span>
                    <el-select v-model="task.dependsOn" multiple clearable placeholder="可选，模板内任务">
                        <el-option v-for="opt in depOptions(task)" :key="opt.key"
                            :label="opt.title || '未命名任务'" :value="opt.key" />
                    </el-select>
                </label>
                <label class="cell full">
                    <span>描述</span>
                    <el-input v-model="task.description" placeholder="选填" maxlength="120" />
                </label>
            </div>
        </div>

        <el-button class="add-task" plain :icon="Plus" @click="addTask">添加任务</el-button>
    </div>
</template>

<style scoped lang="scss">
.task-editor {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.task-item {
    padding: 10px 12px;
    background: #f8fafc;
    border: 1px solid #eef2f7;
    border-radius: 10px;
}

.task-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;

    .task-index {
        font-size: 12px;
        font-weight: 600;
        color: #6b7280;
    }
}

.task-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 8px;

    .cell {
        display: flex;
        flex-direction: column;
        gap: 4px;
        grid-column: span 2;

        span {
            font-size: 11px;
            color: #9ca3af;
        }

        &.narrow {
            grid-column: span 1;
        }

        &.wide {
            grid-column: span 3;
        }

        &.full {
            grid-column: span 6;
        }
    }
}

.add-task {
    align-self: flex-start;
}

@media (max-width: 640px) {
    .task-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));

        .cell,
        .cell.narrow,
        .cell.wide,
        .cell.full {
            grid-column: span 1;
        }

        .cell.full {
            grid-column: span 2;
        }
    }
}
</style>
