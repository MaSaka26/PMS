<script setup>
import { CircleCheck, CircleClose } from '@element-plus/icons-vue'
import { PROJECT_PERMISSIONS } from '@/constants/projectFlow'
</script>

<template>
    <div>
        <div class="perm-wrap">
            <table class="perm-table">
                <thead>
                    <tr>
                        <th>动作</th>
                        <th>admin</th>
                        <th>PM（本项目）</th>
                        <th>项目成员</th>
                        <th>非成员</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="p in PROJECT_PERMISSIONS" :key="p.action">
                        <td class="perm-action">{{ p.action }}</td>
                        <td v-for="key in ['admin', 'pm', 'member', 'outsider']" :key="key">
                            <el-icon v-if="p[key]" class="yes"><CircleCheck /></el-icon>
                            <el-icon v-else class="no"><CircleClose /></el-icon>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <p class="perm-tip">
            PM 权限按项目计算：同一名成员只在本人负责的项目里拥有管理权。
            「项目成员」可以查看项目、认领与推进任务，但不能改名、关闭或归档项目。
        </p>
    </div>
</template>

<style scoped lang="scss">
.perm-wrap {
    overflow-x: auto;
    background: #fff;
    border: 1px solid #e8eaef;
    border-radius: 12px;
}

.perm-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;

    th,
    td {
        padding: 11px 14px;
        text-align: center;
        border-bottom: 1px solid #f0f2f5;
        white-space: nowrap;
    }

    th {
        font-size: 12px;
        font-weight: 600;
        color: #6b7280;
        background: #f8fafc;
    }

    tbody tr:last-child td {
        border-bottom: none;
    }

    .perm-action {
        text-align: left;
        font-weight: 500;
        color: #1f2430;
    }

    .yes {
        font-size: 16px;
        color: #67c23a;
    }

    .no {
        font-size: 16px;
        color: #dcdfe6;
    }
}

.perm-tip {
    margin: 10px 2px 0;
    font-size: 12px;
    color: #9ca3af;
}
</style>
