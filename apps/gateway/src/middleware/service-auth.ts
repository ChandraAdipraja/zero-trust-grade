import type { Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { newRequestId, writeAudit } from "../audit/audit";
import { asyncHandler } from "./async-handler";

export const requireServiceToken = asyncHandler(async (req, res, next) => {
  const requestId = newRequestId(req);
  const endpoint = req.originalUrl;
  const httpMethod = req.method;

  const deny = (reason: string): Promise<Response> => {
    const write = writeAudit({
      subject: "anonymous",
      subjectRole: "service",
      endpoint,
      httpMethod,
      deviceId: null,
      decision: "deny",
      reason,
      requestId,
    });
    return write.then(() => res.status(401).json({ error: "Unauthorized" }));
  };

  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return deny("DENY: missing service token");
  }

  try {
    const decoded = jwt.verify(header.slice("Bearer ".length), env.jwtServiceSecret, {
      algorithms: ["HS256"],
    });
    if (typeof decoded === "string" || typeof decoded.sub !== "string" || decoded.role !== "service") {
      return deny("DENY: invalid service token");
    }
    req.auth = { sub: decoded.sub, role: "service" };
    return next();
  } catch {
    return deny("DENY: invalid or expired service token");
  }
});
