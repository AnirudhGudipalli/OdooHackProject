
const db = require('../db');

async function getAll(req, res) {
  try {
    let query = `
      SELECT
        m.id,
        m.product_id,
        m.warehouse_id,
        m.movement_type,
        m.quantity,
        m.reference_type,
        m.reference_id,
        m.performed_by,
        m.created_at,
        p.name AS product_name,
        p.sku,
        w.name AS warehouse_name,
        u.name AS performed_by_name
      FROM stock_movements m
      JOIN products p
        ON p.id = m.product_id
      JOIN warehouses w
        ON w.id = m.warehouse_id
      LEFT JOIN users u
        ON u.id = m.performed_by
    `;

    const params = [];

    if (req.user.role === 'STAFF') {
      query += ` WHERE m.warehouse_id = $1`;
      params.push(req.user.warehouse_id);
    }

    query += ` ORDER BY m.id DESC`;

    const result = await db.query(query, params);

    res.json(result.rows);
  } catch (err) {
    console.error('Get movements error:', err);

    res.status(500).json({
      error: 'Failed to fetch stock movements'
    });
  }
}

module.exports = {
  getAll
};
