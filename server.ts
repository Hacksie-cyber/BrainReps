import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { askHandoutAssistant } from "./src/lib/geminiService";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser for API routes
  app.use(express.json());

  // API routes
  app.post("/api/ai/ask", async (req, res) => {
    try {
      const { query, sources, history } = req.body;
      const response = await askHandoutAssistant(query, sources, history);
      res.json({ text: response });
    } catch (error: any) {
      console.error("AI Request Failed:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  if (process.env.NODE_ENV !== "production") {
    // Development mode with Vite middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    // Development SPA Fallback: Transformed by Vite
    app.all('*', async (req, res, next) => {
      // Skip if the request has already been handled (e.g. by Vite middlewares)
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
    // Production mode serving static files
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    // SPA fallback: handle all requests by returning index.html
    app.all('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[BrainReps] Institutional Server Active on Port ${PORT}`);
    console.log(`[BrainReps] Mode: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer();
