
const db = require('../db');
const bcrypt = require('bcryptjs');

async function getDashboard(req, res) {
  try {
    if (req.user.role === 'MANAGER') {
      return await getManagerDashboard(req, res);
    }

    return await getStaffDashboard(req, res);
  } catch (err) {
    console.error('Dashboard error:', err);

    res.status(500).json({
      error: 'Failed to load dashboard'
    });
  }
}

async function getManagerDashboard(req, res) {
  const kpisResult = await db.query(`
    SELECT
      COALESCE((SELECT SUM(quantity) FROM stock), 0) AS total_stock,

      COALESCE((
        SELECT COUNT(*)
        FROM stock s
        JOIN products p ON p.id = s.product_id
        WHERE s.quantity > 0
          AND s.quantity <= p.reorder_level
      ), 0) AS low_stock_items,

      COALESCE((
        SELECT COUNT(*)
        FROM stock
        WHERE quantity = 0
      ), 0) AS out_of_stock_items,

      COALESCE((
        SELECT COUNT(*)
        FROM receipts
        WHERE status NOT IN ('DONE', 'CANCELED')
      ), 0) AS pending_receipts,

      COALESCE((
        SELECT COUNT(*)
        FROM deliveries
        WHERE status NOT IN ('DONE', 'CANCELED')
      ), 0) AS pending_deliveries
  `);

  const movementsResult = await db.query(`
    SELECT
      m.*,
      p.name AS product_name,
      w.name AS warehouse_name,
      u.name AS performed_by_name
    FROM stock_movements m
    JOIN products p ON p.id = m.product_id
    JOIN warehouses w ON w.id = m.warehouse_id
    LEFT JOIN users u ON u.id = m.performed_by
    ORDER BY m.id DESC
    LIMIT 10
  `);

  const receiptsResult = await db.query(`
    SELECT
      r.*,
      w.name AS warehouse_name
    FROM receipts r
    JOIN warehouses w ON w.id = r.warehouse_id
    ORDER BY r.id DESC
    LIMIT 5
  `);

  const deliveriesResult = await db.query(`
    SELECT
      d.*,
      w.name AS warehouse_name
    FROM deliveries d
    JOIN warehouses w ON w.id = d.warehouse_id
    ORDER BY d.id DESC
    LIMIT 5
  `);

  const warehouseResult = await db.query(`
    SELECT
      w.id,
      w.name,
      w.location,
      COALESCE(SUM(s.quantity), 0) AS total_stock,
      COUNT(s.id) FILTER (
        WHERE s.quantity = 0
      ) AS out_of_stock
    FROM warehouses w
    LEFT JOIN stock s
      ON s.warehouse_id = w.id
    GROUP BY w.id, w.name, w.location
    ORDER BY w.id
  `);

  const kpis = kpisResult.rows[0];

  res.json({
    kpis: {
      total_stock: Number(kpis.total_stock),
      low_stock_items: Number(kpis.low_stock_items),
      out_of_stock_items: Number(kpis.out_of_stock_items),
      pending_receipts: Number(kpis.pending_receipts),
      pending_deliveries: Number(kpis.pending_deliveries)
    },

    recent_movements: movementsResult.rows,

    recent_receipts: receiptsResult.rows,

    recent_deliveries: deliveriesResult.rows,

    warehouse_summary: warehouseResult.rows.map(w => ({
      ...w,
      total_stock: Number(w.total_stock),
      out_of_stock: Number(w.out_of_stock)
    }))
  });
}

async function getStaffDashboard(req, res) {
  const warehouseId = req.user.warehouse_id;

  if (!warehouseId) {
    return res.status(400).json({
      error: 'No warehouse assigned'
    });
  }

  const warehouseResult = await db.query(
    `
      SELECT
        id,
        name,
        location,
        created_at
      FROM warehouses
      WHERE id = $1
    `,
    [warehouseId]
  );

  if (warehouseResult.rows.length === 0) {
    return res.status(404).json({
      error: 'Warehouse not found'
    });
  }

  const kpisResult = await db.query(
    `
      SELECT
        COALESCE(SUM(s.quantity), 0) AS total_stock,

        COUNT(*) FILTER (
          WHERE s.quantity > 0
            AND s.quantity <= p.reorder_level
        ) AS low_stock_items,

        COUNT(*) FILTER (
          WHERE s.quantity = 0
        ) AS out_of_stock_items
      FROM stock s
      JOIN products p
        ON p.id = s.product_id
      WHERE s.warehouse_id = $1
    `,
    [warehouseId]
  );

  const pendingResult = await db.query(
    `
      SELECT
        (SELECT COUNT(*)
         FROM receipts
         WHERE warehouse_id = $1
           AND status NOT IN ('DONE', 'CANCELED')
        ) AS pending_receipts,

        (SELECT COUNT(*)
         FROM deliveries
         WHERE warehouse_id = $1
           AND status NOT IN ('DONE', 'CANCELED')
        ) AS pending_deliveries
    `,
    [warehouseId]
  );

  const movementsResult = await db.query(
    `
      SELECT
        m.*,
        p.name AS product_name,
        u.name AS performed_by_name
      FROM stock_movements m
      JOIN products p
        ON p.id = m.product_id
      LEFT JOIN users u
        ON u.id = m.performed_by
      WHERE m.warehouse_id = $1
      ORDER BY m.id DESC
      LIMIT 8
    `,
    [warehouseId]
  );

  const kpis = kpisResult.rows[0];
  const pending = pendingResult.rows[0];

  res.json({
    warehouse: warehouseResult.rows[0],

    kpis: {
      total_stock: Number(kpis.total_stock),
      low_stock_items: Number(kpis.low_stock_items),
      out_of_stock_items: Number(kpis.out_of_stock_items),
      pending_receipts: Number(pending.pending_receipts),
      pending_deliveries: Number(pending.pending_deliveries)
    },

    recent_movements: movementsResult.rows
  });
}

async function getProfile(req, res) {
  try {
    const result = await db.query(
      `
        SELECT
          u.id,
          u.name,
          u.email,
          u.role,
          u.warehouse_id,
          w.name AS warehouse_name,
          u.created_at
        FROM users u
        LEFT JOIN warehouses w
          ON w.id = u.warehouse_id
        WHERE u.id = $1
      `,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get profile error:', err);

    res.status(500).json({
      error: 'Failed to get profile'
    });
  }
}

async function updateProfile(req, res) {
  try {
    const { name, email, password } = req.body;

    const currentResult = await db.query(
      `
        SELECT *
        FROM users
        WHERE id = $1
      `,
      [req.user.id]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const user = currentResult.rows[0];

    if (email && email.toLowerCase() !== user.email) {
      const existing = await db.query(
        `
          SELECT id
          FROM users
          WHERE LOWER(email) = LOWER($1)
            AND id <> $2
        `,
        [
          email,
          user.id
        ]
      );

      if (existing.rows.length > 0) {
        return res.status(409).json({
          error: 'Email already in use'
        });
      }
    }

    const newName = name || user.name;
    const newEmail = email
      ? email.toLowerCase()
      : user.email;

    let newPassword = user.password;

    if (password) {
      newPassword = await bcrypt.hash(password, 10);
    }

    const result = await db.query(
      `
        UPDATE users
        SET
          name = $1,
          email = $2,
          password = $3
        WHERE id = $4
        RETURNING
          id,
          name,
          email,
          role,
          warehouse_id,
          created_at
      `,
      [
        newName,
        newEmail,
        newPassword,
        user.id
      ]
    );

    const updatedUser = result.rows[0];

    const warehouseResult = await db.query(
      `
        SELECT name
        FROM warehouses
        WHERE id = $1
      `,
      [updatedUser.warehouse_id]
    );

    res.json({
      ...updatedUser,
      warehouse_name:
        warehouseResult.rows.length > 0
          ? warehouseResult.rows[0].name
          : null
    });
  } catch (err) {
    console.error('Update profile error:', err);

    res.status(500).json({
      error: 'Failed to update profile'
    });
  }
}

module.exports = {
  getDashboard,
  getProfile,
  updateProfile
};
