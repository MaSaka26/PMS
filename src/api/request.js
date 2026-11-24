import axios from "axios";
import { ensureMock } from "./mockGate";

const request = axios.create({
  baseURL: "/api",
  timeout: 5000,
});

request.interceptors.request.use(
  async (config) => {
    // 模拟数据层是异步 chunk，必须等它装好 XMLHttpRequest 再放行，
    // 否则这个请求会打到真实网络并返回 404。真实后端模式这里是空操作。
    await ensureMock();
    const token = localStorage.getItem('pm_token')
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

request.interceptors.response.use(
  (response) => {
    const { code, data, msg } = response.data;
    if (code === 200) {
      return data;
    }
    return Promise.reject(new Error(msg || "请求失败"));
  },
  (error) => Promise.reject(error),
);

export default request;
