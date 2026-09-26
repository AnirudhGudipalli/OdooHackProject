
const db = require('../db');

async function getAll(req, res) {
  try {
    let query = `
      SELECT
        a.id,
        a.adjustment_number,
        a.warehouse_id,
        a.product_id,
        a.system_quantity,
        a.actual_quantity,
        a.difference,
        a.reason,
        a.status,
        a.created_by,
        a.created_at,
        a.validated_at,
        p.name AS product_name,
        p.sku,
        w.name AS warehouse_name,
        u.name AS created_by_name
      FROM inventory_adjustments a
      JOIN products p ON p.id = a.product_id
      JOIN warehouses w ON w.id = a.warehouse_id
      JOIN users u ON u.id = a.created_by
    `;

    const params = [];

    if (req.user.role === 'STAFF') {
      query += ` WHERE a.warehouse_id = $1`;
      params.push(req.user.warehouse_id);
    }

    query += ` ORDER BY a.id DESC`;

    const result = await db.query(query, params);

    res.json(result.rows);
  } catch (err) {
    console.error('Get adjustments error:', err);

    res.status(500).json({
      error: 'Failed to fetch adjustments'
    });
  }
}

async function create(req, res) {
  const {
    warehouse_id,
    product_id,
    actual_quantity,
    reason
  } = req.body;

  if (product_id == null || actual_quantity == null) {
    return res.status(400).json({
      error: 'product_id and actual_quantity are required'
    });
  }

  const warehouseId =
    req.user.role === 'STAFF'
      ? req.user.warehouse_id
      : parseInt(warehouse_id);

  if (!warehouseId) {
    return res.status(400).json({
      error: 'warehouse_id is required'
    });
  }

  const productId = parseInt(product_id);
  const actualQuantity = parseInt(actual_quantity);

  if (isNaN(productId) || isNaN(actualQuantity) || actualQuantity < 0) {
    return res.status(400).json({
      error: 'Invalid product_id or actual_quantity'
    });
  }

  try {
    const product = await db.query(
      `SELECT id
       FROM products
       WHERE id = $1`,
      [productId]
    );

    if (product.rows.length === 0) {
      return res.status(400).json({
        error: 'Product not found'
      });
    }

    const warehouse = await db.query(
      `SELECT id
       FROM warehouses
       WHERE id = $1`,
      [warehouseId]
    );

    if (warehouse.rows.length === 0) {
      return res.status(400).json({
        error: 'Warehouse not found'
      });
    }

    const stockResult = await db.query(
      `SELECT quantity
       FROM stock
       WHERE product_id = $1
         AND warehouse_id = $2`,
      [
        productId,
        warehouseId
      ]
    );

    const systemQuantity =
      stockResult.rows.length > 0
        ? stockResult.rows[0].quantity
        : 0;

    const difference =
      actualQuantity - systemQuantity;

    const result = await db.query(
      `INSERT INTO inventory_adjustments
       (
         adjustment_number,
         warehouse_id,
         product_id,
         system_quantity,
         actual_quantity,
         difference,
         reason,
         status,
         created_by
       )
       VALUES
       (
         'TEMP',
         $1,
         $2,
         $3,
         $4,
         $5,
         $6,
         'DRAFT',
         $7
       )
       RETURNING
         id,
         warehouse_id,
         product_id,
         system_quantity,
         actual_quantity,
         difference,
         reason,
         status,
         created_by,
         created_at,
         validated_at`,
      [
        warehouseId,
        productId,
        systemQuantity,
        actualQuantity,
        difference,
        reason || null,
        req.user.id
      ]
    );

    const adjustment = result.rows[0];

    const adjustmentNumber =
      `ADJ-${String(adjustment.id).padStart(6, '0')}`;

    await db.query(
      `UPDATE inventory_adjustments
       SET adjustment_number = $1
       WHERE id = $2`,
      [
        adjustmentNumber,
        adjustment.id
      ]
    );

    const enriched = await db.query(
      `SELECT
         a.*,
         p.name AS product_name,
         p.sku,
         w.name AS warehouse_name,
         u.name AS created_by_name
       FROM inventory_adjustments a
       JOIN products p ON p.id = a.product_id
       JOIN warehouses w ON w.id = a.warehouse_id
       JOIN users u ON u.id = a.created_by
       WHERE a.id = $1`,
      [adjustment.id]
    );

    res.status(201).json(enriched.rows[0]);
  } catch (err) {
    console.error('Create adjustment error:', err);

    res.status(500).json({
      error: 'Failed to create adjustment'
    });
  }
}

async function validate(req, res) {
  const adjustmentId = parseInt(req.params.id);

  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `SELECT *
       FROM inventory_adjustments
       WHERE id = $1
       FOR UPDATE`,
      [adjustmentId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        error: 'Adjustment not found'
      });
    }

    const adjustment = result.rows[0];

    if (
      req.user.role === 'STAFF' &&
      adjustment.warehouse_id !== req.user.warehouse_id
    ) {
      await client.query('ROLLBACK');

      return res.status(403).json({
        error: 'Access denied'
      });
    }

    if (adjustment.status !== 'DRAFT') {
      await client.query('ROLLBACK');

      return res.status(400).json({
        error: 'Adjustment must be in DRAFT status to validate'
      });
    }

    const stockResult = await client.query(
      `SELECT id
       FROM stock
       WHERE product_id = $1
         AND warehouse_id = $2
       FOR UPDATE`,
      [
        adjustment.product_id,
        adjustment.warehouse_id
      ]
    );

    if (stockResult.rows.length > 0) {
      await client.query(
        `UPDATE stock
         SET quantity = $1,
             updated_at = NOW()
         WHERE product_id = $2
           AND warehouse_id = $3`,
        [
          adjustment.actual_quantity,
          adjustment.product_id,
          adjustment.warehouse_id
        ]
      );
    } else {
      await client.query(
        `INSERT INTO stock
         (product_id, warehouse_id, quantity)
         VALUES ($1, $2, $3)`,
        [
          adjustment.product_id,
          adjustment.warehouse_id,
          adjustment.actual_quantity
        ]
      );
    }

    await client.query(
      `INSERT INTO stock_movements
       (
         product_id,
         warehouse_id,
         movement_type,
         quantity,
         reference_type,
         reference_id,
         performed_by
       )
       VALUES
       (
         $1,
         $2,
         'ADJUSTMENT',
         $3,
         'ADJUSTMENT',
         $4,
         $5
       )`,
      [
        adjustment.product_id,
        adjustment.warehouse_id,
        adjustment.difference,
        adjustment.id,
        req.user.id
      ]
    );

    await client.query(
      `UPDATE inventory_adjustments
       SET status = 'VALIDATED',
           validated_at = NOW()
       WHERE id = $1`,
      [adjustmentId]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Adjustment validated successfully'
    });
  } catch (err) {
    await client.query('ROLLBACK');

    console.error('Validate adjustment error:', err);

    res.status(500).json({
      error: 'Failed to validate adjustment'
    });
  } finally {
    client.release();
  }
}

async function cancel(req, res) {
  const adjustmentId = parseInt(req.params.id);

  try {
    const result = await db.query(
      `SELECT *
       FROM inventory_adjustments
       WHERE id = $1`,
      [adjustmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Adjustment not found'
      });
    }

    const adjustment = result.rows[0];

    if (
      req.user.role === 'STAFF' &&
      adjustment.warehouse_id !== req.user.warehouse_id
    ) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    if (adjustment.status !== 'DRAFT') {
      return res.status(400).json({
        error: 'Only DRAFT adjustments can be canceled'
      });
    }

    await db.query(
      `UPDATE inventory_adjustments
       SET status = 'CANCELED'
       WHERE id = $1`,
      [adjustmentId]
    );

    res.json({
      message: 'Adjustment canceled'
    });
  } catch (err) {
    console.error('Cancel adjustment error:', err);

    res.status(500).json({
      error: 'Failed to cancel adjustment'
    });
  }
}

module.exports = {
  getAll,
  create,
  validate,
  cancel
};
