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
    rollupOptions: {
      // El harness construye exactamente sus dos entradas: el showcase del
      // chat (/preview.html) y la galería de interiores (/lectura.html).
      // index.html (la app real) NO se toca en este build.
      input: {
        preview: new URL("./preview.html", import.meta.url).pathname,
        lectura: new URL("./lectura.html", import.meta.url).pathname,
      },
    },
  },
});
