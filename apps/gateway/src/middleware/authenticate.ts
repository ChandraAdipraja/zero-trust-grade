import type { Response } from "express";
import { verifyAccessToken } from "../auth/token";
import { newRequestId, writeAudit } from "../audit/audit";
import { asyncHandler } from "./async-handler";

export const authenticate = asyncHandler(async (req, res, next) => {
  const requestId = newRequestId(req);
  const endpoint = req.originalUrl;
  const httpMethod = req.method;

  const deny = async (reason: string): Promise<Response> => {
    await writeAudit({
      subject: "anonymous",
      subjectRole: null,
      endpoint,
      httpMethod,
      deviceId: null,
      decision: "deny",
      reason,
      requestId,
    });
    return res.status(401).json({ error: "Unauthorized" });
  };

  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return deny("DENY: missing access token");
  }

  const claims = verifyAccessToken(header.slice("Bearer ".length));
  if (!claims) {
    return deny("DENY: invalid or expired access token");
  }

  req.auth = claims;
  return next();
});
