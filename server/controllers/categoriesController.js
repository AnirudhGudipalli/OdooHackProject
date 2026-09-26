
const db = require('../db');

async function getAll(req, res) {
  try {
    const result = await db.query(
      `SELECT id, name, description
       FROM categories
       ORDER BY id`
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
}

async function create(req, res) {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    const existing = await db.query(
      `SELECT id
       FROM categories
       WHERE LOWER(name) = LOWER($1)`,
      [name]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: 'Category name already exists'
      });
    }

    const result = await db.query(
      `INSERT INTO categories (name, description)
       VALUES ($1, $2)
       RETURNING id, name, description`,
      [name, description || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create category error:', err);

    if (err.code === '23505') {
      return res.status(409).json({
        error: 'Category name already exists'
      });
    }

    res.status(500).json({
      error: 'Failed to create category'
    });
  }
}

module.exports = {
  getAll,
  create
};

