import type { RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    component: () => import('@/views/Login.vue'),
    meta: { title: '登录' },
  },
  {
    path: '/',
    component: () => import('@/views/Dashboard/Index.vue'),
    meta: { requiresAuth: true, title: '数据大屏' },
  },
  {
    path: '/analysis',
    component: () => import('@/views/Analysis/Index.vue'),
    meta: { requiresAuth: true, title: '数据分析' },
    children: [
      { path: '', redirect: '/analysis/realtime' },
      {
        path: 'realtime',
        component: () => import('@/views/Analysis/RealTime.vue'),
        meta: { requiresAuth: true, title: '实时监测' },
      },
      {
        path: 'history',
        component: () => import('@/views/Analysis/History.vue'),
        meta: { requiresAuth: true, title: '历史查询' },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]
