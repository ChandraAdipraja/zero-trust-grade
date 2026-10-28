import { Router } from "express";
import { httpError } from "../constants";
import {
  finalizeClass,
  listGradesForLecturer,
  listGradesForStudent,
  updateGrade,
  updateGradeSchema,
} from "../services/grades.service";
import { syncTranscripts } from "../services/sync.client";
import { asyncHandler } from "../middleware/async-handler";

export const gradesRouter = Router();

gradesRouter.get(
  "/nilai",
  asyncHandler(async (req, res) => {
    const claims = req.auth!;
    if (claims.role === "mahasiswa") {
      const grades = await listGradesForStudent(claims.sub);
      return res.status(200).json({ grades });
    }
    if (claims.role === "dosen") {
      const grades = await listGradesForLecturer(claims.sub);
      return res.status(200).json({ grades });
    }
    throw httpError(403, "Forbidden");
  }),
);

gradesRouter.put(
  "/nilai/:gradeId",
  asyncHandler(async (req, res) => {
    const claims = req.auth!;
    if (claims.role !== "dosen") {
      throw httpError(403, "Forbidden");
    }

    const parsed = updateGradeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Bad request", details: parsed.error.flatten().fieldErrors });
    }

    const updated = await updateGrade(req.params.gradeId, claims.sub, parsed.data.score);
    return res.status(200).json({ grade: updated });
  }),
);

gradesRouter.post(
  "/kelas/:classId/finalisasi",
  asyncHandler(async (req, res) => {
    const claims = req.auth!;
    if (claims.role !== "dosen") {
      throw httpError(403, "Forbidden");
    }

    const studentIds = await finalizeClass(req.params.classId, claims.sub);

    let transcriptSync: "success" | "failed" = "success";
    let syncError: string | null = null;

    if (studentIds.length > 0) {
      try {
        await syncTranscripts(studentIds);
        transcriptSync = "success";
      } catch (err) {
        transcriptSync = "failed";
        syncError = err instanceof Error ? err.message.replaceAll(/\d+\.\d+\.\d+\.\d+:\d+/g, "gateway") : "unknown";
      }
    }

    if (transcriptSync === "failed" && syncError) {
      console.error("[nilai-service] transcript sync failed:", syncError);
    }

    return res.status(200).json({
      message: "Finalisasi kelas berhasil",
      classId: req.params.classId,
      studentsSynced: studentIds.length,
      transcriptSync,
    });
  }),
);
