import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createGlmApiMiddleware } from './server/glmApi.ts'

export default defineConfig(({ mode }) => {
  // 从本地 .env 读取配置（.env 已被 gitignore 排除，不进仓库）
  // 第三个参数 '' 表示加载所有变量（含 GLM_API_KEY / PORT），只用于服务端，不下发浏览器
  const env = loadEnv(mode, process.cwd(), '')
  if (env.GLM_API_KEY) process.env.GLM_API_KEY = env.GLM_API_KEY

  const port = Number(env.PORT ?? process.env.PORT ?? 5173)

  return {
    plugins: [
      react(),
      {
        // 服务端 GLM 识别接口：key 只在 Node 端使用，不下发到浏览器
        name: 'glm-recognize-api',
        configureServer(server) {
          server.middlewares.use(createGlmApiMiddleware())
        },
        configurePreviewServer(server) {
          server.middlewares.use(createGlmApiMiddleware())
        },
      },
    ],
    server: {
      host: '127.0.0.1',
      port,
      allowedHosts: true,
    },
    preview: {
      host: '0.0.0.0',
      port,
      allowedHosts: true,
    },
  }
})
