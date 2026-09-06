import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Config MINIMAL para el harness de preview de cards (sin backend plugin).
// El preview monta KoruProvider real + KoruUnifiedCard real + KoruDetailScreen real.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    allowedHosts: true,
  },
  build: {
    outDir: "dist-preview",
  },
});
