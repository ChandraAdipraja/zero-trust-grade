import jwt from "jsonwebtoken";
import { env } from "../config/env";

const ACCESS_ALGORITHM = "HS256";

export interface TokenClaims {
  sub: string;
  role: string;
}

export function verifyAccessToken(token: string): TokenClaims | null {
  try {
    const decoded = jwt.verify(token, env.jwtAccessSecret, { algorithms: [ACCESS_ALGORITHM] });
    if (typeof decoded === "string" || typeof decoded.sub !== "string" || typeof decoded.role !== "string") {
      return null;
    }
    return { sub: decoded.sub, role: decoded.role };
  } catch {
    return null;
  }
}
