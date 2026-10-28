const fs = await import("node:fs");

const envMap = {};
for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (match) envMap[match[1]] ??= match[2];
}

const BASE = "http://localhost:3000";
const DEVICE_IDS = {
  admin: "10000000-0000-0000-0000-000000000001",
  dosen1: "10000000-0000-0000-0000-000000000002",
  dosen2: "10000000-0000-0000-0000-000000000003",
  mhs1: "10000000-0000-0000-0000-000000000004",
  mhs2: "10000000-0000-0000-0000-000000000005",
  mhs3: "10000000-0000-0000-0000-000000000006",
};

const results = [];
const check = (name, ok, extra = "") => {
  results.push({ name, ok, extra });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? ` -> ${extra}` : ""}`);
};

const post = async (path, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
};

const decodeJwt = (token) => {
  const payload = token.split(".")[1];
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
};

const login = async (email, password, deviceId) =>
  post("/auth/login", { email, password, deviceId });

let r = await login("mahasiswa.satu@demo.id", "salah-password", DEVICE_IDS.mhs1);
check("login wrong password -> 401", r.status === 401, `status=${r.status}`);

r = await login("mahasiswa.satu@demo.id", "mahasiswa-demo-123", DEVICE_IDS.mhs2);
check("login with another user's device -> 401", r.status === 401, `status=${r.status}`);

r = await login("mahasiswa.satu@demo.id", "mahasiswa-demo-123", "11111111-1111-1111-1111-111111111111");
check("login with unregistered device -> 401", r.status === 401, `status=${r.status}`);

r = await login("mahasiswa.satu@demo.id", "mahasiswa-demo-123", DEVICE_IDS.mhs1);
check(
  "login valid mahasiswa -> 200 + role mahasiswa",
  r.status === 200 && r.json?.user?.role === "mahasiswa" && typeof r.json?.accessToken === "string",
  `status=${r.status}`,
);
const mhsAccess = r.json?.accessToken;
const mhsRefresh = r.json?.refreshToken;
const mhsClaims = decodeJwt(mhsAccess);
check(
  "access JWT claims sub+role, TTL 600s",
  mhsClaims.sub.startsWith("00000000") === true &&
    mhsClaims.role === "mahasiswa" &&
    mhsClaims.exp - mhsClaims.iat === 600,
  `role=${mhsClaims.role}, ttl=${mhsClaims.exp - mhsClaims.iat}`,
);

r = await post("/auth/refresh", { refreshToken: "bukan-token-valid" });
check("refresh with garbage token -> 401", r.status === 401, `status=${r.status}`);

r = await post("/auth/refresh", { refreshToken: mhsRefresh });
check(
  "refresh with valid token -> 200 + new access token",
  r.status === 200 && typeof r.json?.accessToken === "string" && r.json.accessToken !== mhsAccess,
  `status=${r.status}`,
);

r = await login("dosen.satu@demo.id", "dosen-demo-123", DEVICE_IDS.dosen1);
check("login valid dosen -> 200 + role dosen", r.status === 200 && r.json?.user?.role === "dosen", `status=${r.status}`);
const dosenRefresh = r.json?.refreshToken;

r = await login("admin@demo.id", "admin-demo-123", DEVICE_IDS.admin);
check("login valid admin -> 200 + role admin", r.status === 200 && r.json?.user?.role === "admin", `status=${r.status}`);

r = await post("/auth/logout", { refreshToken: dosenRefresh });
check("logout with valid refresh token -> 200", r.status === 200, `status=${r.status}`);

r = await post("/auth/refresh", { refreshToken: dosenRefresh });
check("refresh after logout (revoked) -> 401", r.status === 401, `status=${r.status}`);

r = await post("/auth/logout", { refreshToken: dosenRefresh });
check("logout again (already revoked) -> 401", r.status === 401, `status=${r.status}`);

r = await post("/auth/service", { clientId: "nilai-service", clientSecret: "nilai-service-demo-secret" });
check(
  "service token issuance with valid credentials -> 200",
  r.status === 200 && typeof r.json?.serviceToken === "string",
  `status=${r.status}`,
);
if (r.status === 200) {
  const claims = decodeJwt(r.json.serviceToken);
  check(
    "service token claims role=service, TTL 300s",
    claims.role === "service" && claims.sub === "nilai-service" && claims.exp - claims.iat === 300,
    `role=${claims.role}, ttl=${claims.exp - claims.iat}`,
  );
}

r = await post("/auth/service", { clientId: "nilai-service", clientSecret: "wrong-secret" });
check("service token wrong secret -> 401", r.status === 401, `status=${r.status}`);

r = await post("/auth/service", { clientId: "unknown-service", clientSecret: "nilai-service-demo-secret" });
check("service token unknown client -> 401", r.status === 401, `status=${r.status}`);

const headers = {
  apikey: envMap.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${envMap.SUPABASE_SERVICE_ROLE_KEY}`,
};
const auditBase = new URL(envMap.SUPABASE_URL).origin;
const audit = await fetch(`${auditBase}/rest/v1/audit_logs?order=timestamp.desc&limit=50`, { headers });
const auditRows = await audit.json();
const allows = auditRows.filter((row) => row.decision === "allow").length;
const denies = auditRows.filter((row) => row.decision === "deny").length;
check(
  "audit logs record allow and deny",
  audit.status === 200 && allows > 0 && denies > 0,
  `allow=${allows}, deny=${denies}`,
);

const failed = results.filter((x) => !x.ok);
console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length > 0 ? 1 : 0);
