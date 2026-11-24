import { createRouter, createWebHashHistory } from "vue-router"
import { getInfo } from "@/api/userAPI";

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
      redirect: "/project",
      meta: { title: "项目管理后台" },
      children: [
        {
          // 项目管理：下拉包含「项目看板」和「项目归档」
          path: "project",
          name: "ProjectPlanning",
          redirect: "/project/board",
          meta: { title: "项目管理" },
          children: [
            {
              path: "board",
              name: "ProjectBoard",
              component: () => import("@/views/project/index.vue"),
              meta: { title: "项目看板" },
              children: [
                {
                  // 项目详情挂在看板下：面包屑 项目管理 > 项目看板 > 项目详情
                  path: ":id",
                  name: "ProjectBoardDetail",
                  component: () => import("@/views/project/detail.vue"),
                  meta: { title: "项目详情" },
                },
              ],
            },
            {
              path: "archive",
              name: "ProjectArchive",
              component: () => import("@/views/project/archive.vue"),
              meta: { title: "项目归档" },
              children: [
                {
                  // 归档项目详情挂在归档下，面包屑 项目管理 > 项目归档 > 项目详情
                  path: ":id",
                  name: "ProjectArchiveDetail",
                  component: () => import("@/views/project/detail.vue"),
                  meta: { title: "项目详情" },
                },
              ],
            },
            {
              path: "flow",
              name: "ProjectFlow",
              component: () => import("@/views/project/flow.vue"),
              meta: { title: "项目流程" },
            },
            {
              // 兼容旧地址 /project/:id → /project/board/:id
              path: ":id",
              redirect: (to) => `/project/board/${to.params.id}`,
            },
          ],
        },
        {
          // 任务规划：下拉包含「任务看板」和「任务流程」
          path: "task",
          name: "TaskPlanning",
          redirect: "/task/board",
          meta: { title: "任务规划" },
          children: [
            {
              path: "board",
              name: "TaskBoard",
              component: () => import("@/views/task/index.vue"),
              meta: { title: "任务看板" },
            },
            {
              path: "mine",
              name: "TaskMine",
              component: () => import("@/views/task/mine.vue"),
              meta: { title: "我的任务" },
            },
            {
              path: "flow",
              name: "TaskFlow",
              component: () => import("@/views/task/flow.vue"),
              meta: { title: "任务流程" },
            },
          ],
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
// 已登录 但 访问 /login → 跳回 /project
// token 变化后调用 /info 校验，账号被停用 / 失效时立即退回登录页
let verifiedToken = "";
router.beforeEach(async (to) => {
  const token = localStorage.getItem("pm_token") || "";

  // 公开路由（/login）
  if (to.meta.public) {
    if (token && to.path === "/login") {
      return "/project";
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
      localStorage.removeItem("pm_token");
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
