import { z } from "zod";
import { supabase } from "../config/supabase";
import { httpError } from "../constants";

export interface GradeView {
  gradeId: string;
  score: number | null;
  gradeFinalized: boolean;
  classId: string;
  className: string;
  courseName: string;
  classFinalized: boolean;
  studentName: string;
  studentNim: string | null;
}

interface EnrollmentRow {
  id: string;
  users: { name: string; nim: string | null } | { name: string; nim: string | null }[];
  classes: {
    id: string;
    class_name: string;
    course_name: string;
    is_finalized: boolean;
  } | {
    id: string;
    class_name: string;
    course_name: string;
    is_finalized: boolean;
  }[];
  grades: {
    id: string;
    score: number | null;
    is_finalized: boolean;
  } | {
    id: string;
    score: number | null;
    is_finalized: boolean;
  }[];
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function mapEnrollment(row: EnrollmentRow): GradeView | null {
  const kelas = one(row.classes);
  const grade = one(row.grades);
  const student = one(row.users);
  if (!kelas || !grade || !student) return null;
  return {
    gradeId: grade.id,
    score: grade.score,
    gradeFinalized: grade.is_finalized,
    classId: kelas.id,
    className: kelas.class_name,
    courseName: kelas.course_name,
    classFinalized: kelas.is_finalized,
    studentName: student.name,
    studentNim: student.nim,
  };
}

async function fetchEnrollmentsByClassIds(classIds: string[]): Promise<GradeView[]> {
  const { data, error } = await supabase
    .from("enrollments")
    .select("users(name, nim), classes(id, class_name, course_name, is_finalized), grades(id, score, is_finalized)")
    .in("class_id", classIds);

  if (error) {
    throw httpError(500, "Failed to fetch grades");
  }
  return (data as EnrollmentRow[])
    .map(mapEnrollment)
    .filter((item): item is GradeView => item !== null);
}

export async function listGradesForStudent(studentId: string): Promise<GradeView[]> {
  const { data, error } = await supabase
    .from("enrollments")
    .select("users(name, nim), classes(id, class_name, course_name, is_finalized), grades(id, score, is_finalized)")
    .eq("student_id", studentId);

  if (error) {
    throw httpError(500, "Failed to fetch enrollments");
  }

  return (data as EnrollmentRow[])
    .map(mapEnrollment)
    .filter((item): item is GradeView => item !== null);
}

export async function listGradesForLecturer(lecturerId: string): Promise<GradeView[]> {
  const { data: classes, error } = await supabase
    .from("classes")
    .select("id")
    .eq("lecturer_id", lecturerId);

  if (error) {
    throw httpError(500, "Failed to fetch classes");
  }

  const classIds = classes.map((row) => row.id);
  if (classIds.length === 0) return [];
  return fetchEnrollmentsByClassIds(classIds);
}

export const updateGradeSchema = z.object({
  score: z.number().min(0).max(100),
});

export async function updateGrade(gradeId: string, lecturerId: string, score: number): Promise<GradeView> {
  const { data: gradeRow, error: gradeError } = await supabase
    .from("grades")
    .select("id, score, is_finalized, enrollments(student_id, classes(id, lecturer_id, is_finalized))")
    .eq("id", gradeId)
    .maybeSingle();

  if (gradeError) {
    throw httpError(500, "Failed to fetch grade");
  }
  if (!gradeRow) {
    throw httpError(404, "Grade not found");
  }

  const enrollment = one(gradeRow.enrollments as Record<string, unknown> | Record<string, unknown>[] | null);
  if (!enrollment) {
    throw httpError(404, "Grade is not linked to any enrollment");
  }

  const kelas = one(enrollment.classes as Record<string, unknown> | Record<string, unknown>[] | null);
  if (!kelas) {
    throw httpError(404, "Grade is not linked to any class");
  }

  if (kelas.lecturer_id !== lecturerId) {
    throw httpError(403, "Forbidden");
  }
  if (gradeRow.is_finalized || kelas.is_finalized) {
    throw httpError(409, "Grade is already finalized");
  }

  const { data: updatedGrade, error: updateError } = await supabase
    .from("grades")
    .update({ score, updated_at: new Date().toISOString() })
    .eq("id", gradeId)
    .select("id, score, is_finalized")
    .single();

  if (updateError || !updatedGrade) {
    throw httpError(500, "Failed to update grade");
  }

  const studentId = enrollment.student_id as string;
  const { data: student, error: studentError } = await supabase
    .from("users")
    .select("name, nim")
    .eq("id", studentId)
    .maybeSingle();

  if (studentError || !student) {
    throw httpError(500, "Failed to fetch student");
  }

  return {
    gradeId: updatedGrade.id,
    score: updatedGrade.score,
    gradeFinalized: updatedGrade.is_finalized,
    classId: kelas.id as string,
    className: kelas.class_name as string,
    courseName: kelas.course_name as string,
    classFinalized: kelas.is_finalized as boolean,
    studentName: student.name,
    studentNim: student.nim,
  };
}

export async function finalizeClass(classId: string, lecturerId: string): Promise<string[]> {
  const { data: kelas, error: classError } = await supabase
    .from("classes")
    .select("id, lecturer_id, is_finalized")
    .eq("id", classId)
    .maybeSingle();

  if (classError) {
    throw httpError(500, "Failed to fetch class");
  }
  if (!kelas) {
    throw httpError(404, "Class not found");
  }
  if (kelas.lecturer_id !== lecturerId) {
    throw httpError(403, "Forbidden");
  }
  if (kelas.is_finalized) {
    throw httpError(409, "Class is already finalized");
  }

  const now = new Date().toISOString();
  const { data: enrollments, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("id, student_id")
    .eq("class_id", classId);

  if (enrollmentError || !enrollments) {
    throw httpError(500, "Failed to fetch enrollments");
  }

  if (enrollments.length > 0) {
    const enrollmentIds = enrollments.map((row) => row.id);
    const { error: gradesError } = await supabase
      .from("grades")
      .update({ is_finalized: true, updated_at: now })
      .in("enrollment_id", enrollmentIds)
      .eq("is_finalized", false);

    if (gradesError) {
      throw httpError(500, "Failed to finalize grades");
    }
  }

  const { data: finalizedClass, error: finalizeError } = await supabase
    .from("classes")
    .update({ is_finalized: true, finalized_at: now })
    .eq("id", classId)
    .select("id, is_finalized")
    .single();

  if (finalizeError || !finalizedClass) {
    throw httpError(500, "Failed to finalize class");
  }

  return enrollments.map((row) => row.student_id);
}
