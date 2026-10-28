import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { GATEWAY_SECRET_HEADER, httpError } from "../constants";
import { verifyAccessToken, verifyServiceToken } from "../auth/token";

const bearerToken = (req: Request): string | null => {
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token === "" ? null : token;
};

export function requireVerifiedRequest(req: Request, _res: Response, next: NextFunction): void {
  if (req.headers[GATEWAY_SECRET_HEADER] !== env.gatewaySecret) {
    return next(httpError(401, "Unauthorized"));
  }
  const token = bearerToken(req);
  if (!token) {
    return next(httpError(401, "Unauthorized"));
  }
  const claims = verifyAccessToken(token);
  if (!claims) {
    return next(httpError(401, "Unauthorized"));
  }
  req.auth = claims;
  next();
}

export function requireServiceRequest(req: Request, _res: Response, next: NextFunction): void {
  if (req.headers[GATEWAY_SECRET_HEADER] !== env.gatewaySecret) {
    return next(httpError(401, "Unauthorized"));
  }
  const token = bearerToken(req);
  if (!token) {
    return next(httpError(401, "Unauthorized"));
  }
  const claims = verifyServiceToken(token);
  if (!claims) {
    return next(httpError(401, "Unauthorized"));
  }
  req.auth = claims;
  next();
}
