import { createRouter, createWebHashHistory } from "vue-router"
import { getInfo } from "@/api/userAPI";
import { TOKEN_KEY } from "@/constants/user";

const router = createRouter({
  // GitHub Pages 不支持服务端回退，使用 Hash 路由避免刷新 404
  history: createWebHashHistory(),
  routes: [
    // 登录页 —— 独立路由，不走 layout 包裹
    {
      path: "/login",
      name: "Login",
      component: () => import("@/views/Login/index.vue"),
      meta: { title: "登录", public: true },
    },
    {
      path: "/",
      component: () => import("@/layout/index.vue"),
      redirect: "/project/board",
      meta: { title: "项目管理后台" },
      children: [
        // 三个看板都是 layout 下的一级路由（此前是父路由的 children）
        {
          path: "project/board",
          name: "ProjectBoard",
          component: () => import("@/views/project/index.vue"),
          meta: { title: "项目看板" },
        },
        {
          path: "task/board",
          name: "TaskBoard",
          component: () => import("@/views/task/index.vue"),
          meta: { title: "任务看板" },
        },
        {
          path: "milestone/board",
          name: "MilestoneBoard",
          component: () => import("@/views/milestone/index.vue"),
          meta: { title: "里程碑看板" },
        },

        // 我的任务独立成一级：跨项目，与看板不是同一层东西
        {
          path: "mine",
          name: "TaskMine",
          component: () => import("@/views/task/mine.vue"),
          meta: { title: "我的任务" },
        },
        // 项目详情：归档项目与普通项目共用同一路由，按项目状态判断只读
        {
          path: "project/:id",
          name: "ProjectDetail",
          component: () => import("@/views/project/detail.vue"),
          meta: { title: "项目详情" },
        },
        {
          path: "field",
          name: "Field",
          component: () => import("@/views/field/index.vue"),
          meta: { title: "字段配置" },
        },
        {
          path: "template",
          name: "Template",
          component: () => import("@/views/template/index.vue"),
          meta: { title: "项目模板" },
        },
        {
          path: "member",
          name: "Member",
          component: () => import("@/views/member/index.vue"),
          meta: { title: "成员管理" },
        },
      ],
    },
    // 兜底：未匹配到的路由跳 /login
    { path: "/:pathMatch(.*)*", redirect: "/login" },
  ],
});

// 全局守卫：未登录 → 去登录页（带 redirect 回来）
// 已登录 但 访问 /login → 跳回 /project/board
// token 变化后调用 /info 校验，账号被停用 / 失效时立即退回登录页
let verifiedToken = "";
router.beforeEach(async (to) => {
  const token = localStorage.getItem(TOKEN_KEY) || "";

  // 公开路由（/login）
  if (to.meta.public) {
    if (token && to.path === "/login") {
      return "/project/board";
    }
    return true;
  }

  // 非公开路由：必须登录
  if (!token) {
    return {
      path: "/login",
      query: { redirect: to.fullPath },
    };
  }

  if (token !== verifiedToken) {
    try {
      await getInfo();
      verifiedToken = token;
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      verifiedToken = "";
      return {
        path: "/login",
        query: { redirect: to.fullPath },
      };
    }
  }

  return true;
});

export default router;
