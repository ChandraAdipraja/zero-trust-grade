import type { Response } from "express";
import { supabase } from "../config/supabase";
import { DEVICE_ID_HEADER } from "../policy/constants";
import { newRequestId, writeAudit } from "../audit/audit";
import { asyncHandler } from "./async-handler";

export const requireDevice = asyncHandler(async (req, res, next) => {
  const claims = req.auth!;
  const requestId = newRequestId(req);
  const deviceId = (req.headers[DEVICE_ID_HEADER] as string | undefined) ?? null;

  const deny = async (reason: string): Promise<Response> => {
    await writeAudit({
      subject: claims.sub,
      subjectRole: claims.role,
      endpoint: req.originalUrl,
      httpMethod: req.method,
      deviceId,
      decision: "deny",
      reason,
      requestId,
    });
    return res.status(401).json({ error: "Unauthorized" });
  };

  if (!deviceId) {
    return deny(`DENY: missing ${DEVICE_ID_HEADER} header`);
  }

  const { data: device, error } = await supabase
    .from("devices")
    .select("id")
    .eq("id", deviceId)
    .eq("user_id", claims.sub)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !device) {
    return deny("DENY: device is not registered to this user or is inactive");
  }

  return next();
});
