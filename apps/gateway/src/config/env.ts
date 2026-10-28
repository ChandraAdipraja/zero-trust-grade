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

const readTtlSeconds = (value: string | undefined, name: string, fallbackSeconds: number): number => {
  if (value === undefined || value.trim() === "") return fallbackSeconds;
  const match = value.trim().match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid TTL value for ${name}: ${value} (expected e.g. 10m, 1d, 300s)`);
  }
  const amount = Number.parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return amount * multipliers[unit];
};

export const env = {
  gatewayPort: readPort(process.env.GATEWAY_PORT, 3000),
  jwtAccessSecret: requireEnv("JWT_ACCESS_SECRET"),
  jwtServiceSecret: requireEnv("JWT_SERVICE_SECRET"),
  gatewaySecret: requireEnv("GATEWAY_SECRET"),
  accessTokenTtlSeconds: readTtlSeconds(process.env.ACCESS_TOKEN_TTL, "ACCESS_TOKEN_TTL", 600),
  refreshTokenTtlSeconds: readTtlSeconds(process.env.REFRESH_TOKEN_TTL, "REFRESH_TOKEN_TTL", 86400),
  serviceTokenTtlSeconds: readTtlSeconds(process.env.SERVICE_TOKEN_TTL, "SERVICE_TOKEN_TTL", 300),
  accessTimezone: process.env.ACCESS_TIMEZONE ?? "Asia/Jakarta",
  supabaseUrl: readUrl(requireEnv("SUPABASE_URL"), "SUPABASE_URL"),
  supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  nilaiServiceUrl: readUrl(process.env.NILAI_SERVICE_URL ?? "http://localhost:3001", "NILAI_SERVICE_URL"),
  transkripServiceUrl: readUrl(process.env.TRANSKRIP_SERVICE_URL ?? "http://localhost:3002", "TRANSKRIP_SERVICE_URL"),
} as const;
