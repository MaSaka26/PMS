import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { login as loginApi, getInfo } from "@/api/userAPI";
import router from "@/router";
import { ElMessage } from "element-plus";

// token 在 localStorage 的 key（和 request 拦截器、mock 保持一致）
const TOKEN_KEY = "pm_token";

export const useUserStore = defineStore("user", () => {
  // 刷新后从 localStorage 恢复 token
  const token = ref(localStorage.getItem(TOKEN_KEY) || "");
  const userInfo = ref(null);

  // 是否已登录
  const isLogged = computed(() => !!token.value);

  // 模块加载时自动恢复 userInfo（刷新页面 / 直接访问受保护路由时）
  // 用一个 promise 让调用方可以 await 等数据到位
  let restorePromise = null;
  const restoreUserInfo = () => {
    if (restorePromise) return restorePromise;
    if (!token.value) {
      return Promise.resolve(null);
    }
    restorePromise = getInfo()
      .then((user) => {
        userInfo.value = user;
        return user;
      })
      .catch(() => {
        // token 失效 / 账号被停用：清掉登录态并退回登录页
        token.value = "";
        userInfo.value = null;
        localStorage.removeItem(TOKEN_KEY);
        const current = router.currentRoute.value;
        if (current.meta?.public !== true && current.path !== "/login") {
          router.push({
            path: "/login",
            query: { redirect: current.fullPath || "/project" },
          });
        }
        return null;
      })
      .finally(() => {
        // 允许后续再次校验，角色 / 停用状态变化后才能刷新
        restorePromise = null;
      });
    return restorePromise;
  };
  // 立即执行（刷新页面时 pinia createStore 的同步代码就会跑到这里）
  restoreUserInfo();

  // 登录：调 /login → 存 token → 拉 userInfo
  const login = async (username, password) => {
    const res = await loginApi({ username, password });
    // request.js 已经拆包，res 就是 { token, user }
    token.value = res.token;
    localStorage.setItem(TOKEN_KEY, res.token);
    userInfo.value = res.user;
    ElMessage.success(`欢迎回来，${res.user.name}`);
    // 跳回原目标页，没有的话去 /project
    const redirect = router.currentRoute.value.query.redirect || "/project";
    router.push(redirect);
    return res.user;
  };

  // 刷新 / 启动时恢复 userInfo（token 还在的情况下）
  const getUserInfoData = async () => {
    if (!token.value) return null;
    try {
      // request.js 拆包后，res 就是 user 对象本身
      userInfo.value = await getInfo();
      return userInfo.value;
    } catch {
      // token 失效，清掉
      logoutUser(false);
      return null;
    }
  };

  // 退出登录
  const logoutUser = (showMessage = true) => {
    token.value = "";
    userInfo.value = null;
    localStorage.removeItem(TOKEN_KEY);
    if (showMessage) ElMessage.success("已退出登录");
    router.push("/login");
  };

  return {
    token,
    userInfo,
    isLogged,
    login,
    restoreUserInfo,
    getUserInfoData,
    logoutUser,
  };
});