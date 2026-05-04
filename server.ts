import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { askHandoutAssistant } from "./src/lib/geminiService";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json({ limit: "10mb" }));

// ✅ CORS headers for all routes (fixes preflight failures on Vercel)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ✅ Health check
app.get("/api/health", (_req, res) => {
  const hasKey = !!(process.env.BRAIN_REPS_API_KEY || process.env.GEMINI_API_KEY);
  res.json({
    status: "ok",
    keyConfigured: hasKey,
    env: process.env.NODE_ENV || "development",
  });
});

// ✅ Main AI route
app.post("/api/ai/ask", async (req, res) => {
  const apiKey = process.env.BRAIN_REPS_API_KEY || process.env.GEMINI_API_KEY;
  const nodeEnv = process.env.NODE_ENV || "development";

  console.log(`[BrainReps] AI request received. Env: ${nodeEnv}. KeyConfigured: ${!!apiKey}`);

  // ✅ Validate API key early — prevents cryptic Gemini auth crashes
  if (!apiKey) {
    return res.status(500).json({
      error: "API Key Not Configured",
      details:
        "Neither BRAIN_REPS_API_KEY nor GEMINI_API_KEY is set. " +
        "Go to Vercel Dashboard → Settings → Environment Variables, add the key, and redeploy.",
    });
  }

  // ✅ Validate request body
  const { query, sources, history } = req.body;
  if (!query || typeof query !== "string") {
    return res.status(400).json({
      error: "Bad Request",
      details: "'query' is required and must be a non-empty string.",
    });
  }

  try {
    const response = await askHandoutAssistant(query, sources ?? [], history ?? []);
    return res.status(200).json({ text: response });
  } catch (error: any) {
    console.error("[BrainReps] askHandoutAssistant failed:", error);
    return res.status(500).json({
      error: error.message || "AI processing failed.",
      details: `Environment: ${nodeEnv}`,
    });
  }
});

// ✅ Static + SPA fallback (only in prod/Vercel)
async function setupStaticMiddleware() {
  const isVercel = !!process.env.VERCEL;
  const isProd = process.env.NODE_ENV === "production";

  if (!isProd && !isVercel) {
    // ── Development: use Vite middleware ──
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });

      app.use(vite.middlewares);

      app.use(async (req, res, next) => {
        // Don't intercept API routes
        if (req.path.startsWith("/api")) return next();
        if (res.headersSent) return;

        try {
          const indexHtml = await fs.readFile(
            path.resolve(__dirname, "index.html"),
            "utf-8"
          );
          const transformed = await vite.transformIndexHtml(
            req.originalUrl,
            indexHtml
          );
          res.status(200).set("Content-Type", "text/html").end(transformed);
        } catch (e) {
          vite.ssrFixStacktrace(e as Error);
          next(e);
        }
      });

      console.log("[BrainReps] Vite dev middleware active.");
    } catch (err) {
      console.warn("[BrainReps] Vite failed to load:", err);
    }
  } else {
    // ── Production / Vercel: serve built dist ──
    const distPath = path.resolve(process.cwd(), "dist");

    app.use(express.static(distPath));

    app.use(async (req, res, next) => {
      // Don't intercept API routes
      if (req.path.startsWith("/api")) return next();
      if (res.headersSent) return;

      try {
        const indexPath = path.resolve(distPath, "index.html");
        await fs.access(indexPath); // throws if file doesn't exist
        return res.sendFile(indexPath);
      } catch {
        return res
          .status(404)
          .send(
            "App not built. Run 'npm run build' and redeploy."
          );
      }
    });

    console.log("[BrainReps] Serving static build from /dist.");
  }
}

// ✅ Boot
setupStaticMiddleware().then(() => {
  // Only bind a port when NOT on Vercel (Vercel uses export default app)
  if (!process.env.VERCEL && process.env.NODE_ENV !== "test") {
    const PORT = Number(process.env.PORT || 3000);
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[BrainReps] Server running → http://localhost:${PORT}`);
    });
  }
});

// ✅ Required for Vercel serverless
export default app;