import { createApp } from 'vue'
import App from './App.vue'
import { pinia } from './stores'
import router from './router'
import { setupElementPlus } from './plugins/element-plus'
import { setupECharts } from './plugins/echarts'
import { setupDataV } from './plugins/datav'
import 'element-plus/dist/index.css'
import '@kjgl77/datav-vue3/dist/style.css'
import '@/assets/styles/global.scss'

setupECharts()

const app = createApp(App)
app.use(pinia)
setupElementPlus(app)
setupDataV(app)
app.use(router)
app.mount('#app')
