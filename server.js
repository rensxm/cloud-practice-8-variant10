const express = require('express');
const pool = require('./db');
const app = express();
const PORT = process.env.PORT || 3000;
app.disable('x-powered-by');

// Сұраныс денесі мен URL query бөлігін журналға жазбаймыз.
app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => console.log(JSON.stringify({
    time: new Date().toISOString(), method: req.method, url: req.path,
    status: res.statusCode, durationMs: Date.now() - started
  })));
  next();
});
app.use(express.json({ limit: '16kb' }));

app.get('/practice', (req, res) => res.json({ practice: 8, variant: 10, version: 'independent' }));
app.get('/', (req, res) => res.redirect('/demo'));
app.get('/demo', (req, res) => res.sendFile(require('node:path').join(__dirname, 'demo.html')));
app.get('/info', (req, res) => res.json({
  status: 'ok',
  practice: 8,
  variant: process.env.STUDENT_VARIANT || 'not-set',
  databaseConfigured: Boolean(process.env.DATABASE_URL)
}));

// Бұл маршрут базаға сұраныс жібермейді.
app.get('/health', (req, res) => res.status(200).json({
  status: 'ok', time: new Date().toISOString()
}));

app.get('/health/db', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error(JSON.stringify({ time: new Date().toISOString(),
      event: 'DB_HEALTH_ERROR', code: error.code || 'UNKNOWN' }));
    res.status(503).json({ status: 'degraded', database: 'unavailable' });
  }
});

async function listFiles(req, res) {
  const result = await pool.query('SELECT id, name, content_type, size_bytes FROM files ORDER BY id');
  res.json(result.rows);
}
app.get('/api/files', listFiles);
app.get('/files', listFiles);

app.get('/api/files/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!/^\d+$/.test(req.params.id) || !Number.isInteger(id) || id < 1 || id > 2147483647) {
    return res.status(400).json({ error: 'id оң бүтін сан болуы керек' });
  }
  const result = await pool.query(
    'SELECT id, name, content_type, size_bytes FROM files WHERE id = $1', [id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Файл табылмады' });
  res.json(result.rows[0]);
});

function validateFile(req, res, next) {
  const { name, content_type, size_bytes } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 255 ||
      typeof content_type !== 'string' || !content_type.trim() || content_type.trim().length > 127 ||
      !Number.isInteger(size_bytes) || size_bytes < 0 || size_bytes > 2147483647) {
    return res.status(400).json({ error: 'name, content_type және теріс емес бүтін size_bytes қажет' });
  }
  req.fileData = [name.trim(), content_type.trim(), size_bytes];
  next();
}

app.post('/api/files', validateFile, async (req, res) => {
  const result = await pool.query(
    'INSERT INTO files (name, content_type, size_bytes) VALUES ($1, $2, $3) RETURNING id, name, content_type, size_bytes',
    req.fileData
  );
  res.location(`/api/files/${result.rows[0].id}`).status(201).json(result.rows[0]);
});

app.put('/api/files/:id', validateFile, async (req, res) => {
  const id = Number(req.params.id);
  if (!/^\d+$/.test(req.params.id) || !Number.isInteger(id) || id < 1 || id > 2147483647) {
    return res.status(400).json({ error: 'id оң бүтін сан болуы керек' });
  }
  const result = await pool.query(
    'UPDATE files SET name=$1, content_type=$2, size_bytes=$3 WHERE id=$4 RETURNING id, name, content_type, size_bytes',
    [...req.fileData, id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Файл табылмады' });
  res.status(200).json(result.rows[0]);
});

app.use((req, res) => res.status(404).json({ error: 'Маршрут табылмады' }));
app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON пішімі қате' });
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Сұраныс көлемі тым үлкен' });
  if (error.code === '23505') return res.status(409).json({ error: 'Мұндай атауы бар файл тіркелген' });
  console.error(JSON.stringify({ time: new Date().toISOString(),
    event: 'SERVER_ERROR', method: req.method, url: req.path,
    code: error.code || 'UNKNOWN' }));
  res.status(500).json({ error: 'Серверде қате пайда болды' });
});

const server = app.listen(PORT, '0.0.0.0', () => console.log(`Сервер ${PORT} портында іске қосылды`));
async function stop() {
  server.close(async () => { await pool.end(); process.exit(0); });
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
