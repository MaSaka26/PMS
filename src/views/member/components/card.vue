<script setup>
import { computed } from 'vue'
import { Edit } from '@element-plus/icons-vue'

const props = defineProps({
    member: {
        type: Object,
        required: true,
        validator: (v) => v && typeof v.id === 'string'
    },
    canEdit: { type: Boolean, default: false }
})

const emit = defineEmits(['open', 'edit'])

const ROLE_LABEL = {
    admin: '管理员',
    pm: '项目经理',
    member: '成员'
}

const roleLabel = computed(() => ROLE_LABEL[props.member.role] || props.member.role || '成员')

const avatarInitial = computed(() => (props.member.name || '?').trim().charAt(0))

const themeClass = computed(() => {
    switch (props.member.role) {
        case 'admin': return 'theme-admin'
        case 'pm': return 'theme-pm'
        default: return 'theme-member'
    }
})
</script>

<template>
    <div class="member-card" :class="[themeClass, { 'is-inactive': member.active === false }]"
        @click="emit('open', member)">
        <span class="accent" aria-hidden="true"></span>

        <div v-if="canEdit" class="card-actions">
            <button type="button" class="action" title="编辑" @click.stop="emit('edit', member)">
                <el-icon>
                    <Edit />
                </el-icon>
            </button>
        </div>

        <div class="avatar">
            <span>{{ avatarInitial }}</span>
        </div>

        <h3 class="name" :title="member.name">{{ member.name }}</h3>
        <div class="tag-row">
            <span class="role-pill">{{ roleLabel }}</span>
            <span class="position-pill" :class="{ empty: !member.position }">
                {{ member.position || '岗位待补充' }}
            </span>
            <span v-if="member.active === false" class="inactive-tag">已停用</span>
        </div>
        <p v-if="member.email" class="email" :title="member.email">{{ member.email }}</p>
        <!-- <p v-else class="email email-empty">未设置邮箱</p> -->
    </div>
</template>

<style scoped lang="scss">
.member-card {
    --accent: #409eff;
    --accent-2: #79bbff;
    --accent-soft: rgba(64, 158, 255, 0.1);
    --accent-glow: rgba(64, 158, 255, 0.3);

    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 16px 16px 18px;
    background: #fff;
    border: 1px solid #e8eaef;
    border-radius: 14px;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04), 0 6px 16px rgba(16, 24, 40, 0.05);
    overflow: hidden;
    transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
    cursor: pointer;

    .accent {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, var(--accent), var(--accent-2));
    }

    .card-actions {
        position: absolute;
        top: 12px;
        right: 12px;
        display: flex;
        gap: 6px;
        opacity: 0;
        transform: translateY(-4px);
        transition: opacity 0.2s ease, transform 0.2s ease;

        .action {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 26px;
            height: 26px;
            padding: 0;
            font-size: 14px;
            color: #606266;
            background: #fff;
            border: 1px solid #e8eaef;
            border-radius: 8px;
            box-shadow: 0 2px 6px rgba(16, 24, 40, 0.08);
            cursor: pointer;
            transition: color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;

            &:hover {
                color: var(--accent);
                border-color: var(--accent);
                transform: translateY(-1px);
            }

            &.action-danger:hover {
                color: #f56c6c;
                border-color: #f56c6c;
            }
        }
    }

    &:hover {
        transform: translateY(-4px);
        border-color: var(--accent);
        box-shadow: 0 2px 4px rgba(16, 24, 40, 0.05), 0 12px 28px rgba(16, 24, 40, 0.12);

        .card-actions {
            opacity: 1;
            transform: none;
        }

        .avatar {
            transform: scale(1.06);
        }
    }

    .avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 64px;
        height: 64px;
        font-size: 26px;
        font-weight: 600;
        color: #fff;
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        border-radius: 50%;
        box-shadow: 0 6px 14px var(--accent-glow);
        transition: transform 0.22s ease;
    }

    .name {
        font-size: 16px;
        font-weight: 600;
        color: #1f2430;
        margin: 0;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .tag-row {
        display: flex;
        align-items: center;
        justify-content: center;
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

    .inactive-tag {
        padding: 2px 8px;
        font-size: 11px;
        color: #9ca3af;
        background: #f3f4f6;
        border-radius: 999px;
    }

    .email {
        font-size: 12px;
        color: #9ca3af;
        margin: 0;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        &.email-empty {
            color: #d1d5db;
            font-style: italic;
        }
    }
}

.member-card.is-inactive {
    opacity: 0.65;
    filter: grayscale(0.3);
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
    --accent-soft: rgba(100, 116, 139, 0.1);
    --accent-glow: rgba(100, 116, 139, 0.25);
}

@media (prefers-reduced-motion: reduce) {

    .member-card,
    .member-card * {
        transition: none !important;
    }

    .member-card:hover {
        transform: none;
    }
}
</style>
