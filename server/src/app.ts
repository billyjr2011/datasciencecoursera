import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/error.js";
import authRoutes from "./routes/auth.js";
import catalogRoutes from "./routes/catalog.js";
import consultationRoutes from "./routes/consultations.js";
import userRoutes from "./routes/users.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "256kb" }));

  // Global per-IP throttle.
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.get("/health", (_req, res) => res.json({ status: "ok", uptime: process.uptime() }));

  app.use("/api/auth", authRoutes);
  app.use("/api", catalogRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/consultations", consultationRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
