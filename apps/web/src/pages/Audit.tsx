import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Banner } from "../components/Banner";
import { Stamp } from "../components/Stamp";
import { deviceLabel } from "../lib/devices";
import { ROLE_LABEL, wibTimestamp } from "../lib/format";

interface AuditEntry {
  id: number;
  timestamp: string;
  subject: string;
  subject_role: string | null;
  endpoint: string;
  http_method: string | null;
  device_id: string | null;
  decision: "allow" | "deny";
  reason: string;
}

const REFRESH_MS = 15000;

export function Audit() {
  const { session, request } = useAuth();
  const role = session?.user.role;

  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string>("");
  const [auto, setAuto] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await request<{ entries: AuditEntry[] }>("GET", "/audit");
      setEntries(data.entries);
      setError(null);
      setLastSync(wibTimestamp(new Date().toISOString()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat berita acara.");
    }
  }, [request]);

  useEffect(() => {
    if (role !== "admin") return;
    void refresh();
  }, [role, refresh]);

  useEffect(() => {
    if (role !== "admin") return;
    if (auto) {
      timer.current = setInterval(() => void refresh(), REFRESH_MS);
      return () => {
        if (timer.current) clearInterval(timer.current);
      };
    }
    if (timer.current) clearInterval(timer.current);
  }, [auto, refresh, role]);

  if (role !== "admin") {
    return <Navigate to="/" replace />;
  }

  const allowCount = entries?.filter((entry) => entry.decision === "allow").length ?? 0;
  const denyCount = entries?.filter((entry) => entry.decision === "deny").length ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="label">Lembar Berita Acara</p>
          <h2 className="kop-teks text-2xl font-bold">Berita Acara Akses</h2>
        </div>
        <div className="flex items-center gap-3">
          <label className="label flex cursor-pointer items-center gap-2 select-none">
            <input type="checkbox" checked={auto} onChange={(event) => setAuto(event.target.checked)} className="accent-[var(--color-national)]" />
            Segarkan 15 dtk
          </label>
          <button onClick={() => void refresh()} className="border-rule hover:border-national hover:text-national step-change cursor-pointer px-3 py-1.5 text-sm">
            Segarkan
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sheet px-4 py-3">
          <p className="label">Lembar Terekam</p>
          <p className="angka mt-1 text-2xl font-bold">{entries?.length ?? "—"}</p>
        </div>
        <div className="sheet px-4 py-3">
          <p className="label" style={{ color: "var(--color-seal)" }}>
            Keputusan Izin
          </p>
          <p className="angka mt-1 text-2xl font-bold" style={{ color: "var(--color-seal)" }}>
            {allowCount}
          </p>
        </div>
        <div className="sheet px-4 py-3">
          <p className="label" style={{ color: "var(--color-void)" }}>
            Keputusan Tolak
          </p>
          <p className="angka mt-1 text-2xl font-bold" style={{ color: "var(--color-void)" }}>
            {denyCount}
          </p>
        </div>
      </div>

      {error ? (
        <Banner tone="void" title="Kegagalan Muat">
          {error}
        </Banner>
      ) : null}
      {lastSync ? (
        <p className="label">
          Segar terakhir {lastSync} WIB — pertahankan seluruh entri dengan widget segarkan.
        </p>
      ) : null}

      {entries === null && !error ? <p className="text-muted label">Memperoleh daftar…</p> : null}

      {entries ? (
        <div className="sheet overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-paper-deep text-left">
                {["Waktu WIB", "Pelaku", "Endpoint", "Metode", "Keputusan", "Alasan Kebijakan"].map((heading) => (
                  <th key={heading} className="label px-4 py-2.5">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-rule border-t align-top">
                  <td className="angka px-4 py-2 whitespace-nowrap">{wibTimestamp(entry.timestamp)}</td>
                  <td className="px-4 py-2">
                    <p className="angka text-xs leading-tight">{entry.subject.slice(0, 18)}…</p>
                    <p className="text-muted text-[11px] leading-tight">{entry.subject_role ? ROLE_LABEL[entry.subject_role] ?? roleFallback(entry.subject_role) : "—"}</p>
                    {entry.device_id ? <p className="text-muted angka text-[10px] leading-tight">{deviceLabel(entry.device_id)}</p> : null}
                  </td>
                  <td className="angka px-4 py-2 text-[11px]">{entry.endpoint}</td>
                  <td className="angka px-4 py-2">{entry.http_method}</td>
                  <td className="px-4 py-2">
                    <Stamp tone={entry.decision === "allow" ? "allow" : "deny"}>{entry.decision === "allow" ? "Izin" : "Tolak"}</Stamp>
                  </td>
                  <td className="text-muted angka max-w-[280px] px-4 py-2 text-[11px] leading-snug" title={entry.reason}>
                    {entry.reason}
                  </td>
                </tr>
              ))}
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-muted px-4 py-8 text-center text-sm">
                    Berita acara masih kosong — belum ada permintaan yang diuji politik akses.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function roleFallback(role: string): string {
  if (role === "service") return "Service Klien";
  if (role === "anonymous") return "Anonim";
  return role;
}
