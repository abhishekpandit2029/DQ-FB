import mongoose from "mongoose";
import { env } from "./env";

let connecting: Promise<typeof mongoose> | null = null;

export async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!connecting) {
    mongoose.set("strictQuery", true);
    connecting = mongoose.connect(env.mongoUri);
  }
  await connecting;
  return mongoose;
}

mongoose.connection.on("error", (err) => {
  console.error("[mongo] connection error:", err.message);
});

mongoose.connection.on("disconnected", () => {
  console.warn("[mongo] disconnected");
});
