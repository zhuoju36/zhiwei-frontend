import { createApp } from 'vue'
import App from './App.vue'
import { pinia } from './stores'
import router from './router'
import { setupElementPlus } from './plugins/element-plus'
import { setupECharts } from './plugins/echarts'
import 'element-plus/dist/index.css'
import '@/assets/styles/global.scss'

setupECharts()

const app = createApp(App)
app.use(pinia)
setupElementPlus(app)
app.use(router)
app.mount('#app')
