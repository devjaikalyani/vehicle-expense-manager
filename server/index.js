require('dotenv').config();
const express = require('express');
const http = require('http');
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
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(cookieParser());
app.use(express.json());

// Serve uploaded receipt files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use((req, _res, next) => { req.io = io; next(); });

app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/gps', gpsRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/receipts', receiptsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/push', pushRouter);

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
server.listen(PORT, () => console.log(`VEM server running on http://localhost:${PORT}`));
