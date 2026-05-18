const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  // Accept token from httpOnly cookie (preferred) or Authorization header (fallback)
  const token = req.cookies?.vem_token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
}

function requireManager(req, res, next) {
  if (req.user.role !== 'manager' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Manager access required' });
  }
  next();
}

module.exports = { authenticateToken, requireManager };
