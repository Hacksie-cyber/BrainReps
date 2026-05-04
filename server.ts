import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { askHandoutAssistant } from "./src/lib/geminiService";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

async function startServer() {
  const PORT = 3000;

  // Body parser for API routes
  app.use(express.json());

  // API routes
  app.post("/api/ai/ask", async (req, res) => {
    const rawKey = process.env.BRAIN_REPS_API_KEY;
    const hasKey = !!rawKey;
    const keySource = rawKey ? "Environment" : "None";
    const maskedKey = rawKey ? `${rawKey.substring(0, 5)}...${rawKey.substring(rawKey.length - 4)}` : "None";
    
    console.log(`[Neural Server] Processing AI Request. FoundKey: ${hasKey}, Source: ${keySource}, Masked: ${maskedKey}`);
    
    try {
      const { query, sources, history } = req.body;
      if (!query) throw new Error("Query is required");
      
      const response = await askHandoutAssistant(query, sources, history);
      console.log(`[Neural Server] AI Response generated successfully (${response.length} chars)`);
      res.status(200).json({ text: response });
    } catch (error: any) {
      const errorMessage = error.message || "Unknown neural core error";
      const stackLine = error.stack?.split('\n')[0] || "No stack trace";
      
      console.error("[Neural Server] AI Processing Failed:", {
        error: errorMessage,
        stack: error.stack,
        path: req.path,
        env: process.env.NODE_ENV
      });
      
      // Return details to help debugging on external platforms like Vercel
      res.status(500).json({ 
        error: errorMessage,
        details: `Neural sync failed at ${stackLine}. Environment: ${process.env.NODE_ENV || 'unknown'}`
      });
    }
  });

  // Catch-all for API errors (prevents 405 falling through to SPA)
  app.all("/api/*", (req, res) => {
    console.warn(`[Neural Server] Unhandled ${req.method} request to ${req.url}`);
    res.status(404).json({ error: "API route not found or method not allowed" });
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

  // Only listen if not in Vercel environment (where Vercel handles the listener)
  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[BrainReps] Institutional Server Active on Port ${PORT}`);
      console.log(`[BrainReps] Mode: ${process.env.NODE_ENV || 'development'}`);
    });
  }
}

startServer();

export default app;
