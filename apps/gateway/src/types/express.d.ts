import type { TokenClaims } from "../auth/token";

declare global {
  namespace Express {
    interface Request {
      auth?: TokenClaims;
    }
  }
}

export {};
