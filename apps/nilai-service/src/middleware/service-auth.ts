import type { NextFunction, Request, Response } from "express";
import { GATEWAY_SECRET_HEADER } from "../constants";
import { verifyAccessToken } from "../auth/token";
import { env } from "../config/env";
import { asyncHandler } from "./async-handler";

export const requireVerifiedRequest = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const gatewaySecret = req.headers[GATEWAY_SECRET_HEADER];
  if (typeof gatewaySecret !== "string" || gatewaySecret.length === 0 || gatewaySecret !== env.gatewaySecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const claims = verifyAccessToken(header.slice("Bearer ".length));
  if (!claims) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  req.auth = claims;
  return next();
});
