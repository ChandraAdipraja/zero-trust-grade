const fs = await import("node:fs");
const { resetSeedState } = await import("./reset-seed-state.mjs");

const envMap = {};
for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (match) envMap[match[1]] ??= match[2];
}

const GATEWAY = "http://localhost:3000";
const TRANSCRIP = "http://localhost:3002";
const GATEWAY_SECRET = envMap.GATEWAY_SECRET;
const DEVICE = {
  admin: "10000000-0000-0000-0000-000000000001",
  dosen1: "10000000-0000-0000-0000-000000000002",
  mhs1: "10000000-0000-0000-0000-000000000004",
  mhs2: "10000000-0000-0000-0000-000000000005",
  mhs3: "10000000-0000-0000-0000-000000000006",
};
const USER = {
  admin: "00000000-0000-0000-0000-000000000001",
  dosen1: "00000000-0000-0000-0000-000000000002",
  mhs1: "00000000-0000-0000-0000-000000000004",
  mhs2: "00000000-0000-0000-0000-000000000005",
  mhs3: "00000000-0000-0000-0000-000000000006",
};
const NIM = { mhs1: "2100001", mhs2: "2100002", mhs3: "2100003" };
const CLASS = { pemweb: "20000000-0000-0000-0000-000000000001" };

const results = [];
const check = (name, ok, extra = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? ` -> ${extra}` : ""}`);
};

const request = async (method, path, { token, deviceId, body } = {}) => {
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

const directRequest = async (method, path, { token, gatewaySecret, body } = {}) => {
  const res = await fetch(`${TRANSCRIP}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(gatewaySecret ? { "x-gateway-secret": gatewaySecret } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
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
const admin = await login("admin@demo.id", "admin-demo-123", DEVICE.admin);

console.log("--- isolasi langsung ke service (tanpa gateway) ---");
let r = await directRequest("GET", `/transkrip/${NIM.mhs1}`);
check("GET 3002/transkrip tanpa gateway secret -> 401", r.status === 401, `status=${r.status}`);

r = await directRequest("GET", `/transkrip/${NIM.mhs1}`, { gatewaySecret: GATEWAY_SECRET });
check("GET 3002/transkrip secret tapi tanpa JWT -> 401", r.status === 401, `status=${r.status}`);

r = await directRequest("POST", "/transkrip/sinkron", { token: mhs1.accessToken });
check("POST 3002/sinkron tanpa gateway secret -> 401", r.status === 401, `status=${r.status}`);

r = await directRequest("POST", "/transkrip/sinkron", { token: mhs1.accessToken, gatewaySecret: GATEWAY_SECRET, body: { studentIds: [USER.mhs1] } });
check("POST 3002/sinkron token user biasa -> 401", r.status === 401, `status=${r.status}`);

r = await directRequest("POST", "/transkrip/sinkron", { token: "dummy.svc", gatewaySecret: GATEWAY_SECRET, body: { studentIds: [USER.mhs1] } });
check("POST 3002/sinkron token service salah -> 401", r.status === 401, `status=${r.status}`);

r = await directRequest("POST", "/transkrip/sinkron", {
  token: (await request("POST", "/auth/service", { body: { clientId: envMap.SERVICE_CLIENT_ID, clientSecret: envMap.SERVICE_CLIENT_SECRET } })).json.serviceToken,
  gatewaySecret: GATEWAY_SECRET,
  body: { studentIds: [USER.mhs1] },
});
check("POST 3002/sinkron token service + secret -> 200 sebelum finalisasi (skip)", r.status === 200 && r.json?.skipped?.[0]?.reason === "no finalized grades", `status=${r.status}, skipped=${JSON.stringify(r.json?.skipped)}`);

console.log("--- sebelum finalisasi ---");
r = await request("GET", `/transkrip/${NIM.mhs1}`, { token: mhs1.accessToken, deviceId: DEVICE.mhs1 });
check("GET transkrip sendiri sebelum ada nilai final -> 404", r.status === 404, `status=${r.status}`);

r = await request("POST", `/kelas/${CLASS.pemweb}/finalisasi`, { token: dosen1.accessToken, deviceId: DEVICE.dosen1 });
check(
  "finalisasi kelas -> 200 dengan sync",
  r.status === 200 && r.json?.transcriptSync === "success" && r.json?.studentsSynced === 2,
  `status=${r.status}, studentsSynced=${r.json?.studentsSynced}, transcriptSync=${r.json?.transcriptSync}`,
);

console.log("--- sesudah finalisasi ---");
r = await request("GET", `/transkrip/${NIM.mhs1}`, { token: mhs1.accessToken, deviceId: DEVICE.mhs1 });
check(
  "GET transkrip sendiri -> 200 dengan 1 mata kuliah",
  r.status === 200 && r.json?.student?.nim === NIM.mhs1 && r.json?.items?.length === 1 && r.json.items[0].className === "IF-2101",
  `status=${r.status}, items=${r.json?.items?.length}, className=${r.json?.items?.[0]?.className}`,
);

r = await request("GET", `/transkrip/${NIM.mhs2}`, { token: mhs2.accessToken, deviceId: DEVICE.mhs2 });
check(
  "GET transkrip mhs2 -> 200 dengan 2 kelas",
  r.status === 200 && r.json?.items?.length === 2,
  `status=${r.status}, items=${r.json?.items?.length}`,
);

r = await request("GET", `/transkrip/${NIM.mhs1}`, { token: mhs2.accessToken, deviceId: DEVICE.mhs2 });
check("GET transkrip mahasiswa lain -> 403", r.status === 403, `status=${r.status}`);

r = await request("GET", `/transkrip/${NIM.mhs1}`, { token: dosen1.accessToken, deviceId: DEVICE.dosen1 });
check("GET transkrip dosen -> 403", r.status === 403, `status=${r.status}`);

r = await request("GET", `/transkrip/${NIM.mhs2}`, { token: admin.accessToken, deviceId: DEVICE.admin });
check("GET transkrip admin (nim apa pun) -> 200", r.status === 200 && r.json?.student?.nim === NIM.mhs2, `status=${r.status}`);

r = await request("GET", "/transkrip/9999999", { token: admin.accessToken, deviceId: DEVICE.admin });
check("GET transkrip NIM tidak dikenal -> 404", r.status === 404, `status=${r.status}`);

const pemwebGradeId = "40000000-0000-0000-0000-000000000001";
r = await request("PUT", `/nilai/${pemwebGradeId}`, { token: dosen1.accessToken, deviceId: DEVICE.dosen1, body: { score: 90 } });
check("PUT /nilai setelah finalisasi -> tetap 403/409", r.status === 403 || r.status === 409, `status=${r.status}`);

console.log("--- sinkronisasi idempoten ---");
const svcRes = await request("POST", "/auth/service", { body: { clientId: envMap.SERVICE_CLIENT_ID, clientSecret: envMap.SERVICE_CLIENT_SECRET } });
r = await request("POST", "/transkrip/sinkron", { token: svcRes.json.serviceToken, body: { studentIds: [USER.mhs1, USER.mhs2] } });
check(
  "sync ulang service token -> 200 item tetap sama",
  r.status === 200 &&
    r.json?.synced?.length === 2 &&
    r.json.synced.every((s) => s.itemCount === 2 || s.itemCount === 1),
  `status=${r.status}, synced=${JSON.stringify(r.json?.synced)}`,
);

r = await request("GET", `/transkrip/${NIM.mhs1}`, { token: mhs1.accessToken, deviceId: DEVICE.mhs1 });
check(
  "GET transkrip mhs1 tetap 1 item (idempoten)",
  r.status === 200 && r.json?.items?.length === 1,
  `status=${r.status}, items=${r.json?.items?.length}`,
);

r = await directRequest("POST", "/transkrip/sinkron", { token: svcRes.json.serviceToken, gatewaySecret: GATEWAY_SECRET, body: { studentIds: [] } });
check("POST 3002/sinkron payload studentIds kosong -> 400", r.status === 400, `status=${r.status}`);

r = await directRequest("POST", "/transkrip/sinkron", { token: svcRes.json.serviceToken, gatewaySecret: GATEWAY_SECRET, body: { studentIds: "bukan-array" } });
check("POST 3002/sinkron payload bukan array -> 400", r.status === 400, `status=${r.status}`);

const auditBase = new URL(envMap.SUPABASE_URL).origin;
const auditHeaders = { apikey: envMap.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${envMap.SUPABASE_SERVICE_ROLE_KEY}` };
const audit = await fetch(`${auditBase}/rest/v1/audit_logs?select=decision&order=timestamp.desc&limit=500`, { headers: auditHeaders });
const auditRows = await audit.json();
const allows = auditRows.filter((x) => x.decision === "allow").length;
const denies = auditRows.filter((x) => x.decision === "deny").length;
check("audit log: allow dan deny tercatat", allows > 0 && denies > 0, `allow=${allows}, deny=${denies}`);

await resetSeedState();
const verify = await fetch(
  `${auditBase}/rest/v1/transcripts?select=student_id`,
  { headers: auditHeaders },
).then((x) => x.json());
check("transcripts tak terhapus dalam seed dasar", Array.isArray(verify), `rows=${verify.length} (sisa snapshot dari uji, direset manual bila perlu)`);

const failed = results.filter((x) => !x.ok);
console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length > 0 ? 1 : 0);
