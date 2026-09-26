
const db = require('../db');

const VALID_TRANSITIONS = {
  DRAFT: ['WAITING', 'CANCELED'],
  WAITING: ['READY', 'CANCELED'],
  READY: ['DONE', 'CANCELED']
};

async function getDeliveryItems(deliveryId) {
  const result = await db.query(
    `SELECT
       di.id,
       di.delivery_id,
       di.product_id,
       di.quantity,
       p.name AS product_name,
       p.sku,
       p.unit
     FROM delivery_items di
     JOIN products p ON p.id = di.product_id
     WHERE di.delivery_id = $1
     ORDER BY di.id`,
    [deliveryId]
  );

  return result.rows;
}

function enrichDelivery(delivery, items) {
  return {
    ...delivery,
    item_count: items.length,
    items
  };
}

async function getAll(req, res) {
  try {
    let query = `
      SELECT
        d.id,
        d.delivery_number,
        d.customer,
        d.warehouse_id,
        d.status,
        d.created_by,
        d.created_at,
        d.validated_at,
        w.name AS warehouse_name,
        u.name AS created_by_name
      FROM deliveries d
      JOIN warehouses w ON w.id = d.warehouse_id
      JOIN users u ON u.id = d.created_by
    `;

    const params = [];

    if (req.user.role === 'STAFF') {
      query += ` WHERE d.warehouse_id = $1`;
      params.push(req.user.warehouse_id);
    }

    query += ` ORDER BY d.id DESC`;

    const result = await db.query(query, params);

    const deliveries = [];

    for (const delivery of result.rows) {
      const items = await getDeliveryItems(delivery.id);

      deliveries.push(
        enrichDelivery(delivery, items)
      );
    }

    res.json(deliveries);
  } catch (err) {
    console.error('Get deliveries error:', err);

    res.status(500).json({
      error: 'Failed to fetch deliveries'
    });
  }
}

async function getOne(req, res) {
  const deliveryId = parseInt(req.params.id);

  try {
    const result = await db.query(
      `SELECT
         d.id,
         d.delivery_number,
         d.customer,
         d.warehouse_id,
         d.status,
         d.created_by,
         d.created_at,
         d.validated_at,
         w.name AS warehouse_name,
         u.name AS created_by_name
       FROM deliveries d
       JOIN warehouses w ON w.id = d.warehouse_id
       JOIN users u ON u.id = d.created_by
       WHERE d.id = $1`,
      [deliveryId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Delivery not found'
      });
    }

    const delivery = result.rows[0];

    if (
      req.user.role === 'STAFF' &&
      delivery.warehouse_id !== req.user.warehouse_id
    ) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    const items = await getDeliveryItems(delivery.id);

    res.json(
      enrichDelivery(
        delivery,
        items
      )
    );
  } catch (err) {
    console.error('Get delivery error:', err);

    res.status(500).json({
      error: 'Failed to fetch delivery'
    });
  }
}

async function create(req, res) {
  const {
    customer,
    warehouse_id,
    items
  } = req.body;

  if (!customer || !items || items.length === 0) {
    return res.status(400).json({
      error: 'customer and items are required'
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

  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const warehouse = await client.query(
      `SELECT id
       FROM warehouses
       WHERE id = $1`,
      [warehouseId]
    );

    if (warehouse.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        error: 'Invalid warehouse'
      });
    }

    const deliveryResult = await client.query(
      `INSERT INTO deliveries
       (delivery_number, customer, warehouse_id, status, created_by)
       VALUES ('TEMP', $1, $2, 'DRAFT', $3)
       RETURNING
         id,
         customer,
         warehouse_id,
         status,
         created_by,
         created_at,
         validated_at`,
      [
        customer,
        warehouseId,
        req.user.id
      ]
    );

    const delivery = deliveryResult.rows[0];

    const deliveryNumber =
      `DLV-${String(delivery.id).padStart(6, '0')}`;

    await client.query(
      `UPDATE deliveries
       SET delivery_number = $1
       WHERE id = $2`,
      [
        deliveryNumber,
        delivery.id
      ]
    );

    delivery.delivery_number = deliveryNumber;

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
        `INSERT INTO delivery_items
         (delivery_id, product_id, quantity)
         VALUES ($1, $2, $3)`,
        [
          delivery.id,
          productId,
          quantity
        ]
      );
    }

    await client.query('COMMIT');

    const createdItems = await getDeliveryItems(delivery.id);

    const warehouseResult = await db.query(
      `SELECT name
       FROM warehouses
       WHERE id = $1`,
      [warehouseId]
    );

    const userResult = await db.query(
      `SELECT name
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );

    res.status(201).json(
      enrichDelivery(
        {
          ...delivery,
          warehouse_name: warehouseResult.rows[0]?.name || null,
          created_by_name: userResult.rows[0]?.name || null
        },
        createdItems
      )
    );
  } catch (err) {
    await client.query('ROLLBACK');

    console.error('Create delivery error:', err);

    res.status(500).json({
      error: 'Failed to create delivery'
    });
  } finally {
    client.release();
  }
}

async function update(req, res) {
  const deliveryId = parseInt(req.params.id);

  const {
    status,
    customer
  } = req.body;

  try {
    const result = await db.query(
      `SELECT *
       FROM deliveries
       WHERE id = $1`,
      [deliveryId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Delivery not found'
      });
    }

    const delivery = result.rows[0];

    if (
      req.user.role === 'STAFF' &&
      delivery.warehouse_id !== req.user.warehouse_id
    ) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    let newStatus = delivery.status;

    if (status && status !== delivery.status) {
      const allowed =
        VALID_TRANSITIONS[delivery.status] || [];

      if (!allowed.includes(status)) {
        return res.status(400).json({
          error: `Cannot transition from ${delivery.status} to ${status}`
        });
      }

      newStatus = status;
    }

    const updated = await db.query(
      `UPDATE deliveries
       SET status = $1,
           customer = $2
       WHERE id = $3
       RETURNING
         id,
         delivery_number,
         customer,
         warehouse_id,
         status,
         created_by,
         created_at,
         validated_at`,
      [
        newStatus,
        customer || delivery.customer,
        deliveryId
      ]
    );

    const updatedDelivery = updated.rows[0];

    const warehouse = await db.query(
      `SELECT name
       FROM warehouses
       WHERE id = $1`,
      [updatedDelivery.warehouse_id]
    );

    const user = await db.query(
      `SELECT name
       FROM users
       WHERE id = $1`,
      [updatedDelivery.created_by]
    );

    const items = await getDeliveryItems(deliveryId);

    res.json(
      enrichDelivery(
        {
          ...updatedDelivery,
          warehouse_name: warehouse.rows[0]?.name || null,
          created_by_name: user.rows[0]?.name || null
        },
        items
      )
    );
  } catch (err) {
    console.error('Update delivery error:', err);

    res.status(500).json({
      error: 'Failed to update delivery'
    });
  }
}

async function validate(req, res) {
  const deliveryId = parseInt(req.params.id);

  const client = await db.getClient();

  try {
    await client.query('BEGIN');

    const deliveryResult = await client.query(
      `SELECT *
       FROM deliveries
       WHERE id = $1
       FOR UPDATE`,
      [deliveryId]
    );

    if (deliveryResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        error: 'Delivery not found'
      });
    }

    const delivery = deliveryResult.rows[0];

    if (
      req.user.role === 'STAFF' &&
      delivery.warehouse_id !== req.user.warehouse_id
    ) {
      await client.query('ROLLBACK');

      return res.status(403).json({
        error: 'Access denied'
      });
    }

    if (delivery.status !== 'READY') {
      await client.query('ROLLBACK');

      return res.status(400).json({
        error: 'Delivery must be in READY status to validate'
      });
    }

    const itemsResult = await client.query(
      `SELECT
         di.product_id,
         di.quantity,
         p.name AS product_name
       FROM delivery_items di
       JOIN products p ON p.id = di.product_id
       WHERE di.delivery_id = $1`,
      [deliveryId]
    );

    // Check all stock before changing anything.
    for (const item of itemsResult.rows) {
      const stockResult = await client.query(
        `SELECT quantity
         FROM stock
         WHERE product_id = $1
           AND warehouse_id = $2
         FOR UPDATE`,
        [
          item.product_id,
          delivery.warehouse_id
        ]
      );

      const available =
        stockResult.rows.length > 0
          ? stockResult.rows[0].quantity
          : 0;

      if (available < item.quantity) {
        await client.query('ROLLBACK');

        return res.status(400).json({
          error:
            `Insufficient stock for "${item.product_name}": ` +
            `available ${available}, required ${item.quantity}`
        });
      }
    }

    // Deduct stock and create movements.
    for (const item of itemsResult.rows) {
      await client.query(
        `UPDATE stock
         SET quantity = quantity - $1,
             updated_at = NOW()
         WHERE product_id = $2
           AND warehouse_id = $3`,
        [
          item.quantity,
          item.product_id,
          delivery.warehouse_id
        ]
      );

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
         ($1, $2, 'DELIVERY', $3, 'DELIVERY', $4, $5)`,
        [
          item.product_id,
          delivery.warehouse_id,
          -item.quantity,
          delivery.id,
          req.user.id
        ]
      );
    }

    await client.query(
      `UPDATE deliveries
       SET status = 'DONE',
           validated_at = NOW()
       WHERE id = $1`,
      [deliveryId]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Delivery validated successfully'
    });
  } catch (err) {
    await client.query('ROLLBACK');

    console.error('Validate delivery error:', err);

    res.status(500).json({
      error: 'Failed to validate delivery'
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

