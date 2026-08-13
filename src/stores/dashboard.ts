import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { getProjects } from '@/api/project'
import { listPoints } from '@/api/point'
import { useUserStore } from '@/stores/user'
import type { Point, Project } from '@/types'

const PROJECT_KEY = 'shm_current_project_id'

export const useDashboardStore = defineStore('dashboard', () => {
  const projects = ref<Project[]>([])
  const storedId = Number(localStorage.getItem(PROJECT_KEY))
  const currentProjectId = ref<number | null>(
    Number.isInteger(storedId) && storedId > 0 ? storedId : null,
  )
  const selectedPointId = ref<number | null>(null)
  const loading = ref(false)

  /** 当前项目测点列表（以 /points 接口为准） */
  const points = ref<Point[]>([])
  const pointsLoading = ref(false)
  const pointMap = computed(() => new Map(points.value.map((p) => [p.id, p])))

  const currentProject = computed<Project | null>(
    () => projects.value.find((p) => p.id === currentProjectId.value) ?? null,
  )

  async function fetchProjects(): Promise<void> {
    loading.value = true
    try {
      const res = await getProjects(1, 200)
      projects.value = res.items
      if (!currentProject.value && res.items.length > 0) {
        selectProject(res.items[0].id)
      }
    } finally {
      loading.value = false
    }
  }

  async function loadPoints(): Promise<void> {
    points.value = []
    const userStore = useUserStore()
    if (currentProjectId.value == null || !userStore.token) return
    pointsLoading.value = true
    try {
      points.value = await listPoints(currentProjectId.value)
    } finally {
      pointsLoading.value = false
    }
  }

  function selectProject(id: number): void {
    currentProjectId.value = id
    localStorage.setItem(PROJECT_KEY, String(id))
  }

  function selectPoint(id: number | null): void {
    selectedPointId.value = id
  }

  /** 测点显示名：列表里没有的 id（WS 兜底发现）显示「测点 #id」 */
  function pointName(id: number): string {
    return pointMap.value.get(id)?.point_name ?? `测点 #${id}`
  }

  // 项目切换：清空选中测点并重新加载测点列表
  watch(
    currentProjectId,
    () => {
      selectPoint(null)
      void loadPoints()
    },
    { immediate: true },
  )

  return {
    projects,
    currentProjectId,
    currentProject,
    selectedPointId,
    loading,
    points,
    pointsLoading,
    pointMap,
    fetchProjects,
    loadPoints,
    selectProject,
    selectPoint,
    pointName,
  }
})
