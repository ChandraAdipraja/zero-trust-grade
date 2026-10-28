const fs = await import("node:fs");
const { resetSeedState } = await import("./reset-seed-state.mjs");

const envMap = {};
for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (match) envMap[match[1]] ??= match[2];
}

const GATEWAY = "http://localhost:3000";
const NILAI = "http://localhost:3001";
const GATEWAY_SECRET = envMap.GATEWAY_SECRET;
const DEVICE = {
  admin: "10000000-0000-0000-0000-000000000001",
  dosen1: "10000000-0000-0000-0000-000000000002",
  dosen2: "10000000-0000-0000-0000-000000000003",
  mhs1: "10000000-0000-0000-0000-000000000004",
  mhs2: "10000000-0000-0000-0000-000000000005",
  mhs3: "10000000-0000-0000-0000-000000000006",
};
const GRADE = {
  class1A: "40000000-0000-0000-0000-000000000001",
  class1B: "40000000-0000-0000-0000-000000000002",
};
const CLASS = {
  pemweb: "20000000-0000-0000-0000-000000000001",
  basisdata: "20000000-0000-0000-0000-000000000002",
};

const results = [];
const check = (name, ok, extra = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? ` -> ${extra}` : ""}`);
};

const gatewayRequest = async (method, path, { token, deviceId, body } = {}) => {
  const res = await fetch(`${GATEWAY}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(deviceId ? { "x-device-id": deviceId } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
};

const login = async (email, password, deviceId) => {
  const res = await fetch(`${GATEWAY}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, deviceId }),
    signal: AbortSignal.timeout(15000),
  });
  return res.json();
};

await resetSeedState();
console.log("seed state reset ok\n");

const mhs1 = await login("mahasiswa.satu@demo.id", "mahasiswa-demo-123", DEVICE.mhs1);
const mhs2 = await login("mahasiswa.dua@demo.id", "mahasiswa-demo-123", DEVICE.mhs2);
const mhs3 = await login("mahasiswa.tiga@demo.id", "mahasiswa-demo-123", DEVICE.mhs3);
const dosen1 = await login("dosen.satu@demo.id", "dosen-demo-123", DEVICE.dosen1);
const dosen2 = await login("dosen.dua@demo.id", "dosen-demo-123", DEVICE.dosen2);
const admin = await login("admin@demo.id", "admin-demo-123", DEVICE.admin);

console.log("--- isolasi langsung ke service (tanpa gateway) ---");
let r = await fetch(`${NILAI}/nilai`, { signal: AbortSignal.timeout(10000) });
check("GET 3001/nilai tanpa gateway secret -> 401", r.status === 401, `status=${r.status}`);

r = await fetch(`${NILAI}/nilai`, {
  headers: { "x-gateway-secret": GATEWAY_SECRET },
  signal: AbortSignal.timeout(10000),
});
check("GET 3001/nilai gateway secret tapi tanpa JWT -> 401", r.status === 401, `status=${r.status}`);

r = await fetch(`${NILAI}/nilai`, {
  headers: { "x-gateway-secret": GATEWAY_SECRET, Authorization: `Bearer ${mhs1.accessToken}` },
  signal: AbortSignal.timeout(10000),
});
check("GET 3001/nilai gateway secret + JWT valid (proxy internal) -> 200", r.status === 200, `status=${r.status}`);

r = await fetch(`${NILAI}/nilai`, {
  headers: { "x-gateway-secret": "wrong-secret", Authorization: `Bearer ${mhs1.accessToken}` },
  signal: AbortSignal.timeout(10000),
});
check("GET 3001/nilai gateway secret salah -> 401", r.status === 401, `status=${r.status}`);

console.log("--- GET /nilai via gateway ---");
r = await gatewayRequest("GET", "/nilai", { token: mhs1.accessToken, deviceId: DEVICE.mhs1 });
check(
  "GET /nilai mahasiswa -> 200 hanya data miliknya",
  r.status === 200 &&
    Array.isArray(r.json?.grades) &&
    r.json.grades.length === 1 &&
    r.json.grades.every((g) => g.studentNim === "2100001"),
  `status=${r.status}, count=${r.json?.grades?.length}`,
);

r = await gatewayRequest("GET", "/nilai", { token: mhs2.accessToken, deviceId: DEVICE.mhs2 });
check(
  "GET /nilai mahasiswa dua -> 200 dengan nilai dari 2 kelas",
  r.status === 200 && r.json?.grades?.length === 2,
  `status=${r.status}, count=${r.json?.grades?.length}`,
);

r = await gatewayRequest("GET", "/nilai", { token: dosen1.accessToken, deviceId: DEVICE.dosen1 });
check(
  "GET /nilai dosen -> 200 seluruh nilai kelasnya saja",
  r.status === 200 &&
    r.json.grades.length === 2 &&
    r.json.grades.every((g) => g.className === "IF-2101"),
  `status=${r.status}, count=${r.json?.grades?.length}`,
);

r = await gatewayRequest("GET", "/nilai", { token: dosen2.accessToken, deviceId: DEVICE.dosen2 });
check(
  "GET /nilai dosen dua -> 200 hanya kelasnya",
  r.status === 200 && r.json.grades.length === 2 && r.json.grades.every((g) => g.className === "IF-2202"),
  `status=${r.status}, count=${r.json?.grades?.length}`,
);

r = await gatewayRequest("GET", "/nilai", { token: admin.accessToken, deviceId: DEVICE.admin });
check("GET /nilai admin -> 403", r.status === 403, `status=${r.status}`);

console.log("--- PUT /nilai via gateway ---");
r = await gatewayRequest("PUT", `/nilai/${GRADE.class1A}`, { token: mhs1.accessToken, deviceId: DEVICE.mhs1, body: { score: 50 } });
check("PUT /nilai sebagai mahasiswa -> 403", r.status === 403, `status=${r.status}`);

r = await gatewayRequest("PUT", `/nilai/${GRADE.class1A}`, { token: dosen1.accessToken, deviceId: DEVICE.dosen1, body: { score: 93 } });
check(
  "PUT /nilai kelas sendiri -> 200 + skor terupdate",
  r.status === 200 && r.json?.grade?.score === 93,
  `status=${r.status}, score=${r.json?.grade?.score}`,
);

r = await gatewayRequest("PUT", `/nilai/${GRADE.class1B}`, { token: dosen1.accessToken, deviceId: DEVICE.dosen1, body: { score: 140 } });
check("PUT /nilai skor di luar rentang -> 400", r.status === 400, `status=${r.status}`);

r = await gatewayRequest("PUT", `/nilai/${GRADE.class1A}`, { token: dosen1.accessToken, deviceId: DEVICE.dosen1, body: {} });
check("PUT /nilai tanpa body skor -> 400", r.status === 400, `status=${r.status}`);

r = await gatewayRequest("PUT", `/nilai/${GRADE.class1A}`, { token: dosen2.accessToken, deviceId: DEVICE.dosen2, body: { score: 90 } });
check("PUT /nilai kelas dosen lain -> 403", r.status === 403, `status=${r.status}`);

console.log("--- finalisasi kelas ---");
r = await gatewayRequest("POST", `/kelas/${CLASS.pemweb}/finalisasi`, { token: mhs1.accessToken, deviceId: DEVICE.mhs1 });
check("finalisasi sebagai mahasiswa -> 403", r.status === 403, `status=${r.status}`);

r = await gatewayRequest("POST", `/kelas/${CLASS.basisdata}/finalisasi`, { token: dosen1.accessToken, deviceId: DEVICE.dosen1 });
check("finalisasi kelas dosen lain -> 403", r.status === 403, `status=${r.status}`);

r = await gatewayRequest("POST", `/kelas/${CLASS.basisdata}/finalisasi`, { token: dosen2.accessToken, deviceId: DEVICE.dosen2 });
check("finalisasi kelas yang sudah final -> 403 (gateway)", r.status === 403, `status=${r.status}`);

r = await gatewayRequest("POST", `/kelas/${CLASS.pemweb}/finalisasi`, { token: dosen1.accessToken, deviceId: DEVICE.dosen1 });
check(
  "finalisasi kelas milik sendiri -> 200",
  r.status === 200 && r.json?.message === "Finalisasi kelas berhasil" && typeof r.json?.transcriptSync === "string",
  `status=${r.status}, transcriptSync=${r.json?.transcriptSync}`,
);
const wibHour = () => {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "numeric", hourCycle: "h23" });
  return Number.parseInt(fmt.format(new Date()), 10);
};
if (wibHour() >= 7 && wibHour() < 21) {
  check(
    "finalisasi dalam window jam -> grade jadi final",
    r.json?.transcriptSync === "failed" || r.json?.transcriptSync === "success",
    `transcriptSync=${r.json?.transcriptSync} (sync transkrip diimplement di Tahap 6)`,
  );
}

r = await gatewayRequest("PUT", `/nilai/${GRADE.class1B}`, { token: dosen1.accessToken, deviceId: DEVICE.dosen1, body: { score: 90 } });
check(
  "PUT /nilai sesudah finalisasi -> ditolak",
  r.status === 403 || r.status === 409,
  `status=${r.status}`,
);

r = await gatewayRequest("POST", `/kelas/${CLASS.pemweb}/finalisasi`, { token: dosen1.accessToken, deviceId: DEVICE.dosen1 });
check("finalisasi ulang kelas final -> ditolak", r.status === 403 || r.status === 409, `status=${r.status}`);

console.log("--- audit log ---");
const auditBase = new URL(envMap.SUPABASE_URL).origin;
const auditHeaders = {
  apikey: envMap.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${envMap.SUPABASE_SERVICE_ROLE_KEY}`,
};
const audit = await fetch(`${auditBase}/rest/v1/audit_logs?select=decision&order=timestamp.desc&limit=500`, { headers: auditHeaders });
const auditRows = await audit.json();
const allows = auditRows.filter((x) => x.decision === "allow").length;
const denies = auditRows.filter((x) => x.decision === "deny").length;
check("audit log: allow dan deny tercatat", allows > 0 && denies > 0, `allow=${allows}, deny=${denies}`);

await resetSeedState();
const verify = await fetch(`${auditBase}/rest/v1/classes?id=eq.20000000-0000-0000-0000-000000000001&select=is_finalized`, { headers: auditHeaders }).then((x) => x.json());
check("state seed kembali setelah reset", verify?.[0]?.is_finalized === false, JSON.stringify(verify));

const failed = results.filter((x) => !x.ok);
console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length > 0 ? 1 : 0);
