const bcrypt = require('bcryptjs');
const { signToken } = require('../middleware/auth');
const db = require('../store');

async function signup(req, res) {
  const { name, email, password, role, warehouse_id } = req.body;

  if (!name || !email || !password || !role)
    return res.status(400).json({ error: 'name, email, password, and role are required' });
  if (!['MANAGER', 'STAFF'].includes(role))
    return res.status(400).json({ error: 'role must be MANAGER or STAFF' });
  if (role === 'STAFF' && !warehouse_id)
    return res.status(400).json({ error: 'warehouse_id is required for STAFF role' });

  const existing = db.users.find(u => u.email === email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const hash = await bcrypt.hash(password, 10);
  const wh = role === 'STAFF' ? parseInt(warehouse_id) : null;
  const user = {
    id: db.nextId('users'),
    name,
    email: email.toLowerCase(),
    password: hash,
    role,
    warehouse_id: wh,
    created_at: new Date(),
  };
  db.users.push(user);

  const token = signToken(user);
  return res.status(201).json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, warehouse_id: user.warehouse_id },
  });
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'email and password are required' });

  const user = db.users.find(u => u.email === email.toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  const wh = db.warehouses.find(w => w.id === user.warehouse_id);
  const token = signToken(user);
  return res.json({
    token,
    user: {
      id: user.id, name: user.name, email: user.email,
      role: user.role, warehouse_id: user.warehouse_id,
      warehouse_name: wh ? wh.name : null,
    },
  });
}

async function forgotPassword(req, res) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });

  const user = db.users.find(u => u.email === email.toLowerCase());
  if (!user)
    return res.json({ message: 'If that email is registered, an OTP will be sent', otp: null });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  db.otpStore.set(email.toLowerCase(), { otp, expires: Date.now() + 10 * 60 * 1000 });
  return res.json({ message: 'OTP generated (dev mode — returned in response)', otp });
}

async function verifyOtp(req, res) {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'email and otp are required' });
  const record = db.otpStore.get(email.toLowerCase());
  if (!record || record.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });
  if (Date.now() > record.expires) {
    db.otpStore.delete(email.toLowerCase());
    return res.status(400).json({ error: 'OTP has expired' });
  }
  return res.json({ message: 'OTP verified', valid: true });
}

async function resetPassword(req, res) {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword)
    return res.status(400).json({ error: 'email, otp, and newPassword are required' });

  const record = db.otpStore.get(email.toLowerCase());
  if (!record || record.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });
  if (Date.now() > record.expires) {
    db.otpStore.delete(email.toLowerCase());
    return res.status(400).json({ error: 'OTP has expired' });
  }

  const user = db.users.find(u => u.email === email.toLowerCase());
  if (!user) return res.status(404).json({ error: 'User not found' });

  user.password = await bcrypt.hash(newPassword, 10);
  db.otpStore.delete(email.toLowerCase());
  return res.json({ message: 'Password reset successfully' });
}

module.exports = { signup, login, forgotPassword, verifyOtp, resetPassword };
