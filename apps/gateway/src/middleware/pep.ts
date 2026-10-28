import type { NextFunction, Request, Response } from "express";
import { newRequestId, writeAudit } from "../audit/audit";
import type { PolicyOutcome } from "../policy/policy";
import { asyncHandler } from "./async-handler";

type PolicyEvaluator = (req: Request) => PolicyOutcome | Promise<PolicyOutcome>;

export function pep(evaluate: PolicyEvaluator) {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const claims = req.auth!;
    const policyOutcome = await evaluate(req);

    await writeAudit({
      subject: claims.sub,
      subjectRole: claims.role,
      endpoint: req.originalUrl,
      httpMethod: req.method,
      deviceId: (req.headers["x-device-id"] as string | undefined) ?? null,
      decision: policyOutcome.allowed ? "allow" : "deny",
      reason: policyOutcome.reason,
      requestId: newRequestId(req),
    });

    if (!policyOutcome.allowed) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    next();
  });
}
