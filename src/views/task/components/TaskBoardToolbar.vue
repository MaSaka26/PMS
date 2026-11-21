<script setup>
import { computed } from 'vue'
import { Plus, QuestionFilled, Search } from '@element-plus/icons-vue'

const props = defineProps({
    keyword: { type: String, default: '' },
    assignee: { type: String, default: 'all' },
    onlyBlocked: { type: Boolean, default: false },
    members: { type: Array, default: () => [] },
    canCreate: { type: Boolean, default: false },
    createDisabled: { type: Boolean, default: false }
})
const emit = defineEmits(['update:keyword', 'update:assignee', 'update:onlyBlocked', 'create'])

const keywordValue = computed({
    get: () => props.keyword,
    set: (value) => emit('update:keyword', value)
})
const assigneeValue = computed({
    get: () => props.assignee,
    set: (value) => emit('update:assignee', value)
})
const onlyBlockedValue = computed({
    get: () => props.onlyBlocked,
    set: (value) => emit('update:onlyBlocked', value)
})
</script>

<template>
    <div class="page-actions">
        <el-input v-model="keywordValue" placeholder="搜索任务标题" clearable size="small" style="width: 180px">
            <template #prefix>
                <el-icon><Search /></el-icon>
            </template>
        </el-input>
        <el-select v-model="assigneeValue" size="small" style="width: 170px">
            <el-option label="全部负责人" value="all" />
            <el-option label="待认领" value="unassigned" />
            <el-option v-for="m in members" :key="m.id"
                :label="m.active === false ? `${m.name}（已停用）` : m.name" :value="m.id" />
        </el-select>
        <el-radio-group v-model="onlyBlockedValue" size="small">
            <el-radio-button :value="false">全部</el-radio-button>
            <el-radio-button :value="true">仅看阻塞</el-radio-button>
        </el-radio-group>
        <el-popover placement="bottom-end" :width="340" trigger="click">
            <template #reference>
                <el-button text size="small" class="help-btn">
                    <el-icon><QuestionFilled /></el-icon>阻塞 / 取消 / 删除区别
                </el-button>
            </template>
            <div class="help-list">
                <p>
                    <b>阻塞</b>：任务仍留在当前泳道，只标注“暂时推进不了”，不改变状态；
                    问题解决后点「解除阻塞」继续。
                </p>
                <p>
                    <b>取消任务</b>：这件事不做了，任务进入「已取消」区，不计入完成率，
                    之后可以恢复。
                </p>
                <p>
                    <b>删除</b>：把任务从看板移除，只用于误建或重复数据，删除后不可恢复。
                </p>
            </div>
        </el-popover>
        <el-button v-if="canCreate" type="primary" :disabled="createDisabled" @click="emit('create')">
            <el-icon style="margin-right: 4px"><Plus /></el-icon>新建任务
        </el-button>
    </div>
</template>

<style scoped lang="scss">
.page-actions {
    display: flex;
    align-items: center;
    gap: 12px;
}

.help-btn {
    color: #6b7280;

    .el-icon {
        margin-right: 3px;
    }
}

.help-list {
    p {
        margin: 0 0 8px;
        font-size: 12px;
        line-height: 1.7;
        color: #4b5563;

        &:last-child {
            margin-bottom: 0;
        }
    }

    b {
        color: #1f2430;
    }
}

@media (max-width: 720px) {
    .page-actions {
        flex-wrap: wrap;
    }
}
</style>
