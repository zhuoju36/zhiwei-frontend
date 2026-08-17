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
      { path: '', redirect: '/analysis/project-map' },
      {
        path: 'project-map',
        component: () => import('@/views/Analysis/ProjectMap.vue'),
        meta: { requiresAuth: true, title: '项目地图' },
      },
      {
        path: 'device-status',
        component: () => import('@/views/Analysis/DeviceStatus.vue'),
        meta: { requiresAuth: true, title: '设备状态' },
      },
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
      {
        path: 'spectrum',
        component: () => import('@/views/Analysis/Spectrum.vue'),
        meta: { requiresAuth: true, title: '分析任务' },
      },
      {
        path: 'evaluation',
        component: () => import('@/views/Analysis/Evaluation.vue'),
        meta: { requiresAuth: true, title: '数据评估' },
      },
      {
        path: 'alert-log',
        component: () => import('@/views/Analysis/AlertLog.vue'),
        meta: { requiresAuth: true, title: '预警日志' },
      },
      {
        path: 'notify-setting',
        component: () => import('@/views/Analysis/NotifySetting.vue'),
        meta: { requiresAuth: true, title: '通知设置' },
      },
    ],
  },
  {
    path: '/admin',
    component: () => import('@/views/Admin/Index.vue'),
    meta: { requiresAuth: true, requiresAdmin: true, title: '系统管理' },
    children: [
      { path: '', redirect: '/admin/projects' },
      {
        path: 'projects',
        component: () => import('@/views/Admin/ProjectManage.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, title: '项目管理' },
      },
      {
        path: 'devices',
        component: () => import('@/views/Admin/DeviceManage.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, title: '设备管理' },
      },
      {
        path: 'sensors',
        component: () => import('@/views/Admin/SensorManage.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, title: '传感器管理' },
      },
      {
        path: 'channels',
        component: () => import('@/views/Admin/ChannelManage.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, title: '通道管理' },
      },
      {
        path: 'users',
        component: () => import('@/views/Admin/UserManage.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, title: '用户管理' },
      },
      {
        path: 'models',
        component: () => import('@/views/Admin/ModelManage.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, title: '模型管理' },
      },
      {
        path: 'platform',
        component: () => import('@/views/Admin/PlatformSetting.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, title: '平台设置' },
      },
      {
        path: 'plugins',
        component: () => import('@/views/Admin/PluginManage.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, title: '插件管理' },
      },
      {
        path: 'logs',
        component: () => import('@/views/Admin/LogManage.vue'),
        meta: { requiresAuth: true, requiresAdmin: true, title: '日志管理' },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]
