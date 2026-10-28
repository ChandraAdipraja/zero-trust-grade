import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Banner } from "../components/Banner";
import { DEMO_DEVICES, deviceForEmail } from "../lib/devices";

export function Login() {
  const { session, ready, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (ready && session) {
    const home = session.user.role === "dosen" || session.user.role === "mahasiswa" ? "/nilai" : "/audit";
    return <Navigate to={home} replace />;
  }

  const respondDeviceToEmail = (nextEmail: string) => {
    const device = deviceForEmail(nextEmail);
    if (device) setDeviceId(device.id);
  };

  const isiDemo = (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError(null);
    respondDeviceToEmail(demoEmail);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!deviceId) {
      setError("Pilih perangkat terdaftar terlebih dahulu.");
      return;
    }
    setBusy(true);
    try {
      const user = await login(email.trim(), password, deviceId);
      navigate(user.role === "admin" ? "/audit" : "/nilai", { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Periksa kembali kredensial Anda.";
      setError(message === "Unauthorized" ? "Periksa email, kata sandi, dan perangkat terdaftar." : message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="bg-paper-deep border-rule relative hidden border-r lg:block">
        <div className="mx-auto flex h-full max-w-xl flex-col justify-center gap-10 px-10 py-16">
          <div>
            <div className="bg-paper text-national kap grid h-16 w-16 place-items-center">
              <span className="kop-teks text-xl font-bold leading-none">UN</span>
            </div>
            <h1 className="kop-teks mt-6 text-4xl font-bold leading-tight">
              Sistem Nilai
              <span className="mt-1 block text-lg font-normal text-muted">Universitas Nusantara</span>
            </h1>
            <p className="text-muted mt-3 max-w-sm text-sm leading-relaxed">
              Praktikum Keamanan Informasi — arsitektur zero trust: kepercayaan tidak diwariskan, setiap
              permintaan dibuktikan ulang.
            </p>
          </div>
        </div>
      </section>

      <section className="grid place-items-center px-4 py-12">
        <div className="sheet w-full max-w-md">
          <div className="border-rule border-b px-6 pb-4 pt-5">
            <p className="label">Formulir Masuk</p>
            <h2 className="kop-teks mt-1 text-2xl font-bold">Masuk Akun</h2>
          </div>

          <form onSubmit={submit} className="space-y-4 px-6 py-5">
            {error ? (
              <Banner tone="void" title="Permintaan Ditolak">
                {error}
              </Banner>
            ) : null}

            <div>
              <label htmlFor="email" className="label block">
                Surel Resmi
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (!deviceId) respondDeviceToEmail(event.target.value);
                }}
                placeholder="nama@demo.id"
                className="border-rule mt-1.5 w-full border bg-white px-3 py-2 text-sm outline-none focus:border-rule-strong"
              />
            </div>

            <div>
              <label htmlFor="password" className="label block">
                Kata Sandi
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="border-rule mt-1.5 w-full border bg-white px-3 py-2 text-sm outline-none focus:border-rule-strong"
              />
            </div>

            <div>
              <label htmlFor="deviceId" className="label block">
                Perangkat Terdaftar
              </label>
              <select
                id="deviceId"
                required
                value={deviceId}
                onChange={(event) => setDeviceId(event.target.value)}
                className="border-rule mt-1.5 w-full border bg-white px-3 py-2 text-sm outline-none focus:border-rule-strong"
              >
                <option value="">Pilih perangkat…</option>
                {DEMO_DEVICES.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.label} — {device.emailHint}
                  </option>
                ))}
              </select>
              <p className="text-muted mt-1.5 text-[11px]">
                Zero trust: token hanya diterbitkan untuk perangkat yang tercatat di basis data.
              </p>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="text-sheet bg-national hover:bg-national-hover px-4 py-2.5 text-sm font-semibold tracking-wide disabled:cursor-wait disabled:opacity-70 w-full cursor-pointer"
            >
              {busy ? "Memeriksa…" : "Masuk"}
            </button>
          </form>

          <div className="border-rule border-t px-6 py-4">
            <p className="label">Isi Cepat Akun Demo</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                ["Admin", "admin@demo.id", "admin-demo-123"],
                ["Dosen Satu", "dosen.satu@demo.id", "dosen-demo-123"],
                ["Mahasiswa Satu", "mahasiswa.satu@demo.id", "mahasiswa-demo-123"],
                ["Mahasiswa Dua", "mahasiswa.dua@demo.id", "mahasiswa-demo-123"],
              ].map(([label, demoEmail, demoPassword]) => (
                <button
                  key={demoEmail}
                  type="button"
                  onClick={() => isiDemo(demoEmail, demoPassword)}
                  className="border-rule hover:border-national hover:text-national step-change cursor-pointer border px-2.5 py-1 text-xs"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
