import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

// Element Plus 按需引入：只注册本项目实际用到的组件。
// 全量 app.use(ElementPlus) 会把 Element Plus 的每个组件都打进首屏包，
// 其中绝大多数页面根本用不到。组件清单与 src 下的 el-* 用法一一对应，
// 新增页面用到新组件时，记得回到这里补一行。
import {
  ElIcon,
  ElButton,
  ElFormItem,
  ElInput,
  ElTableColumn,
  ElOption,
  ElSelect,
  ElEmpty,
  ElRadioButton,
  ElDialog,
  ElDatePicker,
  ElTabPane,
  ElRadioGroup,
  ElForm,
  ElDivider,
  ElAlert,
  ElTable,
  ElSwitch,
  ElInputNumber,
  ElCheckbox,
  ElTooltip,
  ElTag,
  ElPagination,
  ElTabs,
  ElPopover,
  ElMenuItem,
  ElDropdownItem,
  ElContainer,
  ElSubMenu,
  ElScrollbar,
  ElProgress,
  ElPopconfirm,
  ElMenu,
  ElMain,
  ElHeader,
  ElDropdownMenu,
  ElDropdown,
  ElDrawer,
  ElCheckboxGroup,
  ElBreadcrumbItem,
  ElBreadcrumb,
  ElAvatar,
  ElAside,
  ElConfigProvider,
  ElLoading,
} from 'element-plus'

// 组件名 → 组件定义。注册时统一从这张表推导，避免"引入了却忘了注册"。
const EL_COMPONENTS = {
  ElIcon, ElButton, ElFormItem, ElInput, ElTableColumn, ElOption, ElSelect,
  ElEmpty, ElRadioButton, ElDialog, ElDatePicker, ElTabPane, ElRadioGroup,
  ElForm, ElDivider, ElAlert, ElTable, ElSwitch, ElInputNumber, ElCheckbox,
  ElTooltip, ElTag, ElPagination, ElTabs, ElPopover, ElMenuItem,
  ElDropdownItem, ElContainer, ElSubMenu, ElScrollbar, ElProgress,
  ElPopconfirm, ElMenu, ElMain, ElHeader, ElDropdownMenu, ElDropdown,
  ElDrawer, ElCheckboxGroup, ElBreadcrumbItem, ElBreadcrumb, ElAvatar,
  ElAside, ElConfigProvider,
}
import 'element-plus/es/components/icon/style/css'
import 'element-plus/es/components/button/style/css'
import 'element-plus/es/components/form-item/style/css'
import 'element-plus/es/components/input/style/css'
import 'element-plus/es/components/table-column/style/css'
import 'element-plus/es/components/option/style/css'
import 'element-plus/es/components/select/style/css'
import 'element-plus/es/components/empty/style/css'
import 'element-plus/es/components/radio-button/style/css'
import 'element-plus/es/components/dialog/style/css'
import 'element-plus/es/components/date-picker/style/css'
import 'element-plus/es/components/tab-pane/style/css'
import 'element-plus/es/components/radio-group/style/css'
import 'element-plus/es/components/form/style/css'
import 'element-plus/es/components/divider/style/css'
import 'element-plus/es/components/alert/style/css'
import 'element-plus/es/components/table/style/css'
import 'element-plus/es/components/switch/style/css'
import 'element-plus/es/components/input-number/style/css'
import 'element-plus/es/components/checkbox/style/css'
import 'element-plus/es/components/tooltip/style/css'
import 'element-plus/es/components/tag/style/css'
import 'element-plus/es/components/pagination/style/css'
import 'element-plus/es/components/tabs/style/css'
import 'element-plus/es/components/popover/style/css'
import 'element-plus/es/components/menu-item/style/css'
import 'element-plus/es/components/dropdown-item/style/css'
import 'element-plus/es/components/container/style/css'
import 'element-plus/es/components/sub-menu/style/css'
import 'element-plus/es/components/scrollbar/style/css'
import 'element-plus/es/components/progress/style/css'
import 'element-plus/es/components/popconfirm/style/css'
import 'element-plus/es/components/menu/style/css'
import 'element-plus/es/components/main/style/css'
import 'element-plus/es/components/header/style/css'
import 'element-plus/es/components/dropdown-menu/style/css'
import 'element-plus/es/components/dropdown/style/css'
import 'element-plus/es/components/drawer/style/css'
import 'element-plus/es/components/checkbox-group/style/css'
import 'element-plus/es/components/breadcrumb-item/style/css'
import 'element-plus/es/components/breadcrumb/style/css'
import 'element-plus/es/components/avatar/style/css'
import 'element-plus/es/components/aside/style/css'
import 'element-plus/es/components/config-provider/style/css'
// 下面几个不是 <el-*> 标签，按标签清单补 CSS 时会漏掉：
// - ElLoading 是 v-loading 指令，样式不在任何组件的 css 依赖里；
// - ElMessage / ElMessageBox / ElNotification 是服务式调用，自己弹 DOM。
// 漏了都不报错：加载遮罩没有定位与背景、弹窗撑满全屏白底无边框。
import 'element-plus/es/components/loading/style/css'
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'
import './styles/index.css'

import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { ensureMock } from './api/mockGate'

const app = createApp(App)

// 把上面按需引入的组件注册成全局组件（el-button / el-table …）。
// 模板里写的是 kebab-case，这里把 ElButton 转成 el-button。
for (const [name, component] of Object.entries(EL_COMPONENTS)) {
  app.component(name.replace(/^El/, 'el-').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(), component)
}

// 注册所有图标为全局组件。
// 这里不做白名单：项目详情页的图标选择器（ProjectFormDialog.vue）
// 本身就遍历了整份图标表，图标无论如何都要进包，按需注册省不下体积。
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())

// 按需引入后不再有 app.use(ElementPlus)，需要单独注册这两项：
// ElLoading —— 模板里的 v-loading 指令依赖它，漏了不报错、只是遮罩静默消失；
// 中文 locale —— 通过 App.vue 的 <el-config-provider> 下发，见该文件。
app.use(ElLoading)

app.use(router)

app.mount('#app')

// 首屏渲染完成后，在浏览器空闲时预取 mock 与种子数据。
// 放到空闲时段是为了不和 Element Plus 抢首屏带宽；
// 真正发请求时请求拦截器还会等它就绪，见 src/api/mockGate.js。
const whenIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200))
whenIdle(() => {
  ensureMock()
})
