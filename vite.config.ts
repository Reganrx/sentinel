import { defineConfig } from "vite";
import electron from "vite-plugin-electron/simple";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: "electron/main.ts",
        vite: {
          build: {
            rolldownOptions: {
              external: ["electron/main", "electron/common"],
            },
          },
        },
      },
      preload: {
        input: new URL("./electron/preload.ts", import.meta.url).pathname,
        vite: {
          build: {
            rolldownOptions: {
              external: ["electron/renderer"],
            },
          },
        },
      },
    }),
  ],
});
