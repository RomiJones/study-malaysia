import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "node:path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.VITE_ADMIN_PROXY_TARGET || "http://localhost:3000";

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        "@": resolve(__dirname, "src")
      }
    },
    server: {
      port: 3001,
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true
        }
      }
    },
    preview: {
      port: 3001
    }
  };
});