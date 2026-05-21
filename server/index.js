require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const authRoutes = require('./routes/auth');
const tripRoutes = require('./routes/trips');
const gpsRoutes = require('./routes/gps');
const employeeRoutes = require('./routes/employees');
const receiptsRoutes = require('./routes/receipts');
const reportsRoutes = require('./routes/reports');
const { router: pushRouter } = require('./routes/push');

const app = express();

// Use HTTPS with local cert if available, otherwise fall back to HTTP
const certPath = path.join(__dirname, '../192.168.10.215+2.pem');
const keyPath  = path.join(__dirname, '../192.168.10.215+2-key.pem');
const useHttps = fs.existsSync(certPath) && fs.existsSync(keyPath);
const server = useHttps
  ? https.createServer({ cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }, app)
  : http.createServer(app);

const isProd = process.env.NODE_ENV === 'production';
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function originAllowed(origin, callback) {
  if (!isProd || !origin || allowedOrigins.includes(origin)) return callback(null, true);
  callback(null, false);
}

const io = new Server(server, {
  cors: { origin: originAllowed, methods: ['GET', 'POST'], credentials: true },
});

app.use(cors({ origin: originAllowed, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Serve uploaded receipt files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use((req, _res, next) => { req.io = io; req.liveLocations = liveLocations; next(); });

app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/gps', gpsRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/receipts', receiptsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/push', pushRouter);

// Serve mobile PWA at /m/ (must be before desktop catch-all)
const mobileDist = path.join(__dirname, 'mobile-dist');
if (fs.existsSync(mobileDist)) {
  app.use('/m', express.static(mobileDist));
  app.get('/m', (_req, res) => res.redirect(301, '/m/'));
  app.get('/m/*', (_req, res) => res.sendFile(path.join(mobileDist, 'index.html')));
}

// Serve React frontend in production
const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));

// In-memory live locations: userId -> location data
const liveLocations = new Map();

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
server.listen(PORT, '0.0.0.0', () => {
  console.log(`VEM server running on ${proto}://localhost:${PORT}`);
  if (useHttps) console.log(`Local network: https://192.168.10.215:${PORT}`);
});
