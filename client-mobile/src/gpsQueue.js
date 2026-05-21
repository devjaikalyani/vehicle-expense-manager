const KEY = 'vem_gps_queue';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

function save(q) {
  try { localStorage.setItem(KEY, JSON.stringify(q)); } catch {}
}

export function enqueue(point) {
  const q = load();
  q.push(point);
  save(q);
}

export function size() {
  return load().length;
}

export async function flush() {
  const q = load();
  if (q.length === 0) return;

  const failed = [];
  for (const point of q) {
    try {
      const r = await fetch('/api/gps/track', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(point),
      });
      if (!r.ok) failed.push(point);
    } catch {
      failed.push(point);
    }
  }
  save(failed);
}
