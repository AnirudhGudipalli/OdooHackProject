
const db = require('../db');

async function getAll(req, res) {
  try {
    let query = `
      SELECT
        s.id,
        s.product_id,
        s.warehouse_id,
        s.quantity,
        s.updated_at,
        p.name AS product_name,
        p.sku,
        p.unit,
        p.reorder_level,
        c.name AS category_name,
        w.name AS warehouse_name
      FROM stock s
      JOIN products p
        ON p.id = s.product_id
      JOIN warehouses w
        ON w.id = s.warehouse_id
      LEFT JOIN categories c
        ON c.id = p.category_id
    `;

    const params = [];

    if (req.user.role === 'STAFF') {
      query += ` WHERE s.warehouse_id = $1`;
      params.push(req.user.warehouse_id);
    }

    query += ` ORDER BY s.id`;

    const result = await db.query(query, params);

    res.json(result.rows);
  } catch (err) {
    console.error('Get stock error:', err);

    res.status(500).json({
      error: 'Failed to fetch stock'
    });
  }
}

async function getByProduct(req, res) {
  const productId = parseInt(req.params.productId);

  try {
    const result = await db.query(
      `SELECT
         s.id,
         s.product_id,
         s.warehouse_id,
         s.quantity,
         s.updated_at,
         w.name AS warehouse_name
       FROM stock s
       JOIN warehouses w
         ON w.id = s.warehouse_id
       WHERE s.product_id = $1
       ORDER BY s.id`,
      [productId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get product stock error:', err);

    res.status(500).json({
      error: 'Failed to fetch product stock'
    });
  }
}

module.exports = {
  getAll,
  getByProduct
};
