import Mock from 'mockjs'

// 各业务模块的 mock 在这里注册，main.js 只需要 import './mock'
import './member'
import './field'
import './project'
import './task'
import './template'
import './user'

// 一个最小接口，验证 Mock 生效
Mock.mock('/api/ping', 'get', {
  code: 200,
  data: { message: 'pong', time: Mock.Random.datetime() },
  msg: 'success',
})

console.log('[mock] 已启动')
