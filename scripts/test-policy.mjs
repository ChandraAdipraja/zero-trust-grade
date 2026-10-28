const fs = await import("node:fs");
const crypto = await import("node:crypto");
const { resetSeedState } = await import("./reset-seed-state.mjs");

const envMap = {};
for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (match) envMap[match[1]] ??= match[2];
}

const BASE = "http://localhost:3000";
const DEVICE = {
  admin: "10000000-0000-0000-0000-000000000001",
  dosen1: "10000000-0000-0000-0000-000000000002",
  dosen2: "10000000-0000-0000-0000-000000000003",
  mhs1: "10000000-0000-0000-0000-000000000004",
  mhs2: "10000000-0000-0000-0000-000000000005",
};
const GRADE = {
  class1A: "40000000-0000-0000-0000-000000000001",
  class1B: "40000000-0000-0000-0000-000000000002",
  class2A: "40000000-0000-0000-0000-000000000003",
  class2B: "40000000-0000-0000-0000-000000000004",
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
const skipped = [];
const skip = (name, why) => {
  skipped.push(name);
  console.log(`SKIP ${name} (${why})`);
};

const headersFor = (token, deviceId) => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  ...(deviceId ? { "x-device-id": deviceId } : {}),
});

const request = async (method, path, { token, deviceId, body } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headersFor(token, deviceId),
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
};

const login = async (email, password, deviceId) => {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, deviceId }),
    signal: AbortSignal.timeout(15000),
  });
  return res.json();
};

const b64u = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const craftJwt = (payload, secret) => {
  const head = b64u({ alg: "HS256", typ: "JWT" });
  const body = b64u(payload);
  const sig = crypto.createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
};

const wibHour = () => {
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "numeric", hourCycle: "h23" });
  return Number.parseInt(fmt.format(new Date()), 10);
};
const withinWindow = wibHour() >= 7 && wibHour() < 21;
console.log(`Current WIB hour: ${wibHour()}, policy window active: ${withinWindow}\n`);

await resetSeedState();

const auditBase = new URL(envMap.SUPABASE_URL).origin;
const auditHeaders = {
  apikey: envMap.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${envMap.SUPABASE_SERVICE_ROLE_KEY}`,
};
const countAudit = async () => {
  const res = await fetch(`${auditBase}/rest/v1/audit_logs?select=decision,reason&order=timestamp.desc&limit=500`, { headers: auditHeaders });
  const rows = await res.json();
  return rows;
};

const auditBefore = await countAudit();
const beforeAllows = auditBefore.filter((r) => r.decision === "allow").length;
const beforeDenies = auditBefore.filter((r) => r.decision === "deny").length;

const mhs = await login("mahasiswa.satu@demo.id", "mahasiswa-demo-123", DEVICE.mhs1);
const dosen1 = await login("dosen.satu@demo.id", "dosen-demo-123", DEVICE.dosen1);
const dosen2 = await login("dosen.dua@demo.id", "dosen-demo-123", DEVICE.dosen2);
const admin = await login("admin@demo.id", "admin-demo-123", DEVICE.admin);
const serviceRes = await fetch(`${BASE}/auth/service`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ clientId: "nilai-service", clientSecret: "nilai-service-demo-secret" }),
});
const serviceToken = (await serviceRes.json()).serviceToken;

const expiredToken = craftJwt(
  { sub: mhs.user.id, role: "mahasiswa", iat: Math.floor(Date.now() / 1000) - 3600, exp: Math.floor(Date.now() / 1000) - 3500 },
  envMap.JWT_ACCESS_SECRET,
);
const wrongSignToken = craftJwt(
  { sub: mhs.user.id, role: "mahasiswa", exp: Math.floor(Date.now() / 1000) + 600 },
  "totally-wrong-secret",
);

console.log("--- autentikasi & perangkat ---");
let r = await request("GET", "/nilai");
check("GET /nilai tanpa access token -> 401", r.status === 401, `status=${r.status}`);

r = await request("GET", "/nilai", { token: "garbage-token", deviceId: DEVICE.mhs1 });
check("GET /nilai access token tidak valid -> 401", r.status === 401, `status=${r.status}`);

r = await request("GET", "/nilai", { token: expiredToken, deviceId: DEVICE.mhs1 });
check("GET /nilai access token kedaluwarsa -> 401", r.status === 401, `status=${r.status}`);

r = await request("GET", "/nilai", { token: wrongSignToken, deviceId: DEVICE.mhs1 });
check("GET /nilai signature salah -> 401", r.status === 401, `status=${r.status}`);

r = await request("GET", "/nilai", { token: mhs.accessToken });
check("GET /nilai tanpa X-Device-ID -> 401", r.status === 401, `status=${r.status}`);

r = await request("GET", "/nilai", { token: mhs.accessToken, deviceId: "11111111-1111-1111-1111-111111111111" });
check("GET /nilai device tidak terdaftar -> 401", r.status === 401, `status=${r.status}`);

r = await request("GET", "/nilai", { token: mhs.accessToken, deviceId: DEVICE.mhs2 });
check("GET /nilai device milik user lain -> 401", r.status === 401, `status=${r.status}`);

console.log("--- kebijakan endpoint nilai ---");
r = await request("GET", "/nilai", { token: admin.accessToken, deviceId: DEVICE.admin });
check("GET /nilai sebagai admin -> 403", r.status === 403, `status=${r.status}`);

r = await request("GET", "/nilai", { token: mhs.accessToken, deviceId: DEVICE.mhs1 });
check("GET /nilai mahasiswa sendiri -> diizinkan service (200)", r.status === 200, `status=${r.status}`);

r = await request("GET", "/nilai", { token: dosen1.accessToken, deviceId: DEVICE.dosen1 });
check("GET /nilai dosen kelasnya -> diizinkan service (200)", r.status === 200, `status=${r.status}`);

r = await request("PUT", `/nilai/${GRADE.class2A}`, { token: mhs.accessToken, deviceId: DEVICE.mhs1, body: { score: 95 } });
check("PUT /nilai sebagai mahasiswa -> 403", r.status === 403, `status=${r.status}`);

r = await request("PUT", `/nilai/${GRADE.class2A}`, { token: dosen1.accessToken, deviceId: DEVICE.dosen1, body: { score: 95 } });
check("PUT /nilai kelas dosen lain -> 403", r.status === 403, `status=${r.status}`);

if (withinWindow) {
  r = await request("PUT", `/nilai/${GRADE.class1A}`, { token: dosen1.accessToken, deviceId: DEVICE.dosen1, body: { score: 95 } });
  check("PUT /nilai kelas sendiri belum final -> diizinkan service (200)", r.status === 200, `status=${r.status}`);
} else {
  r = await request("PUT", `/nilai/${GRADE.class1A}`, { token: dosen1.accessToken, deviceId: DEVICE.dosen1, body: { score: 95 } });
  check("PUT /nilai di luar jam 07-21 -> 403", r.status === 403, `status=${r.status}`);
  skip("PUT /nilai kelas sendiri (izin jam aktif)", "di luar jam uji");
}

r = await request("POST", `/kelas/${CLASS.basisdata}/finalisasi`, { token: dosen2.accessToken, deviceId: DEVICE.dosen2 });
check("finalisasi kelas yang sudah difinalisasi -> 403", r.status === 403, `status=${r.status}`);

r = await request("POST", `/kelas/${CLASS.pemweb}/finalisasi`, { token: dosen2.accessToken, deviceId: DEVICE.dosen2 });
check("finalisasi kelas dosen lain -> 403", r.status === 403, `status=${r.status}`);

if (withinWindow) {
  r = await request("POST", `/kelas/${CLASS.pemweb}/finalisasi`, { token: dosen1.accessToken, deviceId: DEVICE.dosen1 });
  check("finalisasi kelas sendiri -> diizinkan service (200)", r.status === 200, `status=${r.status}`);
} else {
  r = await request("POST", `/kelas/${CLASS.pemweb}/finalisasi`, { token: dosen1.accessToken, deviceId: DEVICE.dosen1 });
  check("finalisasi di luar jam 07-21 -> 403", r.status === 403, `status=${r.status}`);
  skip("finalisasi kelas sendiri (izin jam aktif)", "di luar jam uji");
}

console.log("--- kebijakan transkrip ---");
r = await request("GET", "/transkrip/2100001", { token: mhs.accessToken, deviceId: DEVICE.mhs1 });
check("GET transkrip NIM sendiri -> 200 atau 404 belum tersinkron", r.status === 200 || r.status === 404, `status=${r.status}`);

r = await request("GET", "/transkrip/2100002", { token: mhs.accessToken, deviceId: DEVICE.mhs1 });
check("GET transkrip mahasiswa lain -> 403", r.status === 403, `status=${r.status}`);

r = await request("GET", "/transkrip/2100001", { token: admin.accessToken, deviceId: DEVICE.admin });
check("GET transkrip semua mahasiswa (admin) -> 200 atau 404 belum tersinkron", r.status === 200 || r.status === 404, `status=${r.status}`);

r = await request("GET", "/transkrip/2100001", { token: dosen1.accessToken, deviceId: DEVICE.dosen1 });
check("GET transkrip sebagai dosen -> 403", r.status === 403, `status=${r.status}`);

r = await request("POST", "/transkrip/sinkron");
check("POST sinkron tanpa token -> 401", r.status === 401, `status=${r.status}`);

r = await request("POST", "/transkrip/sinkron", { token: mhs.accessToken });
check("POST sinkron dengan token user biasa -> 401", r.status === 401, `status=${r.status}`);

r = await request("POST", "/transkrip/sinkron", { token: serviceToken });
check("POST sinkron dengan service token -> 200/400 payload service valid", r.status === 200 || r.status === 400, `status=${r.status}`);

console.log("--- audit log ---");
const auditAfter = await countAudit();
const afterAllows = auditAfter.filter((x) => x.decision === "allow").length;
const afterDenies = auditAfter.filter((x) => x.decision === "deny").length;
check("audit log: allow bertambah", afterAllows > beforeAllows, `allow ${beforeAllows}->${afterAllows}`);
check("audit log: deny bertambah", afterDenies > beforeDenies, `deny ${beforeDenies}->${afterDenies}`);

const expectedReasons = [
  "DENY: role has no access to grade lists",
  "DENY: only dosen can update grades",
  "DENY: lecturer does not teach the requested class",
  "DENY: class is already finalized",
  "DENY: student attempted to access another student's transcript",
  "DENY: dosen is not permitted to read all transcripts",
  "DENY: invalid or expired service token",
];
const recentReasons = new Set(auditAfter.slice(0, 200).map((x) => x.reason));
const missingReasons = expectedReasons.filter((x) => !recentReasons.has(x));
check("audit log: alasan penolakan lengkap", missingReasons.length === 0, missingReasons.join(" | "));

const failed = results.filter((x) => !x.ok);
console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} passed, ${skipped.length} skipped`);
await resetSeedState();
process.exit(failed.length > 0 ? 1 : 0);
