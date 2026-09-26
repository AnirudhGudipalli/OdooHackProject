
const bcrypt = require('bcryptjs');
const { signToken } = require('../middleware/auth');
const db = require('../db');

async function signup(req, res) {
  const { name, email, password, role, warehouse_id } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({
      error: 'name, email, password, and role are required'
    });
  }

  if (!['MANAGER', 'STAFF'].includes(role)) {
    return res.status(400).json({
      error: 'role must be MANAGER or STAFF'
    });
  }

  if (role === 'STAFF' && !warehouse_id) {
    return res.status(400).json({
      error: 'warehouse_id is required for STAFF role'
    });
  }

  try {
    const normalizedEmail = email.toLowerCase();

    const existing = await db.query(
      `SELECT id FROM users WHERE email = $1`,
      [normalizedEmail]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: 'Email already registered'
      });
    }

    const hash = await bcrypt.hash(password, 10);
    const wh = role === 'STAFF' ? parseInt(warehouse_id) : null;

    if (wh !== null) {
      const warehouse = await db.query(
        `SELECT id FROM warehouses WHERE id = $1`,
        [wh]
      );

      if (warehouse.rows.length === 0) {
        return res.status(400).json({
          error: 'Invalid warehouse'
        });
      }
    }

    const result = await db.query(
      `INSERT INTO users
       (name, email, password, role, warehouse_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, warehouse_id, created_at`,
      [name, normalizedEmail, hash, role, wh]
    );

    const user = result.rows[0];

    const token = signToken(user);

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        warehouse_id: user.warehouse_id
      }
    });
  } catch (err) {
    console.error('Signup error:', err);

    if (err.code === '23505') {
      return res.status(409).json({
        error: 'Email already registered'
      });
    }

    return res.status(500).json({
      error: 'Failed to create account'
    });
  }
}

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: 'email and password are required'
    });
  }

  try {
    const normalizedEmail = email.toLowerCase();

    const result = await db.query(
      `SELECT id, name, email, password, role, warehouse_id
       FROM users
       WHERE email = $1`,
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    const user = result.rows[0];

    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    let warehouseName = null;

    if (user.warehouse_id) {
      const warehouse = await db.query(
        `SELECT name
         FROM warehouses
         WHERE id = $1`,
        [user.warehouse_id]
      );

      if (warehouse.rows.length > 0) {
        warehouseName = warehouse.rows[0].name;
      }
    }

    const token = signToken(user);

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        warehouse_id: user.warehouse_id,
        warehouse_name: warehouseName
      }
    });
  } catch (err) {
    console.error('Login error:', err);

    return res.status(500).json({
      error: 'Failed to login'
    });
  }
}

async function forgotPassword(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      error: 'email is required'
    });
  }

  try {
    const normalizedEmail = email.toLowerCase();

    const user = await db.query(
      `SELECT id
       FROM users
       WHERE email = $1`,
      [normalizedEmail]
    );

    if (user.rows.length === 0) {
      return res.json({
        message: 'If that email is registered, an OTP will be sent',
        otp: null
      });
    }

    const otp = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    const expiresAt = new Date(
      Date.now() + 10 * 60 * 1000
    );

    await db.query(
      `INSERT INTO password_reset_otps
       (email, otp, expires_at)
       VALUES ($1, $2, $3)`,
      [normalizedEmail, otp, expiresAt]
    );

    return res.json({
      message: 'OTP generated (dev mode — returned in response)',
      otp
    });
  } catch (err) {
    console.error('Forgot password error:', err);

    return res.status(500).json({
      error: 'Failed to generate OTP'
    });
  }
}

async function verifyOtp(req, res) {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({
      error: 'email and otp are required'
    });
  }

  try {
    const normalizedEmail = email.toLowerCase();

    const result = await db.query(
      `SELECT id, otp, expires_at
       FROM password_reset_otps
       WHERE email = $1
         AND otp = $2
         AND used = FALSE
       ORDER BY created_at DESC
       LIMIT 1`,
      [normalizedEmail, otp]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        error: 'Invalid OTP'
      });
    }

    const record = result.rows[0];

    if (new Date() > new Date(record.expires_at)) {
      await db.query(
        `UPDATE password_reset_otps
         SET used = TRUE
         WHERE id = $1`,
        [record.id]
      );

      return res.status(400).json({
        error: 'OTP has expired'
      });
    }

    return res.json({
      message: 'OTP verified',
      valid: true
    });
  } catch (err) {
    console.error('Verify OTP error:', err);

    return res.status(500).json({
      error: 'Failed to verify OTP'
    });
  }
}

async function resetPassword(req, res) {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({
      error: 'email, otp, and newPassword are required'
    });
  }

  try {
    const normalizedEmail = email.toLowerCase();

    const otpResult = await db.query(
      `SELECT id, otp, expires_at
       FROM password_reset_otps
       WHERE email = $1
         AND otp = $2
         AND used = FALSE
       ORDER BY created_at DESC
       LIMIT 1`,
      [normalizedEmail, otp]
    );

    if (otpResult.rows.length === 0) {
      return res.status(400).json({
        error: 'Invalid OTP'
      });
    }

    const record = otpResult.rows[0];

    if (new Date() > new Date(record.expires_at)) {
      await db.query(
        `UPDATE password_reset_otps
         SET used = TRUE
         WHERE id = $1`,
        [record.id]
      );

      return res.status(400).json({
        error: 'OTP has expired'
      });
    }

    const userResult = await db.query(
      `SELECT id
       FROM users
       WHERE email = $1`,
      [normalizedEmail]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const hash = await bcrypt.hash(newPassword, 10);

    await db.query(
      `UPDATE users
       SET password = $1
       WHERE email = $2`,
      [hash, normalizedEmail]
    );

    await db.query(
      `UPDATE password_reset_otps
       SET used = TRUE
       WHERE id = $1`,
      [record.id]
    );

    return res.json({
      message: 'Password reset successfully'
    });
  } catch (err) {
    console.error('Reset password error:', err);

    return res.status(500).json({
      error: 'Failed to reset password'
    });
  }
}

module.exports = {
  signup,
  login,
  forgotPassword,
  verifyOtp,
  resetPassword
};

