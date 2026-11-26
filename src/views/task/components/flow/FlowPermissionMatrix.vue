<script setup>
import { CircleCheck, CircleClose } from '@element-plus/icons-vue'
import { PERMISSIONS } from '@/constants/taskFlow'
import { ROLE } from '@/constants/user'
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
                    <tr v-for="p in PERMISSIONS" :key="p.action">
                        <td class="perm-action">{{ p.action }}</td>
                        <td v-for="key in [ROLE.ADMIN, ROLE.PM, ROLE.MEMBER, 'outsider']" :key="key">
                            <el-icon v-if="p[key]" class="yes"><CircleCheck /></el-icon>
                            <el-icon v-else class="no"><CircleClose /></el-icon>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <p class="perm-tip">
            PM 权限按项目计算：张经理只在「双十一大促」「官网改版」里是验收人，「会员体系升级」的验收人是老板。
            表中「项目成员」一列的阻塞与取消是受限的——只能操作自己负责（或自己创建）的任务。
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
