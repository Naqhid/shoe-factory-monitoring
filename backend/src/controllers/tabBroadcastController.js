const broadcasts = new Map();

const BROADCAST_TTL_MS = 30 * 1000;

const normalizeBroadcastId = (rawId = '') =>
  String(rawId || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '');

const isFresh = (updatedAt) => Date.now() - updatedAt <= BROADCAST_TTL_MS;

const upsertFrame = (req, res) => {
  const broadcastId = normalizeBroadcastId(req.params.broadcastId);
  const { imageDataUrl, sourcePage } = req.body || {};

  if (!broadcastId) {
    return res.status(400).json({ success: false, error: 'Invalid broadcast id' });
  }

  if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/jpeg;base64,')) {
    return res.status(400).json({ success: false, error: 'imageDataUrl must be a jpeg data URL' });
  }

  broadcasts.set(broadcastId, {
    imageDataUrl,
    sourcePage: typeof sourcePage === 'string' ? sourcePage : '',
    updatedAt: Date.now(),
  });

  return res.json({ success: true, data: { broadcastId } });
};

const getFrame = (req, res) => {
  const broadcastId = normalizeBroadcastId(req.params.broadcastId);
  const record = broadcasts.get(broadcastId);

  if (!record) {
    return res.status(404).json({ success: false, error: 'No active broadcast found' });
  }

  return res.json({
    success: true,
    data: {
      broadcastId,
      imageDataUrl: record.imageDataUrl,
      sourcePage: record.sourcePage,
      updatedAt: record.updatedAt,
      isLive: isFresh(record.updatedAt),
      ttlMs: BROADCAST_TTL_MS,
    },
  });
};

const stopBroadcast = (req, res) => {
  const broadcastId = normalizeBroadcastId(req.params.broadcastId);
  const deleted = broadcasts.delete(broadcastId);
  return res.json({ success: true, data: { broadcastId, stopped: deleted } });
};

const viewerPage = (req, res) => {
  const broadcastId = normalizeBroadcastId(req.params.broadcastId);
  if (!broadcastId) {
    return res.status(400).send('Invalid broadcast id');
  }

  return res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tab Broadcast - ${broadcastId}</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #0f172a; color: #e2e8f0; }
    .wrap { max-width: 1200px; margin: 20px auto; padding: 0 16px; }
    .meta { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 12px; font-size: 14px; }
    .dot { width: 10px; height: 10px; border-radius: 9999px; display: inline-block; margin-right: 6px; }
    .live { background: #22c55e; } .offline { background: #ef4444; }
    .card { background: #111827; border: 1px solid #334155; border-radius: 8px; padding: 10px; }
    img { width: 100%; background: #000; border-radius: 6px; min-height: 300px; object-fit: contain; }
  </style>
</head>
<body>
  <div class="wrap">
    <h2>Broadcast: ${broadcastId}</h2>
    <div class="meta">
      <div id="status"><span class="dot offline"></span>Waiting for frames...</div>
      <div id="updated">Last update: --</div>
      <div id="source">Source page: --</div>
    </div>
    <div class="card">
      <img id="screen" alt="Broadcast screen" />
    </div>
  </div>
  <script>
    const statusEl = document.getElementById('status');
    const updatedEl = document.getElementById('updated');
    const sourceEl = document.getElementById('source');
    const imgEl = document.getElementById('screen');

    async function refresh() {
      try {
        const res = await fetch('/api/tab-broadcast/${broadcastId}/frame', { cache: 'no-store' });
        if (!res.ok) throw new Error('No frame');
        const payload = await res.json();
        const d = payload && payload.data;
        if (!d || !d.imageDataUrl) throw new Error('Invalid payload');
        imgEl.src = d.imageDataUrl;
        const updated = new Date(d.updatedAt);
        updatedEl.textContent = 'Last update: ' + updated.toLocaleString();
        sourceEl.textContent = 'Source page: ' + (d.sourcePage || '--');
        statusEl.innerHTML = d.isLive
          ? '<span class="dot live"></span>Live'
          : '<span class="dot offline"></span>Stale (tab inactive or stopped)';
      } catch (error) {
        statusEl.innerHTML = '<span class="dot offline"></span>Waiting for frames...';
      }
    }

    refresh();
    setInterval(refresh, 2000);
  </script>
</body>
</html>`);
};

setInterval(() => {
  const now = Date.now();
  for (const [id, record] of broadcasts.entries()) {
    if (now - record.updatedAt > BROADCAST_TTL_MS * 3) {
      broadcasts.delete(id);
    }
  }
}, 60 * 1000);

module.exports = {
  upsertFrame,
  getFrame,
  stopBroadcast,
  viewerPage,
};
