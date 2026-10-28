import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { deviceLabel } from "../lib/devices";
import { ROLE_LABEL, roleShort, wibParts } from "../lib/format";

interface TabDef {
  to: string;
  label: string;
  roles: string[];
}

const TABS: TabDef[] = [
  { to: "/nilai", label: "Nilai", roles: ["mahasiswa", "dosen"] },
  { to: "/transkrip", label: "Transkrip", roles: ["mahasiswa", "admin"] },
  { to: "/audit", label: "Berita Acara", roles: ["admin"] },
];

export function Shell() {
  const { session, ready, logout, request } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center">
        <p className="label">Memuat…</p>
      </main>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  const { user } = session;
  const visibleTabs = TABS.filter((tab) => tab.roles.includes(user.role));

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen">
      <header className="sheet sticky top-0 z-10 border-x-0 border-t-0">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="bg-paper text-national kap grid h-10 w-10 place-items-center select-none">
              <span className="kop-teks text-sm font-bold leading-none">UN</span>
            </div>
            <div>
              <p className="kop-teks text-[15px] font-bold tracking-wide">SISTEM NILAI</p>
              <p className="text-muted text-[11px]">Universitas Nusantara — Praktikum Keamanan Informasi</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-semibold leading-tight">{session.user.name}</p>
              <p className="text-muted text-[11px] leading-tight">
                <span className="angka">{session.user.nim ? session.user.nim : ROLE_LABEL[session.user.role]}</span>
                <span className="mx-1.5 text-rule-strong">•</span>
                <span className="font-mono text-[10px] tracking-wider">{roleShort(session.user.role)}</span>
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="border-rule text-muted hover:border-void hover:text-void step-change border px-3 py-1.5 text-sm"
            >
              Keluar
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-0 px-4 sm:px-6" aria-label="Menu utama">
          {visibleTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                `kop-teks -mb-px border box-border px-4 pt-2 pb-1.5 text-sm cursor-pointer no-underline ${
                  isActive || location.pathname === tab.to
                    ? "bg-paper border-rule-strong border-b-paper font-bold text-ink"
                    : "border-transparent text-muted hover:border-rule hover:text-ink bg-transparent"
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Outlet context={{ request }} />
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
        <div className="hair border-t pt-3">
          <p className="label">
            Perangkat: {deviceLabel(session.deviceId)} — WIB {wibParts().time} — seluruh akses tercatat pada berita acara
          </p>
        </div>
      </footer>
    </div>
  );
}
