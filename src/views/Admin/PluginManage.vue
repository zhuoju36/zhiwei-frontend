<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { listPlugins } from '@/api/analysis'
import { listProtocols } from '@/api/protocol'
import type { AnalysisPluginMeta, ProtocolInfo } from '@/types'

const loading = ref(false)
const protocols = ref<ProtocolInfo[]>([])
const plugins = ref<AnalysisPluginMeta[]>([])

onMounted(async () => {
  loading.value = true
  try {
    const [ps, pls] = await Promise.all([listProtocols(), listPlugins()])
    protocols.value = ps
    plugins.value = pls
  } catch {
    protocols.value = []
    plugins.value = []
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="plugin-page">
    <el-card shadow="never" class="card">
      <template #header>协议适配器</template>
      <el-table v-loading="loading" :data="protocols" border>
        <el-table-column prop="name" label="协议" width="160" />
        <el-table-column prop="version" label="版本" width="120" />
        <el-table-column label="支持批量" width="120">
          <template #default="{ row }">
            <el-tag :type="row.supports_batch ? 'success' : 'info'" size="small">
              {{ row.supports_batch ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="配置 Schema">
          <template #default="{ row }">
            <el-tag v-for="key in Object.keys(row.config_schema ?? {})" :key="key" size="small" class="schema-tag">
              {{ key }}
            </el-tag>
            <span v-if="!Object.keys(row.config_schema ?? {}).length" class="muted">无</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card shadow="never" class="card">
      <template #header>分析插件（/analysis/plugins）</template>
      <el-table v-loading="loading" :data="plugins" border>
        <el-table-column prop="display_name" label="名称" width="180" />
        <el-table-column prop="name" label="标识" width="120" />
        <el-table-column prop="version" label="版本" width="100" />
        <el-table-column prop="input_channels" label="通道数" width="90" />
        <el-table-column prop="min_samples" label="最少样本" width="100" />
        <el-table-column prop="description" label="说明" min-width="200" />
      </el-table>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.plugin-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.schema-tag {
  margin-right: 6px;
}

.muted {
  color: #909399;
}
</style>
