import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// 守的是「Element Plus 按需引入」的四类静默失效——漏了都不报错，
// 页面只是空白、没样式、遮罩消失。详见 README「Element Plus 按需注册」。
//
// 注意：解析 main.js 时必须先去掉注释，否则注释掉的 import 会被当成还在。

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')
const EP = path.join(ROOT, 'node_modules', 'element-plus', 'es', 'components')

// 去掉 // 行注释与 /* */ 块注释，保留字符串里的内容（这里没有 URL 之类含 // 的字符串）
function stripComments(code) {
    return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const MAIN = stripComments(fs.readFileSync(path.join(SRC, 'main.js'), 'utf8'))

function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) walk(full, out)
        else if (/\.(vue|js)$/.test(entry.name)) out.push(full)
    }
    return out
}

// 模板里出现的 <el-xxx> 标签 + JS 里 from 'element-plus' 的具名导入
function collectUsage() {
    const tags = new Set()
    const imports = new Set()
    for (const file of walk(SRC)) {
        const code = stripComments(fs.readFileSync(file, 'utf8'))
        for (const m of code.matchAll(/<((?:el)-[a-z0-9-]+)/g)) tags.add(m[1])
        for (const m of code.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]element-plus['"]/g)) {
            for (const part of m[1].split(',')) {
                const name = part.trim().split(/\s+as\s+/)[0]
                if (name) imports.add(name)
            }
        }
    }
    return { tags: [...tags].sort(), imports: [...imports].sort() }
}

// ElMessageBox → message-box；el-checkbox-group → checkbox-group
const toDir = (name) => name
    .replace(/^el-?/i, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()

// main.js 里真正 import 了样式的组件目录
function styledDirs(code) {
    const dirs = new Set()
    const re = /import\s+['"]element-plus\/es\/components\/([\w-]+)\/style\/css['"]/g
    for (const m of code.matchAll(re)) dirs.add(m[1])
    return dirs
}

// EL_COMPONENTS 表里实际注册的组件名 → kebab-case 标签名
function registeredTags(code) {
    const block = code.match(/const\s+EL_COMPONENTS\s*=\s*\{([\s\S]*?)\}/)
    assert.ok(block, 'main.js 里找不到 EL_COMPONENTS 对象')
    const names = [...block[1].matchAll(/\b(El[A-Za-z]+)\b/g)].map((m) => m[1])
    return new Set(names.map((n) => 'el-' + toDir(n)))
}

const { tags, imports } = collectUsage()
const styled = styledDirs(MAIN)
const registered = registeredTags(MAIN)

test('扫描本身能扫到东西（防止扫描逻辑失效导致空集合永远通过）', () => {
    assert.ok(tags.length > 30, `只扫到 ${tags.length} 个 el-* 标签，扫描逻辑可能坏了`)
    assert.ok(imports.length > 0, '没有扫到任何 element-plus 具名导入')
    assert.ok(styled.size > 30, `只解析到 ${styled.size} 条样式 import，解析逻辑可能坏了`)
    assert.ok(registered.size > 30, `只解析到 ${registered.size} 个已注册组件，解析逻辑可能坏了`)
})

test('组件目录名映射正确（映射写错时下面的断言会误报）', () => {
    const all = new Set([...tags.map(toDir), ...imports.map(toDir)])
    const broken = [...all].filter((dir) => !fs.existsSync(path.join(EP, dir, 'style', 'css.mjs')))
    assert.deepEqual(broken, [], `这些目录在 element-plus 里不存在：${broken.join(', ')}`)
})

test('每个用到的组件都 import 了样式', () => {
    const missing = [...new Set([...tags.map(toDir), ...imports.map(toDir)])]
        .filter((dir) => !styled.has(dir))
    assert.deepEqual(missing, [], `这些组件缺样式 import，对应 UI 会失去样式：${missing.join(', ')}`)
})

test('每个 <el-xxx> 标签都注册成了全局组件', () => {
    const missing = tags.filter((tag) => !registered.has(tag))
    assert.deepEqual(missing, [], `这些标签没注册，Vue 会把它们当未知标签原样渲染，页面空白：${missing.join(', ')}`)
})

test('服务式组件也单独 import 了样式（它们不在模板里，grep 标签永远找不到）', () => {
    const services = { message: 'ElMessage', 'message-box': 'ElMessageBox', loading: 'ElLoading' }
    const missing = Object.entries(services)
        .filter(([dir]) => !styled.has(dir))
        .map(([, name]) => name)
    assert.deepEqual(missing, [], `${missing.join(' / ')} 的样式缺失（弹窗撑满全屏、遮罩消失）`)
})
