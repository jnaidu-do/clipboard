// Schema + sample seed with retries for first deploy
import { makePool, withRetry } from '../src/db.js';

const pool = makePool();

async function ensureExtensions() {
  // gen_random_uuid() is in pgcrypto on many managed clusters
  await pool.query('create extension if not exists pgcrypto');
}

async function migrate() {
  await ensureExtensions();
  await pool.query(`
    create table if not exists clips (
      id uuid primary key default gen_random_uuid(),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      title text not null,
      body text not null,
      tags text[]
    );
    create index if not exists clips_created_at_idx on clips(created_at desc);
    create index if not exists clips_tags_gin on clips using gin(tags);
  `);
}

async function seed() {
  // Only seed if empty
  const { rows } = await pool.query('select count(*)::int as n from clips');
  if (rows[0].n > 0) return;
  const samples = [
    { title: 'Welcome to Clipboard', body: 'Save quick notes with optional tags.', tags: ['welcome', 'info'] },
    { title: 'Pro tip', body: 'Filter by tag from the dropdown.', tags: ['tips'] },
    { title: 'Sample', body: 'Edit or delete me.', tags: null },
  ];
  for (const s of samples) {
    await pool.query('insert into clips(title, body, tags) values($1,$2,$3)', [s.title, s.body, s.tags]);
  }
}

async function main() {
  await withRetry(() => migrate(), { label: 'migrate' });
  await withRetry(() => seed(), { label: 'seed' });
}

main()
  .then(() => {
    console.log('db-init complete');
    return pool.end();
  })
  .catch((e) => {
    console.error('db-init failed', e);
    pool.end().finally(() => process.exit(1));
  });
