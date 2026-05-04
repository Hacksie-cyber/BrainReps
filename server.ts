import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { askHandoutAssistant } from "./src/lib/geminiService";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// API routes defined early for serverless
app.post("/api/ai/ask", async (req, res) => {
  const rawKey = process.env.BRAIN_REPS_API_KEY;
  const hasKey = !!rawKey;
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  console.log(`[Neural Server] AI Processing Request in ${nodeEnv}. KeyConfigured: ${hasKey}`);
  
  if (!hasKey) {
    return res.status(500).json({ 
      error: "Neural Core Configuration Missing", 
      details: "BRAIN_REPS_API_KEY environment variable is not set. Action: Go to Vercel Settings -> Environment Variables, add the key, and redeploy." 
    });
  }
  
  try {
    const { query, sources, history } = req.body;
    if (!query) throw new Error("Query is required");
    
    const response = await askHandoutAssistant(query, sources, history);
    res.status(200).json({ text: response });
  } catch (error: any) {
    console.error("[Neural Server] AI Processing Failed:", error.message);
    res.status(500).json({ 
      error: error.message || "Unknown neural core error",
      details: `Neural sync failed. Env: ${nodeEnv}`
    });
  }
});

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Initialize logic for middleware
async function setupMiddleware() {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    app.all('*', async (req, res, next) => {
      if (res.headersSent) return;
      const url = req.originalUrl;
      try {
        let template = await fs.readFile(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.all('*', (req, res) => res.sendFile(path.resolve(distPath, 'index.html')));
  }
}

// In Vercel, we don't start the listener ourselves usually, 
// but we need to ensure middleware is setup if it's production
if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
  const distPath = path.resolve(process.cwd(), 'dist');
  app.use(express.static(distPath));
  // Note: Vercel does its own routing, so we usually don't need a catch-all if vercel.json is setup
} else {
  setupMiddleware();
}

if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  const PORT = Number(process.env.PORT || 3000);
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[BrainReps] Server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;
