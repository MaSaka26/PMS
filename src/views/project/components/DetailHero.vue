<script setup>
import { computed } from 'vue'
import { ArrowLeft, Collection, Edit, Pointer, RefreshLeft, SwitchButton } from '@element-plus/icons-vue'

const props = defineProps({
    project: { type: Object, required: true },
    isArchived: { type: Boolean, default: false },
    canManage: { type: Boolean, default: false },
    statusText: { type: String, default: '' },
    projectIcon: { type: String, default: 'Folder' },
    priorityClass: { type: String, default: 'is-medium' },
    pmName: { type: String, default: '' },
    backLabel: { type: String, default: '返回' }
})
defineEmits(['back', 'edit', 'board', 'save-template', 'close', 'reopen'])

// 与项目看板卡片的状态配色保持一致（card.vue 的 is-* 变量）
const STATUS_THEMES = {
    draft: { color: '#909399', soft: 'rgba(144, 147, 153, 0.12)' },
    planning: { color: '#409eff', soft: 'rgba(64, 158, 255, 0.12)' },
    active: { color: '#10b981', soft: 'rgba(16, 185, 129, 0.14)' },
    accepting: { color: '#e6a23c', soft: 'rgba(230, 162, 60, 0.15)' },
    iterating: { color: '#8b5cf6', soft: 'rgba(139, 92, 246, 0.13)' },
    archived: { color: '#94a3b8', soft: 'rgba(148, 163, 184, 0.16)' }
}

const statusTheme = computed(
    () => STATUS_THEMES[props.isArchived ? 'archived' : props.project?.status] || STATUS_THEMES.draft
)
</script>

<template>
    <header class="hero" :class="priorityClass">
        <div class="hero-main">
            <button type="button" class="back-btn" :title="backLabel" @click="$emit('back')">
                <el-icon><ArrowLeft /></el-icon>
            </button>
            <div class="hero-icon">
                <el-icon>
                    <component :is="projectIcon" />
                </el-icon>
            </div>
            <div class="hero-text">
                <div class="title-row">
                    <h1>{{ project.title }}</h1>
                    <span class="type-chip">{{ project.type }}</span>
                    <span class="status-pill" :class="{ archived: isArchived }"
                        :style="{ color: statusTheme.color, background: statusTheme.soft }">
                        <span class="dot" aria-hidden="true"></span>{{ statusText }}
                    </span>
                </div>
                <p class="meta">
                    负责人：{{ pmName }} ·
                    {{ (project.members || []).length }} 位成员 ·
                    创建于 {{ project.createdAt }}
                    <template v-if="isArchived && project.closedAt">
                        · 关闭于 {{ new Date(project.closedAt).toLocaleDateString() }}
                    </template>
                </p>
            </div>
        </div>
        <div class="hero-actions">
            <el-button v-if="!isArchived && canManage" :icon="Edit" @click="$emit('edit')">
                编辑项目
            </el-button>
            <el-button v-if="!isArchived" :icon="Pointer" @click="$emit('board')">打开任务看板</el-button>
            <el-button v-if="canManage" :icon="Collection" @click="$emit('save-template')">
                另存为模板
            </el-button>
            <el-button v-if="!isArchived && canManage" type="warning" plain :icon="SwitchButton"
                @click="$emit('close')">
                关闭并归档
            </el-button>
            <el-button v-if="isArchived && canManage" type="primary" :icon="RefreshLeft"
                @click="$emit('reopen')">
                撤销归档
            </el-button>
        </div>
    </header>
</template>

<style scoped lang="scss">
.hero {
    --c: #409eff;
    --c-2: #79bbff;
    --c-soft: rgba(64, 158, 255, 0.1);
    --c-glow: rgba(64, 158, 255, 0.35);

    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 22px;
    background: #fff;
    border: 1px solid #e8eaef;
    border-top: 3px solid var(--c);
    border-radius: 14px;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
    flex-wrap: wrap;

    &.is-high {
        --c: #f43f5e;
        --c-2: #fb7185;
        --c-soft: rgba(244, 63, 94, 0.1);
        --c-glow: rgba(244, 63, 94, 0.35);
    }

    &.is-medium {
        --c: #409eff;
        --c-2: #79bbff;
        --c-soft: rgba(64, 158, 255, 0.1);
        --c-glow: rgba(64, 158, 255, 0.35);
    }

    &.is-low {
        --c: #10b981;
        --c-2: #34d399;
        --c-soft: rgba(16, 185, 129, 0.1);
        --c-glow: rgba(16, 185, 129, 0.35);
    }

    .hero-main {
        display: flex;
        align-items: center;
        gap: 14px;
        min-width: 0;
    }

    .back-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        flex-shrink: 0;
        font-size: 15px;
        color: #6b7280;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        cursor: pointer;
        transition: color 0.15s ease, border-color 0.15s ease;

        &:hover {
            color: var(--c);
            border-color: var(--c);
        }
    }

    .hero-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 46px;
        height: 46px;
        flex-shrink: 0;
        font-size: 24px;
        color: #fff;
        background: linear-gradient(135deg, var(--c), var(--c-2));
        border-radius: 12px;
        box-shadow: 0 4px 10px var(--c-glow);
    }

    .hero-text {
        min-width: 0;
    }

    .title-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;

        h1 {
            margin: 0;
            font-size: 20px;
            color: #1f2430;
            letter-spacing: -0.2px;
        }
    }

    .type-chip {
        padding: 2px 9px;
        font-size: 11px;
        font-weight: 600;
        color: var(--c);
        background: var(--c-soft);
        border-radius: 999px;
    }

    .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 2px 9px;
        font-size: 11px;
        font-weight: 500;
        border-radius: 999px;

        .dot {
            width: 6px;
            height: 6px;
            background: currentColor;
            border-radius: 50%;
        }
    }

    .meta {
        margin: 6px 0 0;
        font-size: 12px;
        color: #6b7280;
    }

    .hero-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }
}
</style>
