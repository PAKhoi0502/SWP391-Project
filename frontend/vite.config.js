import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
  },
  server: {
    port: 5173,
    // Proxy mọi request API về backend Spring Boot (localhost:8080)
    // để tránh lỗi CORS khi dev. Mỗi đường dẫn dưới đây được forward nguyên vẹn.
    proxy: {
      '/api': 'http://localhost:8080',
      '/health': 'http://localhost:8080',
      '/api-docs': 'http://localhost:8080',
      '/v3': 'http://localhost:8080', // springdoc OpenAPI (swagger)
    },
  },
})
