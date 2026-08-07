import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Forwards the Illustrations panel's backend calls to the local
    // Firebase Functions emulator (run alongside `npm run dev` with
    // `firebase emulators:start --only functions`) so it works the same
    // way in dev as it does behind Hosting's rewrite in prod. Override with
    // VITE_AI_ILLUSTRATION_ENDPOINT instead if you're pointing at a
    // deployed backend.
    proxy: {
      "/api/ai": {
        target: "http://127.0.0.1:5001/vaycona-editor/us-central1",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ai\/illustrations\/generate/, "/generateIllustrations"),
      },
    },
  },
});
