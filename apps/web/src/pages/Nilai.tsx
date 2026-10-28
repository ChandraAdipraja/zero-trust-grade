import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Banner } from "../components/Banner";
import { Stamp } from "../components/Stamp";
import { ApiError } from "../lib/api";
import { wibParts, withinAccessWindow } from "../lib/format";

interface GradeView {
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

interface EditState {
  gradeId: string;
  value: string;
  error: string | null;
  busy: boolean;
}

interface FinalizeState {
  classId: string;
  confirming: boolean;
  busy: boolean;
}

function groupedByClass(grades: GradeView[]): { id: string; className: string; courseName: string; classFinalized: boolean; rows: GradeView[] }[] {
  const map = new Map<string, { className: string; courseName: string; classFinalized: boolean; rows: GradeView[] }>();
  for (const grade of grades) {
    const existing = map.get(grade.classId);
    if (existing) existing.rows.push(grade);
    else
      map.set(grade.classId, {
        className: grade.className,
        courseName: grade.courseName,
        classFinalized: grade.classFinalized,
        rows: [grade],
      });
  }
  return [...map.entries()].map(([id, group]) => ({ id, ...group }));
}

export function Nilai() {
  const { session, request } = useAuth();
  const navigate = useNavigate();

  const [grades, setGrades] = useState<GradeView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [rowNotice, setRowNotice] = useState<{ tone: "seal" | "void"; text: string } | null>(null);
  const [finalize, setFinalize] = useState<FinalizeState | null>(null);
  const [finalizedBanner, setFinalizedBanner] = useState<{ tone: "seal" | "void"; title: string; body: string } | null>(null);
  const [windowSnapshot] = useState(() => withinAccessWindow());

  useEffect(() => {
    if (!withinAccessWindow()) document.title = "Sistem Nilai — di luar jendela akses";
  }, []);

  const refresh = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await request<{ grades: GradeView[] }>("GET", "/nilai");
      setGrades(data.grades);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        navigate("/", { replace: true });
        return;
      }
      setLoadError(err instanceof Error ? err.message : "Gagal memuat daftar nilai.");
    }
  }, [request, navigate]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const role = session?.user.role;
  const classGroups = useMemo(() => (grades ? groupedByClass(grades) : []), [grades]);

  if (role !== "mahasiswa" && role !== "dosen") {
    return <Navigate to="/" replace />;
  }

  const simpanNilai = async (grade: GradeView) => {
    if (!edit || edit.gradeId !== grade.gradeId) return;
    const parsed = Number(edit.value);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
      setEdit({ ...edit, error: "Angka nilai harus tetap di rentang 0–100." });
      return;
    }
    setEdit({ ...edit, busy: true, error: null });
    try {
      await request("PUT", `/nilai/${grade.gradeId}`, { score: parsed });
      setEdit(null);
      setRowNotice({ tone: "seal", text: `Nilai ${grade.studentNim} diubah menjadi ${parsed}.` });
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Penyimpanan ditolak.";
      setEdit({ ...edit, busy: false, error: message === "Forbidden" ? "Perubahan ditolak kebijakan (kelas tersegel atau bukan kelas Anda)." : message });
    }
  };

  const finalisasiKelas = async (classGroup: { id: string; className: string; rows: GradeView[] }) => {
    setFinalize({ classId: classGroup.id, confirming: false, busy: true });
    try {
      const data = await request<{ transcriptSync: string; studentsSynced: number }>(
        "POST",
        `/kelas/${classGroup.id}/finalisasi`,
      );
      if (data.transcriptSync === "success") {
        setFinalizedBanner({
          tone: "seal",
          title: `Kelas ${classGroup.className} Difinalisasi`,
          body: `${data.studentsSynced} kartu transkrip mahasiswa terkirim ke arsip. `,
        });
      } else {
        setFinalizedBanner({
          tone: "void",
          title: `Kelas ${classGroup.className} Difinalisasi`,
          body: `Nilai tersegel, namun ${data.studentsSynced} kartu transkrip belum terkirim ke arsip. Nilai tetap tersimpan dan final.`,
        });
      }
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Finalisasi ditolak.";
      setRowNotice({
        tone: "void",
        text:
          message === "Forbidden"
            ? "Finalisasi ditolak kebijakan (bukan pengampu kelas, kelas tersegel, atau permintaan di luar jendela 07.00–21.00 WIB)."
            : message,
      });
    } finally {
      setFinalize(null);
    }
  };

  const finalizeCss =
    "text-sheet bg-void hover:bg-void step-change cursor-pointer px-3 py-1.5 text-xs font-semibold tracking-wide disabled:cursor-wait disabled:opacity-70";

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="label">Lembar Daftar Nilai</p>
          <h2 className="kop-teks text-2xl font-bold">Nilai Akademik</h2>
        </div>
        <p className="text-muted angka hidden text-right text-[11px] sm:block">{wibParts().date}</p>
      </div>

      {role === "dosen" && !windowSnapshot ? (
        <Banner tone="paper" title="Di luar Jendela Akses">
          Waktu WIB {wibParts().time}. Perubahan nilai dan finalisasi hanya berlaku pukul 07.00–21.00 WIB.
        </Banner>
      ) : null}

      {finalizedBanner ? (
        <Banner tone={finalizedBanner.tone} title={finalizedBanner.title} onClose={() => setFinalizedBanner(null)}>
          {finalizedBanner.body} Seluruh perubahan nilai tersegel.
        </Banner>
      ) : null}

      {rowNotice ? (
        <Banner tone={rowNotice.tone} title={rowNotice.tone === "seal" ? "Terekam" : "Ditolak"} onClose={() => setRowNotice(null)}>
          {rowNotice.text}
        </Banner>
      ) : null}

      {loadError ? (
        <Banner tone="void" title="Kegagalan Memuat">
          {loadError}
        </Banner>
      ) : null}

      {grades === null && !loadError ? (
        <p className="text-muted label">Memuat daftar…</p>
      ) : null}

      {grades !== null && grades.length === 0 ? (
        <div className="sheet px-4 py-10 text-center">
          <p className="kop-teks text-lg font-semibold">Belum Ada Kartu Nilai</p>
          <p className="text-muted mt-1 text-sm">
            {role === "mahasiswa" ? "Anda belum terdaftar pada kelas yang memiliki kartu nilai." : "Belum ada mahasiswa mengisi kelas Anda."}
          </p>
        </div>
      ) : null}

      {role === "mahasiswa" && grades && grades.length > 0 ? (
        <div className="sheet overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-paper-deep text-left">
                {["No", "Mata Kuliah", "Kelas", "Angka", "Status"].map((heading) => (
                  <th key={heading} className="label px-4 py-2.5">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classGroups.flatMap((group) => group.rows.map((row, index) => ({ group, row, index }))).map(({ group, row, index }) => (
                <tr key={row.gradeId} className="border-rule border-t">
                  <td className="angka text-muted px-4 py-2.5">{String(index + 1).padStart(2, "0")}</td>
                  <td className="px-4 py-2.5">{group.courseName}</td>
                  <td className="text-muted angka px-4 py-2.5">{group.className}</td>
                  <td className="angka px-4 py-2.5 text-base font-bold">{row.score ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <Stamp tone={row.gradeFinalized ? "final" : "draft"}>{row.gradeFinalized ? "Tersegel" : "Draf"}</Stamp>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {role === "dosen" &&
        classGroups.map((group) => {
          const isSealed = group.classFinalized;
          const kelasSudahFinal = group.rows.every((row) => row.gradeFinalized);
          const canFinalize =
            windowSnapshot && !isSealed && !kelasSudahFinal && group.rows.every((row) => typeof row.score === "number");
          return (
            <section key={group.id} className="sheet overflow-hidden">
              <header className="border-rule bg-paper-deep flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                <div>
                  <p className="label">{group.courseName}</p>
                  <h3 className="kop-teks text-lg font-bold">
                    {group.className}
                    <span className="ml-2 align-middle">
                      <Stamp tone={isSealed ? "final" : "draft"} size="md">
                        {isSealed ? "Tersegel" : "Konsensus Draf"}
                      </Stamp>
                    </span>
                  </h3>
                </div>
                {isSealed ? (
                  <p className="text-muted text-xs">Kelas tersegel — kartu transkrip telah diterbitkan.</p>
                ) : (
                  <div className="flex items-center gap-2">
                    {!windowSnapshot ? <p className="label">Di luar jendela 07.00–21.00 WIB</p> : null}
                    {!finalize || finalize.classId !== group.id ? (
                      <button
                        onClick={() => setFinalize({ classId: group.id, confirming: true, busy: false })}
                        disabled={!canFinalize}
                        className={finalizeCss}
                      >
                        Finalisasi Kelas
                      </button>
                    ) : finalize.confirming ? (
                      <div className="flex items-center gap-2">
                        <span className="text-muted text-xs">Segel permanen — lanjutkan finalisasi?</span>
                        <button onClick={() => void finalisasiKelas(group)} className={finalizeCss}>
                          Ya, Segel
                        </button>
                        <button
                          onClick={() => setFinalize(null)}
                          className="border-rule hover:text-void step-change cursor-pointer px-2 py-1.5 text-xs"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <span className="label">Memproses…</span>
                    )}
                  </div>
                )}
              </header>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    {["No", "Student ID", "Nama", "Angka", "Status", "Aksi"].map((heading) => (
                      <th key={heading} className="label border-rule px-4 py-2.5">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row, index) => {
                    const editing = edit?.gradeId === row.gradeId;
                    const editable = !isSealed && !row.gradeFinalized && windowSnapshot;
                    return (
                      <tr key={row.gradeId} className="border-rule hover:bg-paper border-t">
                        <td className="angka text-muted px-4 py-2.5">{String(index + 1).padStart(2, "0")}</td>
                        <td className="angka px-4 py-2.5">{row.studentNim ?? "—"}</td>
                        <td className="px-4 py-2.5">{row.studentName}</td>
                        <td className="angka px-4 py-2.5 text-base font-bold">
                          {editing ? (
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={edit.value}
                              onChange={(event) => setEdit({ ...edit, value: event.target.value })}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") void simpanNilai(row);
                                if (event.key === "Escape") setEdit(null);
                              }}
                              className="border-rule w-16 border bg-white px-2 py-0.5 text-sm outline-none"
                              disabled={edit.busy}
                              autoFocus
                            />
                          ) : (
                            (row.score ?? "—")
                          )}
                          {edit?.error && editing ? (
                            <p className="mt-1 text-xs font-normal" style={{ color: "var(--color-void)" }}>
                              {edit.error}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-4 py-2.5">
                          <Stamp tone={row.gradeFinalized ? "final" : "draft"}>{row.gradeFinalized ? "Tersegel" : "Draf"}</Stamp>
                        </td>
                        <td className="px-4 py-2.5">
                          {editing ? (
                            <div className="flex gap-2 text-xs">
                              <button
                                onClick={() => void simpanNilai(row)}
                                disabled={edit.busy}
                                className="text-sheet bg-national hover:bg-national-hover cursor-pointer px-2.5 py-1 font-semibold disabled:opacity-60"
                              >
                                {edit.busy ? "Menyimpan…" : "Simpan"}
                              </button>
                              <button onClick={() => setEdit(null)} className="text-muted hover:text-void cursor-pointer px-1 py-1">
                                Batal
                              </button>
                            </div>
                          ) : editable ? (
                            <button
                              onClick={() => setEdit({ gradeId: row.gradeId, value: row.score === null ? "" : String(row.score), error: null, busy: false })}
                              className="border-rule hover:border-national hover:text-national step-change cursor-pointer px-2.5 py-1 text-xs"
                            >
                              Ubah
                            </button>
                          ) : (
                            <span className="label">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          );
        })}
    </div>
  );
}
