// Postgres Pool helper — intentionally broken for Debug with MARS demo
// (bare DATABASE_URL leaves sslmode=require; recent pg fails on managed CA).
import { Pool } from "pg";

// Normalize DATABASE_URL for DigitalOcean managed Postgres:
// - Strip sslmode / ssl from the URL (pg treats `require` as verify-full)
// - Still set ssl.rejectUnauthorized=false on the client
function normalizeDatabaseUrl(raw) {
  try {
    const u = new URL(raw);
    u.searchParams.delete('sslmode');
    u.searchParams.delete('ssl');
    return u.toString();
  } catch {
    return String(raw)
      .replace(/([?&])sslmode=[^&]*/gi, '$1')
      .replace(/([?&])ssl=[^&]*/gi, '$1')
      .replace(/[?&]$/, '')
      .replace(/\?&/, '?');
  }
}

export function makePool() {
  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
  return new Pool({
    // Strip sslmode/ssl from URL and disable CA verification for demo/dev
    connectionString: normalizeDatabaseUrl(DATABASE_URL),
    ssl: { rejectUnauthorized: false },
  });
}

export async function withRetry(
  fn,
  {
    attempts = Number(process.env.DB_INIT_ATTEMPTS || 30),
    delayMs = Number(process.env.DB_INIT_DELAY_MS || 1000),
    label = "db-op",
  } = {}
) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i === attempts) break;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  lastErr.message = `${label} failed after retries: ${lastErr.message}`;
  throw lastErr;
}
