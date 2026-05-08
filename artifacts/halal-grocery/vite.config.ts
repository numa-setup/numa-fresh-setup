import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const port = Number(process.env.PORT) || 3000;
const basePath = process.env.BASE_PATH || "/";

const plugins: any[] = [react(), tailwindcss()];

if (process.env.NODE_ENV !== "production") {
  try {
    const { default: runtimeErrorOverlay } = await import(
      "@replit/vite-plugin-runtime-error-modal"
    );
    plugins.push(runtimeErrorOverlay());
  } catch {}
}

if (
  process.env.NODE_ENV !== "production" &&
  process.env.REPL_ID !== undefined
) {
  try {
    const { cartographer } = await import("@replit/vite-plugin-cartographer");
    plugins.push(
      cartographer({ root: path.resolve(import.meta.dirname, "..") }),
    );
  } catch {}
  try {
    const { devBanner } = await import("@replit/vite-plugin-dev-banner");
    plugins.push(devBanner());
  } catch {}
}

export default defineConfig({
  base: basePath,
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "attached_assets",
      ),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: false,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
