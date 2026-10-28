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
  transkripPort: readPort(process.env.TRANSKRIP_PORT, 3002),
  jwtAccessSecret: requireEnv("JWT_ACCESS_SECRET"),
  jwtServiceSecret: requireEnv("JWT_SERVICE_SECRET"),
  gatewaySecret: requireEnv("GATEWAY_SECRET"),
  supabaseUrl: readUrl(requireEnv("SUPABASE_URL"), "SUPABASE_URL"),
  supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
} as const;
