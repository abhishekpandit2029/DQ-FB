import http from "http";
import { createApp } from "./app";
import { connectDB } from "./config/db";
import { env } from "./config/env";
import { createSocketServer } from "./sockets";

async function bootstrap() {
  await connectDB();
  console.log("[mongo] connected");

  const app = createApp();
  const server = http.createServer(app);

  createSocketServer(server);

  server.listen(env.port, () => {
    console.log(`[server] listening on http://localhost:${env.port}`);
    console.log(`[server] accepting origins: ${env.corsOrigins.join(", ")}`);
  });

  const shutdown = (signal: string) => {
    console.log(`\n[server] ${signal} received, shutting down`);
    server.close(() => process.exit(0));
    // Don't let a stuck connection block the exit forever.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

bootstrap().catch((error) => {
  console.error("[server] failed to start:", error);
  process.exit(1);
});
