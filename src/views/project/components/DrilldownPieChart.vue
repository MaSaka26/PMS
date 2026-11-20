<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Highcharts from 'highcharts/esm/highcharts.js'
import 'highcharts/esm/modules/drilldown.js'
import { useMemberStore } from '@/stores/memberStore'

// 全局指定语言标签，避免 Highcharts 内部 Intl 因空 locale 报警
Highcharts.setOptions({ lang: { locale: 'zh-CN' } })

const props = defineProps({
    tasks: { type: Array, default: () => [] },
    // status: 一级=状态，下钻=负责人
    // assignee: 一级=负责人，下钻=状态
    dimension: { type: String, default: 'status' }
})

const memberStore = useMemberStore()
const chartEl = ref(null)
let chart = null
let observer = null

// 状态定义：颜色与看板保持一致
const STATUS_META = [
    { key: 'todo', label: '待办', color: '#909399' },
    { key: 'doing', label: '进行中', color: '#409eff' },
    { key: 'done', label: '待验收', color: '#e6a23c' },
    { key: 'accepted', label: '已验收', color: '#67c23a' },
    { key: 'canceled', label: '已取消', color: '#a8b3c4' }
]

// 负责人一级配色（待认领单独灰色）
const OWNER_PALETTE = ['#409eff', '#7c3aed', '#0ea5e9', '#14b8a6', '#f59e0b', '#f43f5e', '#64748b']

const total = computed(() => props.tasks.length)

// 把基色按比例混白，得到同色系深浅，用于下钻层
const tint = (hex, ratio) => {
    const n = parseInt(hex.slice(1), 16)
    const r = (n >> 16) & 255
    const g = (n >> 8) & 255
    const b = n & 255
    const mix = (c) => Math.round(c + (255 - c) * ratio)
    return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}

const shadesOf = (hex, count) => {
    const ratios = [0, 0.18, 0.32, 0.45, 0.56, 0.66]
    return Array.from({ length: count }, (_, i) => tint(hex, ratios[Math.min(i, ratios.length - 1)]))
}

// ——— 维度一：状态 → 负责人 ———
const buildByStatus = () => {
    const mainData = []
    const drilldownSeries = []

    for (const status of STATUS_META) {
        const list = props.tasks.filter((t) => t.status === status.key)
        if (!list.length) continue

        mainData.push({
            name: status.label,
            y: list.length,
            color: status.color,
            drilldown: status.key
        })

        const byOwner = new Map()
        for (const t of list) {
            const key = t.assignee || 'unassigned'
            byOwner.set(key, (byOwner.get(key) || 0) + 1)
        }
        const shades = shadesOf(status.color, byOwner.size)
        const data = [...byOwner.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([key, count], i) => ({
                name: key === 'unassigned' ? '待认领' : memberStore.memberName(key),
                y: count,
                color: shades[i]
            }))

        drilldownSeries.push({ name: status.label, id: status.key, data })
    }

    return { mainData, drilldownSeries }
}

// ——— 维度二：负责人 → 状态 ———
const buildByAssignee = () => {
    const byOwner = new Map()
    for (const t of props.tasks) {
        const key = t.assignee || 'unassigned'
        if (!byOwner.has(key)) byOwner.set(key, [])
        byOwner.get(key).push(t)
    }

    const entries = [...byOwner.entries()].sort((a, b) => b[1].length - a[1].length)
    const mainData = []
    const drilldownSeries = []

    entries.forEach(([key, list], i) => {
        const color = key === 'unassigned'
            ? '#94a3b8'
            : OWNER_PALETTE[i % OWNER_PALETTE.length]

        mainData.push({
            name: key === 'unassigned' ? '待认领' : memberStore.memberName(key),
            y: list.length,
            color,
            drilldown: key
        })

        // 下钻：该负责人名下的任务状态分布，颜色沿用状态色
        const data = STATUS_META
            .map((s) => ({
                name: s.label,
                y: list.filter((t) => t.status === s.key).length,
                color: s.color
            }))
            .filter((d) => d.y > 0)

        drilldownSeries.push({
            name: key === 'unassigned' ? '待认领' : memberStore.memberName(key),
            id: key,
            data
        })
    })

    return { mainData, drilldownSeries }
}

const subtitleText = computed(() =>
    props.dimension === 'assignee'
        ? '点击扇区可下钻查看该负责人的任务状态'
        : '点击扇区可下钻查看该状态下的负责人分布'
)

const render = () => {
    if (!chartEl.value) return
    const { mainData, drilldownSeries } =
        props.dimension === 'assignee' ? buildByAssignee() : buildByStatus()

    if (chart) {
        chart.destroy()
        chart = null
    }
    if (!mainData.length) return

    chart = Highcharts.chart(chartEl.value, {
        chart: {
            type: 'pie',
            height: 300,
            backgroundColor: 'transparent',
            style: { fontFamily: 'inherit' }
        },
        title: { text: null },
        // 显式指定 locale，避免 Highcharts 默认空语言标签触发 Intl 告警
        lang: { locale: 'zh-CN' },
        subtitle: {
            text: subtitleText.value,
            align: 'center',
            verticalAlign: 'bottom',
            y: 0,
            style: { fontSize: '11px', color: '#9ca3af' }
        },
        credits: { enabled: false },
        legend: { enabled: false },
        tooltip: {
            headerFormat: '',
            pointFormat: '<span style="color:{point.color}">●</span> {point.name}: <b>{point.y}</b> 个（{point.percentage:.1f}%）'
        },
        plotOptions: {
            pie: {
                innerSize: '52%',
                borderWidth: 2,
                borderColor: '#fff',
                allowPointSelect: false,
                cursor: 'pointer',
                dataLabels: {
                    enabled: true,
                    format: '{point.name}<br><b>{point.y}</b>',
                    distance: 12,
                    style: { fontSize: '11px', color: '#4b5563', textOutline: 'none' }
                },
                showInLegend: false
            },
            series: {
                states: { hover: { halo: { size: 4, opacity: 0.12 } } }
            }
        },
        series: [
            {
                name: '任务',
                colorByPoint: true,
                data: mainData
            }
        ],
        drilldown: {
            activeAxisLabelStyle: { textDecoration: 'none' },
            series: drilldownSeries
        }
    })
}

watch(
    () => [props.tasks, props.dimension],
    () => nextTick(render),
    { deep: true }
)

onMounted(() => {
    render()
    if (typeof ResizeObserver !== 'undefined' && chartEl.value) {
        observer = new ResizeObserver(() => chart?.reflow())
        observer.observe(chartEl.value)
    }
})

onBeforeUnmount(() => {
    observer?.disconnect()
    chart?.destroy()
    chart = null
})
</script>

<template>
    <div class="chart-wrap">
        <div v-if="total" ref="chartEl" class="chart"></div>
        <el-empty v-else description="暂无任务数据" :image-size="60" />
    </div>
</template>

<style scoped lang="scss">
.chart-wrap {
    width: 100%;
    min-height: 300px;
}

.chart {
    width: 100%;
    height: 300px;
}

:deep(.highcharts-container) {
    width: 100% !important;
}
</style>
