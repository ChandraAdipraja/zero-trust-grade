import type { Request } from "express";
import { supabase } from "../config/supabase";
import { isWithinAccessWindow } from "./window";

export interface PolicyContext {
  now: Date;
}

export interface PolicyOutcome {
  allowed: boolean;
  reason: string;
}

const allow = (reason: string): PolicyOutcome => ({ allowed: true, reason });
const deny = (reason: string): PolicyOutcome => ({ allowed: false, reason });

type NestedValue = Record<string, unknown> | Array<Record<string, unknown>> | null | undefined;

function firstOf(value: NestedValue): Record<string, unknown> | null {
  if (Array.isArray(value)) return value[0] ?? null;
  if (value && typeof value === "object") return value;
  return null;
}

export async function evaluateNilaiList(req: Request): Promise<PolicyOutcome> {
  const claims = req.auth!;
  if (claims.role === "mahasiswa") {
    return allow("ALLOW: mahasiswa reading own grades");
  }
  if (claims.role === "dosen") {
    return allow("ALLOW: dosen reading grades of taught classes");
  }
  return deny("DENY: role has no access to grade lists");
}

export async function evaluateNilaiUpdate(req: Request): Promise<PolicyOutcome> {
  const claims = req.auth!;
  if (claims.role !== "dosen") {
    return deny("DENY: only dosen can update grades");
  }

  const gradeId = req.params.gradeId;
  const { data, error } = await supabase
    .from("grades")
    .select(
      "id, score, is_finalized, enrollments(class_id, students:student_id, classes(id, lecturer_id, is_finalized))",
    )
    .eq("id", gradeId)
    .maybeSingle();

  if (error || !data) {
    return deny(`DENY: grade not found for update (${error?.message ?? "unknown id"})`);
  }

  const enrollment = firstOf(data.enrollments as NestedValue);
  const kelas = firstOf(enrollment?.classes as NestedValue);

  if (!enrollment || !kelas) {
    return deny("DENY: grade is not linked to any class");
  }

  if (kelas.lecturer_id !== claims.sub) {
    return deny("DENY: lecturer does not teach the requested class");
  }

  if (data.is_finalized || kelas.is_finalized) {
    return deny("DENY: grade is already finalized");
  }

  if (!isWithinAccessWindow(new Date())) {
    return deny("DENY: request outside permitted hours");
  }

  return allow("ALLOW: authenticated dosen, owns class, grade not finalized, within hours");
}

export async function evaluateFinalisasi(req: Request): Promise<PolicyOutcome> {
  const claims = req.auth!;
  if (claims.role !== "dosen") {
    return deny("DENY: only dosen can finalize a class");
  }

  const classId = req.params.classId;
  const { data: kelas, error } = await supabase
    .from("classes")
    .select("id, lecturer_id, is_finalized")
    .eq("id", classId)
    .maybeSingle();

  if (error || !kelas) {
    return deny("DENY: class not found for finalization");
  }

  if (kelas.lecturer_id !== claims.sub) {
    return deny("DENY: lecturer does not teach the requested class");
  }

  if (kelas.is_finalized) {
    return deny("DENY: class is already finalized");
  }

  if (!isWithinAccessWindow(new Date())) {
    return deny("DENY: request outside permitted hours");
  }

  return allow("ALLOW: authenticated dosen, owns class, class not finalized, within hours");
}

export async function evaluateTranskripRead(req: Request): Promise<PolicyOutcome> {
  const claims = req.auth!;
  const nim = req.params.nim;

  if (claims.role === "admin") {
    return allow("ALLOW: admin may read all transcripts");
  }

  if (claims.role === "dosen") {
    return deny("DENY: dosen is not permitted to read all transcripts");
  }

  if (claims.role === "mahasiswa") {
    const { data: user, error } = await supabase
      .from("users")
      .select("id, nim, role")
      .eq("id", claims.sub)
      .maybeSingle();

    if (error || !user) {
      return deny("DENY: authenticated user not found");
    }

    if (user.nim !== nim) {
      return deny("DENY: student attempted to access another student's transcript");
    }

    return allow("ALLOW: mahasiswa reading own transcript");
  }

  return deny("DENY: role has no access to transcripts");
}

export async function evaluateTranskripSync(req: Request): Promise<PolicyOutcome> {
  const claims = req.auth!;
  const { data: client, error } = await supabase
    .from("service_clients")
    .select("id, is_active")
    .eq("client_id", claims.sub)
    .maybeSingle();

  if (error || !client || !client.is_active) {
    return deny("DENY: service client not recognized");
  }

  return allow("ALLOW: valid service token for grade sync");
}

export async function evaluateAudit(req: Request): Promise<PolicyOutcome> {
  const claims = req.auth!;
  if (claims.role !== "admin") {
    return deny("DENY: only admin may read the audit log");
  }
  return allow("ALLOW: admin reading audit log");
}

