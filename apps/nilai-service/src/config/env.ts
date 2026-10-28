import { resolve } from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: resolve(process.cwd(), "../../.env") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const readPort = (value: string | undefined, fallback: number): number => {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid port value: ${value}`);
  }
  return parsed;
};

const readUrl = (value: string, name: string): string => {
  try {
    return new URL(value).origin;
  } catch {
    throw new Error(`Invalid URL value for ${name}: ${value}`);
  }
};

export const env = {
  nilaiPort: readPort(process.env.NILAI_PORT, 3001),
  jwtAccessSecret: requireEnv("JWT_ACCESS_SECRET"),
  gatewaySecret: requireEnv("GATEWAY_SECRET"),
  accessTimezone: process.env.ACCESS_TIMEZONE ?? "Asia/Jakarta",
  supabaseUrl: readUrl(requireEnv("SUPABASE_URL"), "SUPABASE_URL"),
  supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  gatewayUrl: readUrl(process.env.GATEWAY_URL ?? "http://localhost:3000", "GATEWAY_URL"),
  serviceClientId: requireEnv("SERVICE_CLIENT_ID"),
  serviceClientSecret: requireEnv("SERVICE_CLIENT_SECRET"),
} as const;
