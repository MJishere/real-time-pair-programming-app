import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Minimal Vite config — no monaco plugin (works with @monaco-editor/react)
export default defineConfig({
  plugins: [react()],
});

