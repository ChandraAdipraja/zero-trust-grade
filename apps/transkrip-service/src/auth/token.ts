import jwt from "jsonwebtoken";
import { env } from "../config/env";

const ALGORITHM = "HS256";

export interface TokenClaims {
  sub: string;
  role: string;
}

interface DecodedPayload {
  sub?: string;
  role?: string;
}

export function verifyAccessToken(token: string): TokenClaims | null {
  try {
    const decoded = jwt.verify(token, env.jwtAccessSecret, { algorithms: [ALGORITHM] }) as DecodedPayload;
    if (typeof decoded?.sub !== "string" || typeof decoded?.role !== "string") return null;
    return { sub: decoded.sub, role: decoded.role };
  } catch {
    return null;
  }
}

export function verifyServiceToken(token: string): TokenClaims | null {
  try {
    const decoded = jwt.verify(token, env.jwtServiceSecret, { algorithms: [ALGORITHM] }) as DecodedPayload;
    if (typeof decoded?.sub !== "string" || decoded?.role !== "service") return null;
    return { sub: decoded.sub, role: "service" };
  } catch {
    return null;
  }
}
