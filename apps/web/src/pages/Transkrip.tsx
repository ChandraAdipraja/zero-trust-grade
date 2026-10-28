import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Banner } from "../components/Banner";
import { Stamp } from "../components/Stamp";
import { ApiError } from "../lib/api";
import { wibTimestamp } from "../lib/format";

interface TranscriptItem {
  id: string;
  className: string;
  courseName: string;
  score: number;
  releasedAt: string;
}

interface Transcript {
  student: { nim: string; name: string };
  updatedAt: string;
  items: TranscriptItem[];
}

function SuratTranskrip({ transcript }: { transcript: Transcript }) {
  return (
    <article className="sheet">
      <header className="border-rule flex items-center gap-4 border-b-2 px-6 py-5">
        <div className="bg-paper text-national kap grid h-14 w-14 place-items-center shrink-0">
          <span className="kop-teks text-base font-bold leading-none">UN</span>
        </div>
        <div className="flex-1">
          <h3 className="kop-teks text-xl font-bold leading-tight">Universitas Nusantara</h3>
          <p className="text-muted text-xs">Direktori Kartu Hasil Studi — dokumen salinan resmi</p>
        </div>
        <div className="text-right">
          <p className="label">No. Dokumen</p>
          <p className="angka text-xs">
            SN/{new Date(transcript.updatedAt).getFullYear()}/{transcript.student.nim}
          </p>
        </div>
      </header>

      <dl className="border-rule grid grid-cols-2 gap-x-8 gap-y-1 border-b px-6 py-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="label">Nama</dt>
          <dd className="font-semibold">{transcript.student.name}</dd>
        </div>
        <div>
          <dt className="label">NIM</dt>
          <dd className="angka">{transcript.student.nim}</dd>
        </div>
        <div>
          <dt className="label">Diterbitkan</dt>
          <dd className="angka">{wibTimestamp(transcript.updatedAt)}</dd>
        </div>
      </dl>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            {["No", "Mata Kuliah", "Kelas", "Angka", "Tgl Segel"].map((heading) => (
              <th key={heading} className="label border-rule px-6 py-2.5">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transcript.items.map((item, index) => (
            <tr key={item.id} className="border-rule border-t">
              <td className="angka text-muted px-6 py-2.5">{String(index + 1).padStart(2, "0")}</td>
              <td className="px-6 py-2.5">{item.courseName}</td>
              <td className="angka text-muted px-6 py-2.5">{item.className}</td>
              <td className="angka px-6 py-2.5 text-base font-bold">{item.score}</td>
              <td className="angka text-muted px-6 py-2.5">{wibTimestamp(item.releasedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="border-rule border-t px-6 py-4">
        <div className="flex items-center justify-between">
          <Stamp tone="final" size="md">
            Terbit Terverifikasi
          </Stamp>
          <p className="label">Salinan basis data — sumber di jurnal nilai</p>
        </div>
      </footer>
    </article>
  );
}

export function Transkrip() {
  const { session, request } = useAuth();
  const role = session?.user.role;

  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [state, setState] = useState<{ kind: "loading" | "error" | "kosong" | "siap" | "idle" }>({ kind: role === "mahasiswa" ? "loading" : "idle" });
  const [message, setMessage] = useState<string>("");
  const [searchNim, setSearchNim] = useState("");

  const loadNim = useCallback(
    async (nim: string) => {
      setState({ kind: "loading" });
      try {
        if (!/^\d{5,20}$/.test(nim)) {
          setState({ kind: "error" });
          setMessage("NIM hanya berupa deretan angka (contoh: 2100001).");
          return;
        }
        const data = await request<Transcript>("GET", `/transkrip/${nim}`);
        if (data.items.length === 0) {
          setTranscript(data);
          setState({ kind: "kosong" });
          return;
        }
        setTranscript(data);
        setState({ kind: "siap" });
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setTranscript(null);
          setState({ kind: "kosong" });
          return;
        }
        if (err instanceof ApiError && err.status === 403) {
          setTranscript(null);
          setState({ kind: "error" });
          setMessage("Kartu tersebut bukan milik Anda — pemindaian NIM lain berakhir ditolak policy.");
          return;
        }
        setTranscript(null);
        setState({ kind: "error" });
        setMessage(err instanceof Error ? err.message : "Gagal memuat kartu transkrip.");
      }
    },
    [request],
  );

  useEffect(() => {
    if (role === "mahasiswa" && session?.user.nim) void loadNim(session.user.nim);
  }, [role, session?.user.nim, loadNim]);

  if (role === "dosen") {
    return <Navigate to="/" replace />;
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (role === "admin") void loadNim(searchNim.trim());
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="label">Lembar Kartu Hasil Studi</p>
        <h2 className="kop-teks text-2xl font-bold">Transkrip</h2>
      </div>

      {role === "admin" ? (
        <form onSubmit={submit} className="sheet flex items-end gap-3 px-4 py-3">
          <div className="flex-1">
            <label htmlFor="nim" className="label block">
              Nomor Induk Mahasiswa
            </label>
            <input
              id="nim"
              value={searchNim}
              onChange={(event) => setSearchNim(event.target.value)}
              placeholder="mis. 2100001"
              className="angka border-rule mt-1 w-full max-w-[220px] border bg-white px-3 py-2 text-sm outline-none focus:border-rule-strong"
            />
          </div>
          <button
            type="submit"
            className="text-sheet bg-national hover:bg-national-hover step-change cursor-pointer px-4 py-2 text-sm font-semibold disabled:opacity-60"
            disabled={state.kind === "loading"}
          >
            {state.kind === "loading" ? "Menampilkan…" : "Tampilkan Kartu"}
          </button>
        </form>
      ) : null}

      {state.kind === "loading" ? <p className="text-muted label">Memperlihatkan dokumen…</p> : null}
      {state.kind === "error" ? (
        <Banner tone="void" title="Kegagalan Akses">
          {message}
        </Banner>
      ) : null}
      {state.kind === "idle" ? (
        <div className="sheet space-y-2 p-6 text-center">
          <p className="kop-teks text-base font-semibold">Cari Kartu Hasil Studi</p>
          <p className="text-muted text-sm">Masukkan nomor induk mahasiswa untuk menampilkan kartu hasil studi.</p>
        </div>
      ) : null}
      {state.kind === "kosong" ? (
        <div className="sheet space-y-2 p-6 text-center">
          <p className="kop-teks text-base font-semibold">Kartu Belum Terbit</p>
          <p className="text-muted text-sm">
            Transkrip diterbitkan otomatis saat kelas difinalisasi pengampu — belum ada mata kuliah yang tersegel atas nama mahasiswa tersebut.
          </p>
        </div>
      ) : null}
      {state.kind === "siap" && transcript ? <SuratTranskrip transcript={transcript} /> : null}
    </div>
  );
}
