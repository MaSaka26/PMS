<script setup>
import { InfoFilled } from '@element-plus/icons-vue'
</script>

<template>
    <div class="loop-note">
        <el-icon><InfoFilled /></el-icon>
        <span><slot /></span>
    </div>
</template>

<style scoped lang="scss">
.loop-note {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-top: 12px;
    padding: 10px 14px;
    font-size: 12px;
    line-height: 1.6;
    color: #475569;
    background: #f8fafc;
    border: 1px dashed #dbe3ec;
    border-radius: 10px;

    .el-icon {
        margin-top: 2px;
        color: #409eff;
    }

    b {
        color: #1f2430;
    }
}
</style>
