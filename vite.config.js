import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Baut die Seite nach dist/ (wird von den Start-Skripten und Vercel ausgeliefert).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 8080 },
});
