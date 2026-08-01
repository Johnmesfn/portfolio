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
  server: {
    proxy: {
      "/api": "http://localhost:8888",
    },
  },
});
