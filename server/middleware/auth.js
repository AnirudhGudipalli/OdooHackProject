const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'stocksense_dev_secret_key_2024';

/**
 * Verifies JWT and attaches user payload to req.user
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, email, role, warehouse_id }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Restricts endpoint to MANAGER role only
 */
function requireManager(req, res, next) {
  if (!req.user || req.user.role !== 'MANAGER') {
    return res.status(403).json({ error: 'Manager access required' });
  }
  next();
}

/**
 * Generates a signed JWT for a user
 */
function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, warehouse_id: user.warehouse_id },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

module.exports = { authenticate, requireManager, signToken };
