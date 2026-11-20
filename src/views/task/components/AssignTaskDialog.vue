<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    task: { type: Object, default: null },
    // 当前项目的成员列表
    members: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue', 'confirm'])

const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

const selected = ref('')

watch(
    () => [props.modelValue, props.task],
    ([open]) => {
        if (!open) return
        selected.value = ''
    }
)

const handleConfirm = () => {
    if (!selected.value) {
        ElMessage.warning('请选择要指派的成员')
        return
    }
    // 交给父组件处理：父组件确认成功后再关闭弹窗
    emit('confirm', selected.value)
}

const close = () => {
    visible.value = false
}
</script>

<template>
    <el-dialog v-model="visible" title="指派任务" width="420px" destroy-on-close>
        <p class="task-title">{{ task?.title }}</p>
        <el-select v-model="selected" filterable placeholder="选择项目成员" style="width: 100%">
            <el-option v-for="m in members" :key="m.id" :label="m.active === false ? `${m.name}（已停用）` : m.name"
                :value="m.id" :disabled="m.active === false" />
        </el-select>
        <p class="hint">指派后任务直接进入「进行中」，视为已开工。</p>
        <template #footer>
            <el-button @click="close">取消</el-button>
            <el-button type="primary" @click="handleConfirm">确认指派</el-button>
        </template>
    </el-dialog>
</template>

<style scoped lang="scss">
.task-title {
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: 600;
    color: #1f2430;
}

.hint {
    margin: 8px 0 0;
    font-size: 12px;
    color: #9ca3af;
}
</style>
