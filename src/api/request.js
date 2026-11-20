import axios from "axios";

const request = axios.create({
  baseURL: "/api",
  timeout: 5000,
});

request.interceptors.request.use(
  (config) => {
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