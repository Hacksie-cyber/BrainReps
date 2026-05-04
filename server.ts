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
  const isVercel = !!process.env.VERCEL;
  const isProd = process.env.NODE_ENV === "production";

  if (!isProd && !isVercel) {
    try {
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
          const __dirname = path.dirname(fileURLToPath(import.meta.url));
          let template = await fs.readFile(path.resolve(__dirname, 'index.html'), 'utf-8');
          template = await vite.transformIndexHtml(url, template);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        } catch (e) {
          vite.ssrFixStacktrace(e as Error);
          next(e);
        }
      });
    } catch (err) {
      console.warn("[Neural Server] Vite middleware failed to load, falling back to static.");
    }
  } else {
    // Production/Vercel behavior
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    // In Vercel, the rewrites in vercel.json usually handle the SPA routing,
    // but we can provide a fallback if dist/index.html exists.
    app.all('*', async (req, res) => {
      if (res.headersSent) return;
      try {
        const indexPath = path.resolve(distPath, 'index.html');
        await fs.access(indexPath);
        res.sendFile(indexPath);
      } catch {
        // If dist hasn't been built or index.html is missing, return 404 for non-API
        if (!req.path.startsWith('/api')) {
          res.status(404).send("Static assets not found. Please ensure 'npm run build' has completed.");
        }
      }
    });
  }
}

// Execute middleware setup
setupMiddleware();

if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  const PORT = Number(process.env.PORT || 3000);
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[BrainReps] Server running on http://0.0.0.0:${PORT}`);
  });
}

export default app;
