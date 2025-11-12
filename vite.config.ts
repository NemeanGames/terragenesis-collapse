import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const base = mode === "production" ? "/terragenesis-collapse/" : "/";
  return {
    base,
    plugins: [react()],
    build: {
      outDir: "dist",
      sourcemap: true
    },
    server: {
      port: 5173,
      host: "0.0.0.0"
    }
  };
});
