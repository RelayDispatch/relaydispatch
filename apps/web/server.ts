import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.WEB_PORT ?? "3000", 10);

  // Enable trust proxy for correct IP resolution behind reverse proxies
  app.set("trust proxy", 1);

  // Global rate limiting middleware
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "900000", 10),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? "1000", 10),
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "Too many requests",
      message: "Too many requests from this IP, please try again later."
    }
  });

  app.use(limiter);
  app.use(express.json());

  // In development, spin up Vite dev middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve built static files from dist
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, () => {
    console.log(`🚀 Web app running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start dev server:", err);
  process.exit(1);
});
