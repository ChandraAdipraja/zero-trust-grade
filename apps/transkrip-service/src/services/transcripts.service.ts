import { supabase } from "../config/supabase";
import { httpError } from "../constants";
import type { TokenClaims } from "../auth/token";

export interface TranscriptItem {
  id: string;
  className: string;
  courseName: string;
  score: number;
  releasedAt: string;
}

export interface TranscriptReadView {
  student: { nim: string; name: string };
  updatedAt: string;
  items: TranscriptItem[];
}

interface UserRow {
  id: string;
  nim: string;
  name: string;
  role: string;
}

interface RawEnrollmentRow {
  classes: { class_name: string; course_name: string } | { class_name: string; course_name: string }[] | null;
  grades: { score: number; is_finalized: boolean } | { score: number; is_finalized: boolean }[] | null;
}

const firstEmbed = <T>(value: T | T[] | null): T | null => {
  if (value === null) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
};

interface SyncStudentResult {
  studentId: string;
  nim: string;
  itemCount: number;
}

interface SyncSkipped {
  studentId: string;
  reason: string;
}

export async function readTranscript(nim: string, claims: TokenClaims): Promise<TranscriptReadView> {
  if (claims.role !== "mahasiswa" && claims.role !== "admin") {
    throw httpError(403, "Forbidden");
  }

  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("id, nim, name, role")
    .eq("nim", nim)
    .maybeSingle();

  if (userError) throw httpError(500, "Failed to fetch user");
  const user = userRow as UserRow | null;
  if (!user) throw httpError(404, "Transcript not found");

  if (claims.role === "mahasiswa" && (claims.sub !== user.id || user.role !== "mahasiswa")) {
    throw httpError(403, "Forbidden");
  }

  const { data: transcriptRow, error: transcriptError } = await supabase
    .from("transcripts")
    .select("id, updated_at")
    .eq("student_id", user.id)
    .maybeSingle();

  if (transcriptError) throw httpError(500, "Failed to fetch transcript");
  const transcript = transcriptRow as { id: string; updated_at: string } | null;
  if (!transcript) throw httpError(404, "Transcript not found");

  const { data: items, error: itemsError } = await supabase
    .from("transcript_items")
    .select("id, class_name, course_name, score, released_at")
    .eq("transcript_id", transcript.id)
    .order("class_name", { ascending: true })
    .order("course_name", { ascending: true });

  if (itemsError) throw httpError(500, "Failed to fetch transcript items");

  return {
    student: { nim: user.nim, name: user.name },
    updatedAt: transcript.updated_at,
    items: (items ?? []).map((item) => ({
      id: item.id,
      className: item.class_name,
      courseName: item.course_name,
      score: item.score,
      releasedAt: item.released_at,
    })),
  };
}

const UUID_GAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function syncTranscripts(studentIds: string[]): Promise<{
  synced: SyncStudentResult[];
  skipped: SyncSkipped[];
}> {
  const synced: SyncStudentResult[] = [];
  const skipped: SyncSkipped[] = [];
  const now = new Date().toISOString();

  for (const studentId of studentIds) {
    if (!UUID_GAME.test(studentId)) {
      skipped.push({ studentId, reason: "invalid student id" });
      continue;
    }

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("id, nim, name, role")
      .eq("id", studentId)
      .maybeSingle();

    if (userError) throw httpError(500, "Failed to fetch student");
    const user = userRow as UserRow | null;
    if (!user || user.role !== "mahasiswa") {
      skipped.push({ studentId, reason: "student not found" });
      continue;
    }

    const { data: enrollmentRows, error: enrollmentError } = await supabase
      .from("enrollments")
      .select("classes(class_name, course_name), grades(score, is_finalized)")
      .eq("student_id", studentId);

    if (enrollmentError) throw httpError(500, "Failed to fetch enrollments");

    const items = (enrollmentRows as unknown as RawEnrollmentRow[] | null ?? [])
      .map((row) => ({ classes: firstEmbed(row.classes), grades: firstEmbed(row.grades) }))
      .filter((row) => row.grades?.is_finalized === true)
      .map((row) => ({
        class_name: row.classes?.class_name ?? "",
        course_name: row.classes?.course_name ?? "",
        score: row.grades?.score ?? 0,
        released_at: now,
      }));

    if (items.length === 0) {
      skipped.push({ studentId, reason: "no finalized grades" });
      continue;
    }

    const { data: transcriptRow, error: transcriptError } = await supabase
      .from("transcripts")
      .upsert(
        { student_id: studentId, updated_at: now },
        { onConflict: "student_id" },
      )
      .select("id")
      .single();

    if (transcriptError) throw httpError(500, "Failed to upsert transcript");
    const transcriptId = (transcriptRow as { id: string }).id;

    const { error: deleteError } = await supabase
      .from("transcript_items")
      .delete()
      .eq("transcript_id", transcriptId);

    if (deleteError) throw httpError(500, "Failed to replace transcript items");

    const { error: insertError } = await supabase
      .from("transcript_items")
      .insert(items.map((item) => ({ ...item, transcript_id: transcriptId })));

    if (insertError) throw httpError(500, "Failed to insert transcript items");

    synced.push({ studentId, nim: user.nim, itemCount: items.length });
  }

  return { synced, skipped };
}
