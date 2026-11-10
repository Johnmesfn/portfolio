import { defineConfig } from "astro/config";
import netlify from "@astrojs/netlify";

export default defineConfig({
  adapter: netlify({
    devFeatures: {
      edgeFunctions: false,
      images: false,
    },
  }),
  output: "static",
  site: "https://yohannesweb.netlify.app",
  vite: {
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:8888",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, "/.netlify/functions/api"),
        },
      },
    },
  },
});
