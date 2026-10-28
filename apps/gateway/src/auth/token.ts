import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface TokenClaims {
  sub: string;
  role: string;
}

const TOKEN_ALGORITHM = "HS256";

export function signAccessToken(claims: TokenClaims): string {
  return jwt.sign(claims, env.jwtAccessSecret, {
    algorithm: TOKEN_ALGORITHM,
    expiresIn: env.accessTokenTtlSeconds,
  });
}

export function signServiceToken(clientId: string): string {
  return jwt.sign({ sub: clientId, role: "service" }, env.jwtServiceSecret, {
    algorithm: TOKEN_ALGORITHM,
    expiresIn: env.serviceTokenTtlSeconds,
  });
}

export function verifyAccessToken(token: string): TokenClaims | null {
  try {
    const decoded = jwt.verify(token, env.jwtAccessSecret, { algorithms: [TOKEN_ALGORITHM] });
    if (typeof decoded === "string" || typeof decoded.sub !== "string" || typeof decoded.role !== "string") {
      return null;
    }
    return { sub: decoded.sub, role: decoded.role };
  } catch {
    return null;
  }
}

export function generateRefreshToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(48).toString("base64url");
  return { token, tokenHash: refreshTokenHash(token) };
}

export function refreshTokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function refreshTokenExpiryDate(): Date {
  return new Date(Date.now() + env.refreshTokenTtlSeconds * 1000);
}
