const fs = await import("node:fs");
const envMap = {};
for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (match) envMap[match[1]] ??= match[2];
}

const base = new URL(envMap.SUPABASE_URL).origin;
const headers = {
  apikey: envMap.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${envMap.SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

const CLASS_UNFINALIZED = "20000000-0000-0000-0000-000000000001";
const NILAI = {
  drafA: "40000000-0000-0000-0000-000000000001",
  drafB: "40000000-0000-0000-0000-000000000002",
  finalA: "40000000-0000-0000-0000-000000000003",
  finalB: "40000000-0000-0000-0000-000000000004",
};

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(`${base}/rest/v1/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch (err) {
    console.error(`✗ ${method} ${path.split("?")[0]} — koneksi ke Supabase gagal: ${err.message}`);
    process.exit(1);
  }
  if (!res.ok) {
    const text = await res.text();
    console.error(`✗ ${method} ${path.split("?")[0]} — status ${res.status}\n${text}`);
    process.exit(1);
  }
  const json = await res.json().catch(() => ({}));
  const count = Array.isArray(json) ? json.length : null;
  console.log(`✓ ${method} ${path.split("?")[0]}${count !== null ? ` (${count} baris tersentuh)` : ""}`);
  return json;
}

const patch = (path, body) => request("PATCH", path, body);
const del = (path) => request("DELETE", path);

export async function resetSeedState() {
  await patch(`grades?id=in.(${NILAI.drafA},${NILAI.drafB})`, { is_finalized: false });
  await patch(`grades?id=eq.${NILAI.drafA}`, { score: 88 });
  await patch(`grades?id=eq.${NILAI.drafB}`, { score: 75 });
  await patch(`grades?id=in.(${NILAI.finalA},${NILAI.finalB})`, { is_finalized: true });
  await patch(`grades?id=eq.${NILAI.finalA}`, { score: 90 });
  await patch(`grades?id=eq.${NILAI.finalB}`, { score: 67 });
  await patch(`classes?id=eq.${CLASS_UNFINALIZED}`, { is_finalized: false, finalized_at: null });

  await del("transcript_items?id=neq.00000000-0000-0000-0000-000000000000");
  await del("transcripts?id=neq.00000000-0000-0000-0000-000000000000");
  await del("audit_logs?id=neq.000000000000");

  const kelas = await request("GET", `classes?id=eq.${CLASS_UNFINALIZED}&select=class_name,is_finalized`);
  const nilai = await request("GET", `grades?id=in.(${NILAI.drafA},${NILAI.drafB})&select=score,is_finalized`);

  console.log("\nVerifikasi akhir:");
  for (const k of kelas) {
    console.log(
      `  kelas ${k.class_name}: ${k.is_finalized ? "MASIH FINAL ✗" : "draf ✓"}`,
    );
  }
  for (const n of nilai) {
    console.log(`  nilai ${n.score}: ${n.is_finalized ? "masih final ✗" : "draf ✓"}`);
  }
  const adaMasalah = kelas.some((k) => k.is_finalized) || nilai.some((n) => n.is_finalized);
  if (adaMasalah) {
    console.error("✗ Reset tidak sempurna — periksa baris di atas.");
    process.exit(1);
  }
}

import { pathToFileURL } from "node:url";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log("Meriset contoh data ke kondisi awal…");
  await resetSeedState();
  console.log("\nSelesai — kelas IF-2101 siap difinalisasi ulang oleh Dosen Satu.");
}
