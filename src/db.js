// Postgres Pool helper — intentionally broken for Debug with MARS demo
// (bare DATABASE_URL leaves sslmode=require; recent pg fails on managed CA).
import { Pool } from "pg";

export function makePool() {
  const { DATABASE_URL } = process.env;
  if (!DATABASE_URL) throw new Error("DATABASE_URL is required");
  return new Pool({
    connectionString: DATABASE_URL,
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
