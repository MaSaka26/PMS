// 让 node --test 能解析 Vite 的 @ → src 别名，接口级测试才能 import mock/api/*
import { register } from 'node:module'
register('./alias-hooks.mjs', import.meta.url)
