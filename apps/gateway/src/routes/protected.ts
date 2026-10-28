import { Router } from "express";
import { env } from "../config/env";
import { authenticate } from "../middleware/authenticate";
import { requireDevice } from "../middleware/require-device";
import { pep } from "../middleware/pep";
import { requireServiceToken } from "../middleware/service-auth";
import { asyncHandler } from "../middleware/async-handler";
import {
  evaluateAudit,
  evaluateFinalisasi,
  evaluateNilaiList,
  evaluateNilaiUpdate,
  evaluateTranskripRead,
  evaluateTranskripSync,
} from "../policy/policy";
import { forwardTo } from "../proxy/proxy";
import { supabase } from "../config/supabase";

export const protectedRouter = Router();

protectedRouter.get(
  "/nilai",
  authenticate,
  requireDevice,
  pep(evaluateNilaiList),
  forwardTo(env.nilaiServiceUrl),
);

protectedRouter.put(
  "/nilai/:gradeId",
  authenticate,
  requireDevice,
  pep(evaluateNilaiUpdate),
  forwardTo(env.nilaiServiceUrl),
);

protectedRouter.post(
  "/kelas/:classId/finalisasi",
  authenticate,
  requireDevice,
  pep(evaluateFinalisasi),
  forwardTo(env.nilaiServiceUrl),
);

protectedRouter.get(
  "/transkrip/:nim",
  authenticate,
  requireDevice,
  pep(evaluateTranskripRead),
  forwardTo(env.transkripServiceUrl),
);

protectedRouter.post(
  "/transkrip/sinkron",
  requireServiceToken,
  pep(evaluateTranskripSync),
  forwardTo(env.transkripServiceUrl),
);

protectedRouter.get(
  "/audit",
  authenticate,
  requireDevice,
  pep(evaluateAudit),
  asyncHandler(async (_req, res) => {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, timestamp, subject, subject_role, endpoint, http_method, device_id, decision, reason")
      .order("timestamp", { ascending: false })
      .limit(200);

    if (error) {
      res.status(500).json({ error: "Internal server error" });
      return;
    }
    res.json({ entries: data });
  }),
);
