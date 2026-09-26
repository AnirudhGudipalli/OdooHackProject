
const db = require('../db');

async function getAll(req, res) {
  try {
    const result = await db.query(
      `SELECT id, name, location, created_at
       FROM warehouses
       ORDER BY id`
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get warehouses error:', err);
    res.status(500).json({
      error: 'Failed to fetch warehouses'
    });
  }
}

async function create(req, res) {
  const { name, location } = req.body;

  if (!name || !location) {
    return res.status(400).json({
      error: 'name and location are required'
    });
  }

  try {
    const result = await db.query(
      `INSERT INTO warehouses (name, location)
       VALUES ($1, $2)
       RETURNING id, name, location, created_at`,
      [name, location]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create warehouse error:', err);

    res.status(500).json({
      error: 'Failed to create warehouse'
    });
  }
}

async function update(req, res) {
  const { id } = req.params;
  const warehouseId = parseInt(id);

  try {
    const existing = await db.query(
      `SELECT id, name, location, created_at
       FROM warehouses
       WHERE id = $1`,
      [warehouseId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'Warehouse not found'
      });
    }

    const current = existing.rows[0];

    const name =
      req.body.name !== undefined
        ? req.body.name
        : current.name;

    const location =
      req.body.location !== undefined
        ? req.body.location
        : current.location;

    const result = await db.query(
      `UPDATE warehouses
       SET name = $1,
           location = $2
       WHERE id = $3
       RETURNING id, name, location, created_at`,
      [name, location, warehouseId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update warehouse error:', err);

    res.status(500).json({
      error: 'Failed to update warehouse'
    });
  }
}

module.exports = {
  getAll,
  create,
  update
};
