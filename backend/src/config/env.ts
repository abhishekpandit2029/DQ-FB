import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
  port: Number(optional("PORT", "5000")),

  mongoUri: required("MONGO_URI"),
  tokenSecret: required("TOKEN_SECRET"),
  tokenExpiry: optional("TOKEN_EXPIRY", "7d"),

  // Comma separated list of allowed browser origins.
  corsOrigins: optional("CORS_ORIGINS", "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),

  cookieDomain: optional("COOKIE_DOMAIN"),

  email: {
    user: optional("EMAIL_USER"),
    pass: optional("EMAIL_PASS"),
  },

  cloudinary: {
    cloudName: optional("CLOUD_NAME"),
    apiKey: optional("CLOUDINARY_API_KEY"),
    apiSecret: optional("CLOUDINARY_API_SECRET"),
  },
};

export const isProduction = env.nodeEnv === "production";
