import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/api/ai': {
          target: 'https://integrate.api.nvidia.com',
          changeOrigin: true,
          rewrite: () => '/v1/chat/completions',
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              if (env.NVIDIA_API_KEY) {
                proxyReq.setHeader('Authorization', `Bearer ${env.NVIDIA_API_KEY}`);
              } else {
                console.error("❌ NVIDIA_API_KEY is missing in .env!");
              }
            });
          }
        },
      },
    },
  }
})
