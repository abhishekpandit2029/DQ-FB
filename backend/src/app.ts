import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env, isProduction } from "./config/env";
import routes from "./routes";
import { errorHandler, notFound } from "./middleware/error";

export function createApp() {
  const app = express();

  // Required for secure cookies and correct client IPs behind a proxy/CDN.
  app.set("trust proxy", 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin and server-to-server calls arrive without an Origin.
        if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    })
  );

  // Profile photos arrive as base64 data URLs, so the default 100kb is too low.
  app.use(express.json({ limit: "8mb" }));
  app.use(express.urlencoded({ extended: true, limit: "8mb" }));
  app.use(cookieParser());

  if (!isProduction) app.use(morgan("dev"));

  app.use("/api", routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
