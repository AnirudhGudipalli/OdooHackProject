const db = require('../db');

async function enrichProduct(p) {
  const stockResult = await db.query(
    `SELECT COALESCE(SUM(quantity), 0) AS total_stock
     FROM stock
     WHERE product_id = $1`,
    [p.id]
  );

  const categoryResult = await db.query(
    `SELECT name
     FROM categories
     WHERE id = $1`,
    [p.category_id]
  );

  return {
    ...p,
    category_name: categoryResult.rows[0]?.name || null,
    total_stock: parseInt(stockResult.rows[0].total_stock),
  };
}

async function getAll(req, res) {
  try {
    const result = await db.query(
      `SELECT id, name, sku, category_id, unit, reorder_level, created_at, updated_at
       FROM products
       ORDER BY id`
    );

    const products = [];

    for (const product of result.rows) {
      products.push(await enrichProduct(product));
    }

    res.json(products);
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
}

async function getOne(req, res) {
  try {
    const result = await db.query(
      `SELECT id, name, sku, category_id, unit, reorder_level, created_at, updated_at
       FROM products
       WHERE id = $1`,
      [parseInt(req.params.id)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(await enrichProduct(result.rows[0]));
  } catch (err) {
    console.error('Get product error:', err);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
}

async function create(req, res) {
  const {
    name,
    sku,
    category_id,
    unit,
    reorder_level,
    initial_stock,
    warehouse_id
  } = req.body;

  if (!name || !sku) {
    return res.status(400).json({ error: 'name and sku are required' });
  }

  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT id
       FROM products
       WHERE UPPER(sku) = UPPER($1)`,
      [sku]
    );

    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'SKU already exists' });
    }

    const productResult = await client.query(
      `INSERT INTO products
       (name, sku, category_id, unit, reorder_level)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, sku, category_id, unit, reorder_level, created_at, updated_at`,
      [
        name,
        sku.toUpperCase(),
        category_id ? parseInt(category_id) : null,
        unit || 'units',
        parseInt(reorder_level) || 0
      ]
    );

    const product = productResult.rows[0];

    if (
      initial_stock &&
      parseInt(initial_stock) > 0 &&
      warehouse_id
    ) {
      const qty = parseInt(initial_stock);
      const whId = parseInt(warehouse_id);

      const stockResult = await client.query(
        `SELECT id
         FROM stock
         WHERE product_id = $1 AND warehouse_id = $2`,
        [product.id, whId]
      );

      if (stockResult.rows.length > 0) {
        await client.query(
          `UPDATE stock
           SET quantity = quantity + $1,
               updated_at = NOW()
           WHERE product_id = $2 AND warehouse_id = $3`,
          [qty, product.id, whId]
        );
      } else {
        await client.query(
          `INSERT INTO stock
           (product_id, warehouse_id, quantity)
           VALUES ($1, $2, $3)`,
          [product.id, whId, qty]
        );
      }

      await client.query(
        `INSERT INTO stock_movements
         (product_id, warehouse_id, movement_type, quantity,
          reference_type, reference_id, performed_by)
         VALUES ($1, $2, 'RECEIPT', $3, 'INITIAL_STOCK', NULL, $4)`,
        [
          product.id,
          whId,
          qty,
          req.user.id
        ]
      );
    }

    await client.query('COMMIT');

    res.status(201).json(await enrichProduct(product));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create product error:', err);

    if (err.code === '23505') {
      return res.status(409).json({ error: 'SKU already exists' });
    }

    res.status(500).json({ error: 'Failed to create product' });
  } finally {
    client.release();
  }
}

async function update(req, res) {
  const productId = parseInt(req.params.id);

  const {
    name,
    sku,
    category_id,
    unit,
    reorder_level
  } = req.body;

  try {
    const existingResult = await db.query(
      `SELECT *
       FROM products
       WHERE id = $1`,
      [productId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (sku) {
      const duplicateResult = await db.query(
        `SELECT id
         FROM products
         WHERE UPPER(sku) = UPPER($1)
         AND id <> $2`,
        [sku, productId]
      );

      if (duplicateResult.rows.length > 0) {
        return res.status(409).json({ error: 'SKU already exists' });
      }
    }

    const current = existingResult.rows[0];

    const result = await db.query(
      `UPDATE products
       SET name = $1,
           sku = $2,
           category_id = $3,
           unit = $4,
           reorder_level = $5,
           updated_at = NOW()
       WHERE id = $6
       RETURNING id, name, sku, category_id, unit, reorder_level, created_at, updated_at`,
      [
        name !== undefined ? name : current.name,
        sku !== undefined ? sku.toUpperCase() : current.sku,
        category_id !== undefined
          ? (category_id ? parseInt(category_id) : null)
          : current.category_id,
        unit !== undefined ? unit : current.unit,
        reorder_level !== undefined
          ? (parseInt(reorder_level) || 0)
          : current.reorder_level,
        productId
      ]
    );

    res.json(await enrichProduct(result.rows[0]));
  } catch (err) {
    console.error('Update product error:', err);

    if (err.code === '23505') {
      return res.status(409).json({ error: 'SKU already exists' });
    }

    res.status(500).json({ error: 'Failed to update product' });
  }
}

async function remove(req, res) {
  const productId = parseInt(req.params.id);

  try {
    const result = await db.query(
      `DELETE FROM products
       WHERE id = $1
       RETURNING id`,
      [productId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product deleted' });
  } catch (err) {
    console.error('Delete product error:', err);

    if (err.code === '23503') {
      return res.status(409).json({
        error: 'Product cannot be deleted because it is being used by another record'
      });
    }

    res.status(500).json({ error: 'Failed to delete product' });
  }
}

module.exports = {
  getAll,
  getOne,
  create,
  update,
  remove
};