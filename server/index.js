require('dotenv').config({ path: require('path').join(__dirname, '.env') });

// Validate required environment variables before anything else
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter(v => !process.env[v]);
if (missing.length) {
  console.error(`[VEM] Missing required environment variables: ${missing.join(', ')}`);
  console.error('[VEM] Copy server/.env.example to server/.env and fill in the values.');
  process.exit(1);
}

if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  console.warn('[VEM] VAPID keys not set — push notifications disabled. Run: node scripts/gen-vapid.js');
}

const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const db = require('./db');

const authRoutes = require('./routes/auth');
const tripRoutes = require('./routes/trips');
const gpsRoutes = require('./routes/gps');
const employeeRoutes = require('./routes/employees');
const receiptsRoutes = require('./routes/receipts');
const reportsRoutes = require('./routes/reports');
const { router: pushRouter } = require('./routes/push');

const app = express();

// SSL — use local cert if present, otherwise plain HTTP
const certPath = path.join(__dirname, '../192.168.10.215+2.pem');
const keyPath  = path.join(__dirname, '../192.168.10.215+2-key.pem');
const useHttps = fs.existsSync(certPath) && fs.existsSync(keyPath);
const server = useHttps
  ? https.createServer({ cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }, app)
  : http.createServer(app);

const isProd = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',').map(s => s.trim()).filter(Boolean);

function originAllowed(origin, callback) {
  if (!isProd || !origin || allowedOrigins.includes(origin)) return callback(null, true);
  callback(null, false);
}

// In-memory live locations: userId -> location data
const liveLocations = new Map();

const io = new Server(server, {
  cors: { origin: originAllowed, methods: ['GET', 'POST'], credentials: true },
});

// Authenticate Socket.IO connections via the httpOnly cookie
io.use((socket, next) => {
  const cookies = socket.handshake.headers?.cookie || '';
  const match = cookies.match(/evm_token=([^;]+)/);
  const token = match?.[1] || socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: originAllowed, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Serve uploaded receipt files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use((req, _res, next) => { req.io = io; req.liveLocations = liveLocations; next(); });

// Health check — for load balancers and uptime monitors
app.get('/health', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ ok: true, uptime: Math.round(process.uptime()) });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/gps', gpsRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/receipts', receiptsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/push', pushRouter);

// Serve mobile PWA at /m/
const mobileDist = path.join(__dirname, 'mobile-dist');
if (fs.existsSync(mobileDist)) {
  app.use('/m', express.static(mobileDist));
  app.get('/m', (_req, res) => res.redirect(301, '/m/'));
  app.get('/m/*', (_req, res) => res.sendFile(path.join(mobileDist, 'index.html')));
}

// Serve admin frontend at /
const clientDist = path.join(__dirname, '../client-admin/dist');
if (!fs.existsSync(clientDist)) {
  console.warn('[VEM] Admin client build missing. Run: npm run build --prefix client-admin');
}
app.use(express.static(clientDist));
app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));

io.on('connection', (socket) => {
  socket.emit('gps:locations', Object.fromEntries(liveLocations));

  socket.on('gps:update', (data) => {
    liveLocations.set(String(data.userId), { ...data, timestamp: new Date().toISOString() });
    socket.broadcast.emit('gps:locations', Object.fromEntries(liveLocations));
  });

  socket.on('gps:stop', (data) => {
    liveLocations.delete(String(data.userId));
    io.emit('gps:locations', Object.fromEntries(liveLocations));
  });
});

const PORT = process.env.PORT || 3001;
const proto = useHttps ? 'https' : 'http';

async function start() {
  try {
    await db.query('SELECT 1');
    console.log('[VEM] Database connected');
  } catch (err) {
    console.error('[VEM] Database connection failed:', err.message);
    process.exit(1);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[VEM] Server running on ${proto}://localhost:${PORT}`);
    console.log(`[VEM] Admin panel : ${proto}://localhost:${PORT}/`);
    console.log(`[VEM] Mobile PWA  : ${proto}://localhost:${PORT}/m/`);
    if (useHttps) console.log(`[VEM] Network     : https://192.168.10.215:${PORT}`);
  });
}

start();
