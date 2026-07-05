import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(path) {
  const vars = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    vars[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return vars;
}

const env = loadEnv(join(root, ".env"));
const password = env.SUPABASE_DB_PASSWORD;
const url = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");

if (!password || !url) {
  console.error("Missing SUPABASE_DB_PASSWORD or NEXT_PUBLIC_SUPABASE_URL in .env");
  process.exit(1);
}

const ref = new URL(url).hostname.split(".")[0];
const poolerHost = env.SUPABASE_DB_HOST ?? "aws-1-us-west-2.pooler.supabase.com";
const migrationsDir = join(root, "supabase", "migrations");
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const client = new Client({
  host: poolerHost,
  port: 5432,
  user: `postgres.${ref}`,
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

try {
  await client.connect();
  console.log(`Connected via ${poolerHost}`);
} catch (err) {
  console.error(`Connection failed: ${err.message}`);
  process.exit(1);
}

try {
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    process.stdout.write(`Running ${file}... `);
    await client.query(sql);
    console.log("OK");
  }
  console.log(`\nDone — applied ${files.length} migrations.`);
} catch (err) {
  console.error(`\nMigration failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
