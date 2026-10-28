const loadEnv = async () => {
  const { readFileSync } = await import("node:fs");
  const lines = readFileSync(".env", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2];
    }
  }
};

await loadEnv();

const rawUrl = process.env.SUPABASE_URL;
const url = rawUrl ? new URL(rawUrl).origin : undefined;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.log("RESULT: MISSING CREDENTIALS");
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };

const root = await fetch(`${url}/rest/v1/`, { headers });
console.log(`REST endpoint status: ${root.status}`);

const users = await fetch(`${url}/rest/v1/users?select=id,name,role&limit=3`, { headers });
console.log(`users table status: ${users.status}`);
if (users.ok) {
  const rows = await users.json();
  console.log(`users rows: ${JSON.stringify(rows)}`);
} else {
  const body = await users.json().catch(() => ({}));
  console.log(`users table detail: ${JSON.stringify(body.message ?? body.error ?? body)}`);
}
