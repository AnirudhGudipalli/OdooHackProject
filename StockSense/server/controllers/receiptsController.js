
const db = require('../db');

function enrichReceipt(r, items) {
  return {
    ...r,
    item_count: items.length,
    items
  };
}

async function getReceiptItems(receiptId) {
  const result = await db.query(
    `SELECT
       ri.id,
       ri.receipt_id,
       ri.product_id,
       ri.quantity,
       p.name AS product_name,
       p.sku,
       p.unit
     FROM receipt_items ri
     JOIN products p ON p.id = ri.product_id
     WHERE ri.receipt_id = $1
     ORDER BY ri.id`,
    [receiptId]
  );

  return result.rows;
}

async function getAll(req, res) {
  try {
    let query = `
      SELECT
        r.id,
        r.receipt_number,
        r.supplier,
        r.warehouse_id,
        r.status,
        r.created_by,
        r.created_at,
        r.validated_at,
        w.name AS warehouse_name,
        u.name AS created_by_name
      FROM receipts r
      JOIN warehouses w ON w.id = r.warehouse_id
      JOIN users u ON u.id = r.created_by
    `;

    const params = [];

    if (req.user.role === 'STAFF') {
      query += ` WHERE r.warehouse_id = $1`;
      params.push(req.user.warehouse_id);
    }

    query += ` ORDER BY r.id DESC`;

    const result = await db.query(query, params);

    const receipts = [];

    for (const receipt of result.rows) {
      const items = await getReceiptItems(receipt.id);

      receipts.push(
        enrichReceipt(
          receipt,
          items
        )
      );
    }

    res.json(receipts);
  } catch (err) {
    console.error('Get receipts error:', err);

    res.status(500).json({
      error: 'Failed to fetch receipts'
    });
  }
}

async function getOne(req, res) {
  const receiptId = parseInt(req.params.id);

  try {
    const result = await db.query(
      `SELECT
         r.id,
         r.receipt_number,
         r.supplier,
         r.warehouse_id,
         r.status,
         r.created_by,
         r.created_at,
         r.validated_at,
         w.name AS warehouse_name,
         u.name AS created_by_name
       FROM receipts r
       JOIN warehouses w ON w.id = r.warehouse_id
       JOIN users u ON u.id = r.created_by
       WHERE r.id = $1`,
      [receiptId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Receipt not found'
      });
    }

    const receipt = result.rows[0];

    if (
      req.user.role === 'STAFF' &&
      receipt.warehouse_id !== req.user.warehouse_id
    ) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    const items = await getReceiptItems(receipt.id);

    res.json(
      enrichReceipt(
        receipt,
        items
      )
    );
  } catch (err) {
    console.error('Get receipt error:', err);

    res.status(500).json({
      error: 'Failed to fetch receipt'
    });
  }
}

async function create(req, res) {
  const {
    supplier,
    warehouse_id,
    items
  } = req.body;

  if (!supplier || !items || items.length === 0) {
    return res.status(400).json({
      error: 'supplier and items are required'
    });
  }

  const wh =
    req.user.role === 'STAFF'
      ? req.user.warehouse_id
      : parseInt(warehouse_id);

  if (!wh) {
    return res.status(400).json({
      error: 'warehouse_id is required'
    });
  }

  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const warehouse = await client.query(
      `SELECT id
       FROM warehouses
       WHERE id = $1`,
      [wh]
    );

    if (warehouse.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        error: 'Invalid warehouse'
      });
    }

    const receiptResult = await client.query(
      `INSERT INTO receipts
       (receipt_number, supplier, warehouse_id, status, created_by)
       VALUES (
         'TEMP',
         $1,
         $2,
         'DRAFT',
         $3
       )
       RETURNING id, supplier, warehouse_id, status, created_by, created_at, validated_at`,
      [
        supplier,
        wh,
        req.user.id
      ]
    );

    const receipt = receiptResult.rows[0];

    const receiptNumber =
      `RCT-${String(receipt.id).padStart(6, '0')}`;

    await client.query(
      `UPDATE receipts
       SET receipt_number = $1
       WHERE id = $2`,
      [
        receiptNumber,
        receipt.id
      ]
    );

    receipt.receipt_number = receiptNumber;

    for (const item of items) {
      const productId = parseInt(item.product_id);
      const quantity = parseInt(item.quantity);

      if (!productId || !quantity || quantity <= 0) {
        await client.query('ROLLBACK');

        return res.status(400).json({
          error: 'Each item must have a valid product_id and positive quantity'
        });
      }

      const product = await client.query(
        `SELECT id
         FROM products
         WHERE id = $1`,
        [productId]
      );

      if (product.rows.length === 0) {
        await client.query('ROLLBACK');

        return res.status(400).json({
          error: `Product ${productId} not found`
        });
      }

      await client.query(
        `INSERT INTO receipt_items
         (receipt_id, product_id, quantity)
         VALUES ($1, $2, $3)`,
        [
          receipt.id,
          productId,
          quantity
        ]
      );
    }

    await client.query('COMMIT');

    const createdItems = await getReceiptItems(receipt.id);

    const finalReceipt = {
      ...receipt,
      warehouse_name: (
        await db.query(
          `SELECT name FROM warehouses WHERE id = $1`,
          [wh]
        )
      ).rows[0]?.name || null,
      created_by_name: (
        await db.query(
          `SELECT name FROM users WHERE id = $1`,
          [req.user.id]
        )
      ).rows[0]?.name || null
    };

    res.status(201).json(
      enrichReceipt(
        finalReceipt,
        createdItems
      )
    );
  } catch (err) {
    await client.query('ROLLBACK');

    console.error('Create receipt error:', err);

    if (err.code === '23505') {
      return res.status(409).json({
        error: 'Receipt number already exists'
      });
    }

    res.status(500).json({
      error: 'Failed to create receipt'
    });
  } finally {
    client.release();
  }
}

const VALID_TRANSITIONS = {
  DRAFT: ['WAITING', 'CANCELED'],
  WAITING: ['READY', 'CANCELED'],
  READY: ['DONE', 'CANCELED']
};

async function update(req, res) {
  const receiptId = parseInt(req.params.id);

  const {
    status,
    supplier
  } = req.body;

  try {
    const result = await db.query(
      `SELECT *
       FROM receipts
       WHERE id = $1`,
      [receiptId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Receipt not found'
      });
    }

    const receipt = result.rows[0];

    if (
      req.user.role === 'STAFF' &&
      receipt.warehouse_id !== req.user.warehouse_id
    ) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    let newStatus = receipt.status;

    if (status && status !== receipt.status) {
      const allowed =
        VALID_TRANSITIONS[receipt.status] || [];

      if (!allowed.includes(status)) {
        return res.status(400).json({
          error: `Cannot transition from ${receipt.status} to ${status}`
        });
      }

      newStatus = status;
    }

    const updated = await db.query(
      `UPDATE receipts
       SET status = $1,
           supplier = $2
       WHERE id = $3
       RETURNING
         id,
         receipt_number,
         supplier,
         warehouse_id,
         status,
         created_by,
         created_at,
         validated_at`,
      [
        newStatus,
        supplier || receipt.supplier,
        receiptId
      ]
    );

    const updatedReceipt = updated.rows[0];

    const warehouse = await db.query(
      `SELECT name
       FROM warehouses
       WHERE id = $1`,
      [updatedReceipt.warehouse_id]
    );

    const user = await db.query(
      `SELECT name
       FROM users
       WHERE id = $1`,
      [updatedReceipt.created_by]
    );

    const items = await getReceiptItems(receiptId);

    res.json(
      enrichReceipt(
        {
          ...updatedReceipt,
          warehouse_name: warehouse.rows[0]?.name || null,
          created_by_name: user.rows[0]?.name || null
        },
        items
      )
    );
  } catch (err) {
    console.error('Update receipt error:', err);

    res.status(500).json({
      error: 'Failed to update receipt'
    });
  }
}

async function validate(req, res) {
  const receiptId = parseInt(req.params.id);

  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const receiptResult = await client.query(
      `SELECT *
       FROM receipts
       WHERE id = $1
       FOR UPDATE`,
      [receiptId]
    );

    if (receiptResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        error: 'Receipt not found'
      });
    }

    const receipt = receiptResult.rows[0];

    if (
      req.user.role === 'STAFF' &&
      receipt.warehouse_id !== req.user.warehouse_id
    ) {
      await client.query('ROLLBACK');

      return res.status(403).json({
        error: 'Access denied'
      });
    }

    if (receipt.status !== 'READY') {
      await client.query('ROLLBACK');

      return res.status(400).json({
        error: 'Receipt must be in READY status to validate'
      });
    }

    const itemsResult = await client.query(
      `SELECT product_id, quantity
       FROM receipt_items
       WHERE receipt_id = $1`,
      [receiptId]
    );

    for (const item of itemsResult.rows) {
      const stockResult = await client.query(
        `SELECT id
         FROM stock
         WHERE product_id = $1
           AND warehouse_id = $2
         FOR UPDATE`,
        [
          item.product_id,
          receipt.warehouse_id
        ]
      );

      if (stockResult.rows.length > 0) {
        await client.query(
          `UPDATE stock
           SET quantity = quantity + $1,
               updated_at = NOW()
           WHERE product_id = $2
             AND warehouse_id = $3`,
          [
            item.quantity,
            item.product_id,
            receipt.warehouse_id
          ]
        );
      } else {
        await client.query(
          `INSERT INTO stock
           (product_id, warehouse_id, quantity)
           VALUES ($1, $2, $3)`,
          [
            item.product_id,
            receipt.warehouse_id,
            item.quantity
          ]
        );
      }

      await client.query(
        `INSERT INTO stock_movements
         (product_id,
          warehouse_id,
          movement_type,
          quantity,
          reference_type,
          reference_id,
          performed_by)
         VALUES
         ($1, $2, 'RECEIPT', $3, 'RECEIPT', $4, $5)`,
        [
          item.product_id,
          receipt.warehouse_id,
          item.quantity,
          receipt.id,
          req.user.id
        ]
      );
    }

    await client.query(
      `UPDATE receipts
       SET status = 'DONE',
           validated_at = NOW()
       WHERE id = $1`,
      [receiptId]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Receipt validated successfully'
    });
  } catch (err) {
    await client.query('ROLLBACK');

    console.error('Validate receipt error:', err);

    res.status(500).json({
      error: 'Failed to validate receipt'
    });
  } finally {
    client.release();
  }
}

module.exports = {
  getAll,
  getOne,
  create,
  update,
  validate
};
