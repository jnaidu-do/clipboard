const api = {
  async list(tag) {
    const u = tag ? `/api/clips?tag=${encodeURIComponent(tag)}` : '/api/clips';
    const r = await fetch(u);
    if (!r.ok) throw new Error('Failed to load');
    return r.json();
  },
  async create({ title, body, tags }) {
    const r = await fetch('/api/clips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, body, tags }) });
    if (!r.ok) throw new Error('Failed to create');
    return r.json();
  },
  async update(id, { title, body, tags }) {
    const r = await fetch(`/api/clips/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, body, tags }) });
    if (!r.ok) throw new Error('Failed to update');
    return r.json();
  },
  async remove(id) {
    const r = await fetch(`/api/clips/${id}`, { method: 'DELETE' });
    if (!r.ok && r.status !== 204) throw new Error('Failed to delete');
  },
};

const els = {
  list: document.getElementById('list'),
  form: document.getElementById('create-form'),
  title: document.getElementById('title'),
  body: document.getElementById('body'),
  tags: document.getElementById('tags'),
  filter: document.getElementById('filter-tag'),
  tpl: document.getElementById('clip-item'),
};

let state = { clips: [], filter: '' };

function renderTags(tags) {
  if (!tags || !tags.length) return '';
  return tags.map(t => `#${t}`).join(' ');
}

function collectTags(clips) {
  const set = new Set();
  clips.forEach(c => (c.tags || []).forEach(t => set.add(t)));
  return Array.from(set).sort();
}

function renderList() {
  els.list.innerHTML = '';
  state.clips.forEach(c => {
    const node = els.tpl.content.firstElementChild.cloneNode(true);
    node.dataset.id = c.id;
    node.querySelector('.title').textContent = c.title;
    node.querySelector('.body').textContent = c.body;
    node.querySelector('.tags').textContent = renderTags(c.tags);
    node.querySelector('.delete').addEventListener('click', async () => {
      await api.remove(c.id);
      await load();
    });
    node.querySelector('.edit').addEventListener('click', async () => {
      const title = prompt('Title', c.title);
      if (title == null) return;
      const body = prompt('Body', c.body);
      if (body == null) return;
      const tagsStr = prompt('Tags (comma-separated)', (c.tags || []).join(',')) || '';
      const tags = tagsStr.split(',').map(s => s.trim()).filter(Boolean);
      await api.update(c.id, { title, body, tags });
      await load();
    });
    els.list.appendChild(node);
  });
}

function renderFilter() {
  const tags = collectTags(state.clips);
  const sel = els.filter;
  const current = sel.value;
  sel.innerHTML = '<option value="">All</option>' + tags.map(t => `<option value="${t}">${t}</option>`).join('');
  if (tags.includes(current)) sel.value = current; else sel.value = '';
}

async function load() {
  const clips = await api.list(state.filter || undefined);
  state.clips = clips;
  renderFilter();
  renderList();
}

els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = els.title.value.trim();
  const body = els.body.value.trim();
  const tags = els.tags.value.split(',').map(s => s.trim()).filter(Boolean);
  if (!title || !body) return;
  await api.create({ title, body, tags });
  els.title.value = '';
  els.body.value = '';
  els.tags.value = '';
  await load();
});

els.filter.addEventListener('change', async () => {
  state.filter = els.filter.value || '';
  await load();
});

load().catch(err => {
  console.error(err);
  alert('Failed to load clips');
});
