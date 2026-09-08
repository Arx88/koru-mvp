import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Build del ARCHIVO ÚNICO all-cards: showcase del chat + galería de
// interiores en UNA sola entrada (idealmente un chunk de JS + un CSS) para
// poder inlinearlo en un HTML autocontenido (scripts/build-all-cards-html.mjs).
// La app real (index.html) y los otros harnesses NO se tocan.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist-allcards",
    rollupOptions: {
      input: {
        allcards: new URL("./all-cards.html", import.meta.url).pathname,
      },
    },
  },
});
