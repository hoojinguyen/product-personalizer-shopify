import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  esbuild: {
    jsx: "automatic", // Natively compile React JSX/TSX without external plugins
  },
  build: {
    outDir: "extensions/theme-extension/assets",
    emptyOutDir: false, // Proactively keep existing custom CSS/JS assets in the extension folder
    lib: {
      entry: path.resolve(__dirname, "app/storefront-widget/index.tsx"),
      name: "ProductPersonalizer",
      formats: ["iife"], // IIFE is standard for direct, headless browser execution
      fileName: () => "product-personalizer.js",
    },
    rollupOptions: {
      output: {
        extend: true,
        assetFileNames: "product-personalizer.[ext]",
      },
    },
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});
