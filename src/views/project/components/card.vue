<script setup>
//   <Card title="项目1" type="类型1" createdAt="2026-11-11" owner="张经理" desc="项目1的描述" priority="高" status="active" />
import { computed } from 'vue'
import { ArrowLeft, ArrowRight, Calendar, Delete, Edit, Star, StarFilled, SwitchButton } from '@element-plus/icons-vue'
import { PROJECT_STATUS_LABEL } from '@/constants/status'
import DemoViewers from '@/components/DemoViewers.vue'

const props = defineProps({
    title: { type: String, default: '' },
    desc: { type: String, default: '' },
    icon: { type: String, default: '' },
    type: { type: String, default: '' },
    createdAt: { type: String, default: '' },
    owner: { type: String, default: '' },
    priority: { type: String, default: '' },
    status: { type: String, default: '' },
    // 是否有权关闭项目（PM / admin）
    canClose: { type: Boolean, default: false },
    canEdit: { type: Boolean, default: true },
    canDelete: { type: Boolean, default: true },
    // 置顶与泳道内排序（PM / admin）
    pinned: { type: Boolean, default: false },
    canPin: { type: Boolean, default: false },
    canMoveUp: { type: Boolean, default: false },
    canMoveDown: { type: Boolean, default: false },
    // 演示用的「谁正在看」实体键（project:xxx），空串则不显示
    entityKey: { type: String, default: '' }
})

const emit = defineEmits(['edit', 'delete', 'close', 'open', 'pin', 'move-up', 'move-down'])

const statusText = computed(() => PROJECT_STATUS_LABEL[props.status] || props.status)

const PRIORITY_CLASS = { '高': 'prio-high', '中': 'prio-medium', '低': 'prio-low' }
const priorityClass = computed(() => PRIORITY_CLASS[props.priority] || 'prio-medium')

const statusClass = computed(() => `is-${props.status}`)

const ownerInitial = computed(() => (props.owner || '').trim().charAt(0) || '?')
</script>

<template>
    <div class="card" :class="[priorityClass, statusClass, { 'is-pinned': pinned }]" @click="emit('open')">
        <span class="accent" aria-hidden="true"></span>

        <!-- 2×3：第一排 编辑 / 关闭 / 删除，第二排 置顶 / 左移 / 右移 -->
        <div class="card-actions">
            <button v-if="canEdit" type="button" class="action" title="编辑" @click.stop="emit('edit')">
                <el-icon>
                    <Edit />
                </el-icon>
            </button>
            <button v-if="canClose" type="button" class="action action-warn" title="关闭并归档"
                @click.stop="emit('close')">
                <el-icon>
                    <SwitchButton />
                </el-icon>
            </button>
            <button v-if="canDelete" type="button" class="action action-danger" title="删除"
                @click.stop="emit('delete')">
                <el-icon>
                    <Delete />
                </el-icon>
            </button>
            <button v-if="canPin" type="button" class="action action-pin" :class="{ 'is-on': pinned }"
                :title="pinned ? '取消置顶' : '置顶'" @click.stop="emit('pin')">
                <el-icon>
                    <StarFilled v-if="pinned" />
                    <Star v-else />
                </el-icon>
            </button>
            <button v-if="canPin" type="button" class="action" title="左移" :disabled="!canMoveUp"
                @click.stop="emit('move-up')">
                <el-icon>
                    <ArrowLeft />
                </el-icon>
            </button>
            <button v-if="canPin" type="button" class="action" title="右移" :disabled="!canMoveDown"
                @click.stop="emit('move-down')">
                <el-icon>
                    <ArrowRight />
                </el-icon>
            </button>
        </div>

        <div class="card-head">
            <div class="card-icon">
                <el-icon>
                    <component :is="icon || 'Folder'" />
                </el-icon>
            </div>
            <div class="head-text">
                <h2 class="title" :title="title">{{ title }}</h2>
                <span v-if="type" class="type-chip">{{ type }}</span>
            </div>
        </div>

        <p class="desc" :class="{ 'desc-empty': !desc }">{{ desc || '暂无项目描述' }}</p>

        <div class="card-divider" aria-hidden="true"></div>

        <div class="card-foot">
            <div class="owner" :title="owner">
                <span class="owner-avatar">{{ ownerInitial }}</span>
                <span class="owner-name">{{ owner || '未指定' }}</span>
            </div>
            <span class="foot-right">
                <DemoViewers v-if="entityKey" :entity-key="entityKey" />
                <span class="status-pill">
                    <span class="dot" aria-hidden="true"></span>{{ statusText }}
                </span>
            </span>
        </div>

        <div class="card-meta">
            <span class="created">
                <el-icon>
                    <Calendar />
                </el-icon>{{ createdAt || '—' }}
            </span>
            <span class="priority">
                <span class="dot" aria-hidden="true"></span>优先级：{{ priority || '—' }}
            </span>
        </div>
    </div>
</template>

<style scoped lang="scss">
.card {
    --accent: #409eff;
    --accent-2: #79bbff;
    --accent-soft: rgba(64, 158, 255, 0.1);
    --accent-glow: rgba(64, 158, 255, 0.35);
    --st: #909399;
    --st-soft: rgba(144, 147, 153, 0.12);

    position: relative;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px;
    background: #fff;
    border: 1px solid #e8eaef;
    border-radius: 14px;
    box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04), 0 6px 16px rgba(16, 24, 40, 0.05);
    min-width: 150px;
    min-height: 178px;
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;

    // 顶部优先级渐变条
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
        display: grid;
        grid-template-columns: repeat(3, 24px);
        gap: 4px;
        opacity: 0;
        transform: translateY(-4px);
        transition: opacity 0.2s ease, transform 0.2s ease;

        .action {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            padding: 0;
            font-size: 13px;
            color: #606266;
            background: #fff;
            border: 1px solid #e8eaef;
            border-radius: 7px;
            box-shadow: 0 2px 6px rgba(16, 24, 40, 0.08);
            cursor: pointer;
            transition: color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;

            &:hover {
                color: var(--accent);
                border-color: var(--accent);
                transform: translateY(-1px);
            }

            &:disabled {
                opacity: 0.35;
                cursor: not-allowed;
                transform: none;
            }

            &.action-danger:hover {
                color: #f56c6c;
                border-color: #f56c6c;
            }

            &.action-warn:hover {
                color: #e6a23c;
                border-color: #e6a23c;
            }

            &.action-pin.is-on {
                color: #f59e0b;
                border-color: #f6c26b;
                background: #fffbeb;
            }
        }
    }

    &.is-pinned {
        border-color: #f6c26b;
        background: linear-gradient(180deg, #fffdf6, #fff);
    }

    &:hover,
    &:focus-within {
        transform: translateY(-4px);
        border-color: var(--accent);
        box-shadow: 0 2px 4px rgba(16, 24, 40, 0.05), 0 12px 28px rgba(16, 24, 40, 0.12);

        .card-actions {
            opacity: 1;
            transform: none;
        }

        .card-icon {
            transform: scale(1.06) rotate(-3deg);
        }
    }

    .card-head {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 0;

        .card-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 44px;
            height: 44px;
            flex-shrink: 0;
            font-size: 24px;
            color: #fff;
            background: linear-gradient(135deg, var(--accent), var(--accent-2));
            border-radius: 12px;
            box-shadow: 0 4px 10px var(--accent-glow);
            transition: transform 0.22s ease;
        }

        .head-text {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
            min-width: 0;

            .title {
                max-width: 100%;
                font-size: 16px;
                font-weight: 600;
                letter-spacing: 0.2px;
                color: #1f2430;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .type-chip {
                padding: 1px 8px;
                font-size: 12px;
                line-height: 18px;
                color: var(--accent);
                background: var(--accent-soft);
                border-radius: 999px;
            }
        }
    }

    .desc {
        flex: 1;
        font-size: 13px;
        line-height: 1.6;
        color: #6b7280;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;

        &.desc-empty {
            color: #c0c4cc;
            font-style: italic;
        }
    }

    .card-divider {
        height: 1px;
        background: #f0f1f3;
    }

    .card-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;

        .owner {
            display: flex;
            align-items: center;
            gap: 6px;
            min-width: 0;

            .owner-avatar {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 22px;
                height: 22px;
                flex-shrink: 0;
                font-size: 12px;
                font-weight: 600;
                color: var(--accent);
                background: var(--accent-soft);
                border-radius: 50%;
            }

            .owner-name {
                font-size: 13px;
                color: #4b5563;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
        }

        // 右侧一组：演示用「谁在看」+ 状态胶囊，避免两者各自和左边抢空间
        .foot-right {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            flex-shrink: 0;
        }

        .status-pill {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            flex-shrink: 0;
            padding: 2px 9px;
            font-size: 12px;
            color: var(--st);
            background: var(--st-soft);
            border-radius: 999px;

            .dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: currentColor;
            }
        }
    }

    .card-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 12px;

        .created {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            color: #9ca3af;
            font-variant-numeric: tabular-nums;
        }

        .priority {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            font-weight: 500;
            color: var(--accent);

            .dot {
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: currentColor;
            }
        }
    }
}

// 优先级主题色
.card.prio-high {
    --accent: #f43f5e;
    --accent-2: #fb7185;
    --accent-soft: rgba(244, 63, 94, 0.1);
    --accent-glow: rgba(244, 63, 94, 0.35);
}

.card.prio-medium {
    --accent: #409eff;
    --accent-2: #79bbff;
    --accent-soft: rgba(64, 158, 255, 0.1);
    --accent-glow: rgba(64, 158, 255, 0.35);
}

.card.prio-low {
    --accent: #10b981;
    --accent-2: #34d399;
    --accent-soft: rgba(16, 185, 129, 0.1);
    --accent-glow: rgba(16, 185, 129, 0.35);
}

// 状态主题色
.card.is-draft {
    --st: #909399;
    --st-soft: rgba(144, 147, 153, 0.12);
}

.card.is-planning {
    --st: #409eff;
    --st-soft: rgba(64, 158, 255, 0.12);
}

.card.is-active {
    --st: #10b981;
    --st-soft: rgba(16, 185, 129, 0.14);
}

.card.is-accepting {
    --st: #e6a23c;
    --st-soft: rgba(230, 162, 60, 0.15);
}

.card.is-iterating {
    --st: #8b5cf6;
    --st-soft: rgba(139, 92, 246, 0.13);
}

.card.is-archived {
    --st: #94a3b8;
    --st-soft: rgba(148, 163, 184, 0.16);
}

// 执行中的项目：状态点呼吸提示
.card.is-active .status-pill .dot {
    animation: status-pulse 1.8s ease-out infinite;
}

@keyframes status-pulse {
    0% {
        box-shadow: 0 0 0 0 var(--st-soft);
    }

    70% {
        box-shadow: 0 0 0 5px transparent;
    }

    100% {
        box-shadow: 0 0 0 0 transparent;
    }
}

@media (prefers-reduced-motion: reduce) {

    .card,
    .card * {
        transition: none !important;
        animation: none !important;
    }

    .card:hover {
        transform: none;
    }
}
</style>
