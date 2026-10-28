let fails = 0;
const check = (name, ok, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " -> " + extra : ""}`);
  if (!ok) fails++;
};

const run = async () => {
  const dev = "10000000-0000-0000-0000-000000000002";
  const login = await (
    await fetch("http://localhost:5173/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "dosen.satu@demo.id", password: "dosen-demo-123", deviceId: dev }),
    })
  ).json();
  check("login via proxy 5173", !!login.accessToken, `role=${login.user?.role}, nim=${login.user?.nim}`);
  const headers = { Authorization: `Bearer ${login.accessToken}`, "x-device-id": dev };

  const nilai = await (await fetch("http://localhost:5173/nilai", { headers })).json();
  check("GET /nilai via proxy", Array.isArray(nilai.grades) && nilai.grades.length === 2, `rows=${nilai.grades?.length}`);

  const auditForbidden = await fetch("http://localhost:5173/audit", { headers });
  check("GET /audit dosen -> 403", auditForbidden.status === 403, `status=${auditForbidden.status}`);

  const admin = await (
    await fetch("http://localhost:5173/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@demo.id",
        password: "admin-demo-123",
        deviceId: "10000000-0000-0000-0000-000000000001",
      }),
    })
  ).json();
  const adm = await (
    await fetch("http://localhost:5173/audit", {
      headers: {
        Authorization: `Bearer ${admin.accessToken}`,
        "x-device-id": "10000000-0000-0000-0000-000000000001",
      },
    })
  ).json();
  check("GET /audit admin via proxy", Array.isArray(adm.entries) && adm.entries.length > 0, `rows=${adm.entries?.length}`);

  const mhs = await (
    await fetch("http://localhost:5173/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "mahasiswa.satu@demo.id",
        password: "mahasiswa-demo-123",
        deviceId: "10000000-0000-0000-0000-000000000004",
      }),
    })
  ).json();
  const transcript = await fetch("http://localhost:5173/transkrip/2100001", {
    headers: {
      Authorization: `Bearer ${mhs.accessToken}`,
      "x-device-id": "10000000-0000-0000-0000-000000000004",
    },
  });
  check("GET transkrip via proxy (200/404)", transcript.status === 200 || transcript.status === 404, `status=${transcript.status}`);

  console.log(fails === 0 ? "ALL OK" : `FAILURES: ${fails}`);
  process.exit(fails === 0 ? 0 : 1);
};

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
