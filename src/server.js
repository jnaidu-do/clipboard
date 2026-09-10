import express from 'express';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import { makePool, withRetry } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const pool = makePool();

app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Static frontend
app.use('/', express.static(path.join(__dirname, '..', 'public')));

// Health endpoint
app.get('/health', async (req, res) => {
  try {
    await pool.query('select 1');
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ status: 'err', error: e.message });
  }
});

// API: clips
// Data model: clips(id uuid default gen_random_uuid(), created_at timestamptz default now(), updated_at timestamptz default now(), title text not null, body text not null, tags text[] null)

// Create
app.post('/api/clips', async (req, res) => {
  const { title, body, tags } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: 'title and body are required' });
  const tagsArr = Array.isArray(tags) ? tags : (typeof tags === 'string' && tags.length ? tags.split(',').map(t => t.trim()).filter(Boolean) : null);
  try {
    const { rows } = await pool.query(
      'insert into clips(title, body, tags) values($1, $2, $3) returning *',
      [title, body, tagsArr]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// List (newest first), optional filter by tag
app.get('/api/clips', async (req, res) => {
  const { tag } = req.query;
  try {
    let rows;
    if (tag) {
      const r = await pool.query('select * from clips where $1 = any(tags) order by created_at desc', [tag]);
      rows = r.rows;
    } else {
      const r = await pool.query('select * from clips order by created_at desc');
      rows = r.rows;
    }
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Read single
app.get('/api/clips/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query('select * from clips where id = $1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update
app.put('/api/clips/:id', async (req, res) => {
  const { id } = req.params;
  const { title, body, tags } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: 'title and body are required' });
  const tagsArr = Array.isArray(tags) ? tags : (typeof tags === 'string' && tags.length ? tags.split(',').map(t => t.trim()).filter(Boolean) : null);
  try {
    const { rows } = await pool.query(
      'update clips set title=$1, body=$2, tags=$3, updated_at=now() where id=$4 returning *',
      [title, body, tagsArr, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete
app.delete('/api/clips/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('delete from clips where id = $1', [id]);
    if (!rowCount) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Start server
const port = process.env.PORT || 8080;
app.set('trust proxy', true);
app.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${port}`);
});
