import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middleware/async-handler";
import { requireServiceRequest, requireVerifiedRequest } from "../middleware/service-auth";
import { readTranscript, syncTranscripts } from "../services/transcripts.service";

export const transcriptsRouter = Router();

const syncSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1).max(100),
});

transcriptsRouter.get(
  "/transkrip/:nim",
  requireVerifiedRequest,
  asyncHandler(async (req, res) => {
    const transcript = await readTranscript(req.params.nim, req.auth!);
    return res.status(200).json(transcript);
  }),
);

transcriptsRouter.post(
  "/transkrip/sinkron",
  requireServiceRequest,
  asyncHandler(async (req, res) => {
    const parsed = syncSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Bad request", details: parsed.error.flatten().fieldErrors });
    }

    const result = await syncTranscripts(parsed.data.studentIds);
    return res.status(200).json({
      message: "Sinkronisasi transkrip selesai",
      clientId: req.auth!.sub,
      synced: result.synced,
      skipped: result.skipped,
    });
  }),
);
