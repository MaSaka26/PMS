<script setup>
import { computed } from 'vue'

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    member: { type: Object, default: null },
    canEdit: { type: Boolean, default: false },
    canToggleActive: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue', 'edit', 'toggle-active'])

const visible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

const ROLE_LABEL = {
    admin: '管理员',
    pm: '项目经理',
    member: '成员'
}

const roleLabel = computed(() => ROLE_LABEL[props.member?.role] || props.member?.role || '成员')
const initial = computed(() => (props.member?.name || '?').trim().charAt(0))
const themeClass = computed(() => {
    switch (props.member?.role) {
        case 'admin': return 'theme-admin'
        case 'pm': return 'theme-pm'
        default: return 'theme-member'
    }
})

const handleEdit = () => {
    visible.value = false
    emit('edit', props.member)
}

const handleToggleActive = () => {
    visible.value = false
    emit('toggle-active', props.member)
}
</script>

<template>
    <el-dialog v-model="visible" title="成员信息" width="440px">
        <div v-if="member" class="member-detail" :class="themeClass">
            <div class="detail-head">
                <div class="avatar">{{ initial }}</div>
                <div class="head-text">
                    <h3>{{ member.name }}</h3>
                    <div class="tag-row">
                        <span class="role-pill">{{ roleLabel }}</span>
                        <span class="position-pill" :class="{ empty: !member.position }">
                            {{ member.position || '岗位待补充' }}
                        </span>
                        <span v-if="member.active === false" class="inactive-pill">已停用</span>
                    </div>
                </div>
            </div>

            <dl class="info-list">
                <div>
                    <dt>姓名</dt>
                    <dd>{{ member.name }}</dd>
                </div>
                <div>
                    <dt>角色</dt>
                    <dd>{{ roleLabel }}</dd>
                </div>
                <div>
                    <dt>岗位</dt>
                    <dd :class="{ muted: !member.position }">{{ member.position || '待补充' }}</dd>
                </div>
                <div>
                    <dt>邮箱</dt>
                    <dd :class="{ muted: !member.email }">{{ member.email || '未设置' }}</dd>
                </div>
                <div>
                    <dt>状态</dt>
                    <dd :class="{ muted: member.active === false }">
                        {{ member.active === false ? '已停用' : '启用中' }}
                    </dd>
                </div>
                <div>
                    <dt>登录账号</dt>
                    <dd :class="{ muted: !member.username }">{{ member.username || '未开通' }}</dd>
                </div>
                <div>
                    <dt>成员编号</dt>
                    <dd class="mono">{{ member.id }}</dd>
                </div>
            </dl>
        </div>

        <template #footer>
            <el-button @click="visible = false">关闭</el-button>
            <el-button v-if="canToggleActive" :type="member.active === false ? 'success' : 'warning'" plain
                @click="handleToggleActive">
                {{ member.active === false ? '启用' : '停用' }}
            </el-button>
            <el-button v-if="canEdit" type="primary" @click="handleEdit">编辑</el-button>
        </template>
    </el-dialog>
</template>

<style scoped lang="scss">
.member-detail {
    --accent: #409eff;
    --accent-2: #79bbff;
    --accent-soft: rgba(64, 158, 255, 0.1);
    --accent-glow: rgba(64, 158, 255, 0.3);

    .detail-head {
        display: flex;
        align-items: center;
        gap: 16px;
        padding-bottom: 16px;
        border-bottom: 1px dashed #eceff4;
    }

    .avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 56px;
        height: 56px;
        flex-shrink: 0;
        font-size: 22px;
        font-weight: 600;
        color: #fff;
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        border-radius: 50%;
        box-shadow: 0 6px 14px var(--accent-glow);
    }

    .head-text h3 {
        margin: 0 0 8px;
        font-size: 17px;
        color: #1f2430;
    }

    .tag-row {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
    }

    .role-pill {
        padding: 2px 10px;
        font-size: 12px;
        color: var(--accent);
        background: var(--accent-soft);
        border-radius: 999px;
    }

    .position-pill {
        padding: 2px 10px;
        font-size: 12px;
        color: #64748b;
        background: #f1f5f9;
        border-radius: 999px;

        &.empty {
            color: #b0b7c3;
            background: #f8fafc;
            border: 1px dashed #e2e8f0;
        }
    }

    .inactive-pill {
        padding: 2px 10px;
        font-size: 12px;
        color: #9ca3af;
        background: #f3f4f6;
        border-radius: 999px;
    }
}

.info-list {
    margin: 14px 0 0;
    display: flex;
    flex-direction: column;
    gap: 12px;

    >div {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 16px;
        font-size: 13px;
    }

    dt {
        flex-shrink: 0;
        width: 72px;
        color: #9ca3af;
    }

    dd {
        margin: 0;
        color: #1f2430;
        text-align: right;
        word-break: break-word;

        &.muted {
            color: #9ca3af;
            font-style: italic;
        }

        &.mono {
            font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            font-size: 12px;
            color: #6b7280;
        }
    }
}

.theme-admin {
    --accent: #f43f5e;
    --accent-2: #fb7185;
    --accent-soft: rgba(244, 63, 94, 0.1);
    --accent-glow: rgba(244, 63, 94, 0.35);
}

.theme-pm {
    --accent: #409eff;
    --accent-2: #79bbff;
    --accent-soft: rgba(64, 158, 255, 0.1);
    --accent-glow: rgba(64, 158, 255, 0.35);
}

.theme-member {
    --accent: #37c76e;
    --accent-2: #73dd6f;
    --accent-soft: rgba(55, 199, 110, 0.1);
    --accent-glow: rgba(55, 199, 110, 0.25);
}
</style>
