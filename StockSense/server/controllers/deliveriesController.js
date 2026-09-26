const db = require('../store');

function genDeliveryNumber() {
  const n = String(db.deliveries.length + 1).padStart(6, '0');
  return `DLV-${n}`;
}

function enrichDelivery(d) {
  const items = db.delivery_items.filter(i => i.delivery_id === d.id).map(i => ({
    ...i,
    product_name: db.productName(i.product_id),
    sku: db.products.find(p => p.id === i.product_id)?.sku || '',
    unit: db.products.find(p => p.id === i.product_id)?.unit || '',
  }));
  return {
    ...d,
    warehouse_name: db.warehouseName(d.warehouse_id),
    created_by_name: db.userName(d.created_by),
    item_count: items.length,
    items,
  };
}

function getAll(req, res) {
  let rows = db.deliveries;
  if (req.user.role === 'STAFF') rows = rows.filter(d => d.warehouse_id === req.user.warehouse_id);
  res.json(rows.map(enrichDelivery).reverse());
}

function getOne(req, res) {
  const d = db.deliveries.find(d => d.id === parseInt(req.params.id));
  if (!d) return res.status(404).json({ error: 'Delivery not found' });
  if (req.user.role === 'STAFF' && d.warehouse_id !== req.user.warehouse_id)
    return res.status(403).json({ error: 'Access denied' });
  res.json(enrichDelivery(d));
}

function create(req, res) {
  const { customer, warehouse_id, items } = req.body;
  if (!customer || !items || items.length === 0)
    return res.status(400).json({ error: 'customer and items are required' });

  const wh = req.user.role === 'STAFF' ? req.user.warehouse_id : parseInt(warehouse_id);
  if (!wh) return res.status(400).json({ error: 'warehouse_id is required' });

  const delivery = {
    id: db.nextId('deliveries'),
    delivery_number: genDeliveryNumber(),
    customer,
    warehouse_id: wh,
    status: 'DRAFT',
    created_by: req.user.id,
    created_at: new Date(),
    validated_at: null,
  };
  db.deliveries.push(delivery);

  for (const item of items) {
    db.delivery_items.push({
      id: db.nextId('delivery_items'),
      delivery_id: delivery.id,
      product_id: parseInt(item.product_id),
      quantity: parseInt(item.quantity),
    });
  }

  res.status(201).json(enrichDelivery(delivery));
}

const VALID_TRANSITIONS = { DRAFT: ['WAITING', 'CANCELED'], WAITING: ['READY', 'CANCELED'], READY: ['DONE', 'CANCELED'] };

function update(req, res) {
  const d = db.deliveries.find(d => d.id === parseInt(req.params.id));
  if (!d) return res.status(404).json({ error: 'Delivery not found' });
  if (req.user.role === 'STAFF' && d.warehouse_id !== req.user.warehouse_id)
    return res.status(403).json({ error: 'Access denied' });

  const { status, customer } = req.body;
  if (status && status !== d.status) {
    const allowed = VALID_TRANSITIONS[d.status] || [];
    if (!allowed.includes(status))
      return res.status(400).json({ error: `Cannot transition from ${d.status} to ${status}` });
    d.status = status;
  }
  if (customer) d.customer = customer;
  res.json(enrichDelivery(d));
}

function validate(req, res) {
  const d = db.deliveries.find(d => d.id === parseInt(req.params.id));
  if (!d) return res.status(404).json({ error: 'Delivery not found' });
  if (req.user.role === 'STAFF' && d.warehouse_id !== req.user.warehouse_id)
    return res.status(403).json({ error: 'Access denied' });
  if (d.status !== 'READY')
    return res.status(400).json({ error: 'Delivery must be in READY status to validate' });

  const items = db.delivery_items.filter(i => i.delivery_id === d.id);

  // Check stock availability first
  for (const item of items) {
    const s = db.stock.find(s => s.product_id === item.product_id && s.warehouse_id === d.warehouse_id);
    const available = s ? s.quantity : 0;
    if (available < item.quantity) {
      const pName = db.productName(item.product_id);
      return res.status(400).json({
        error: `Insufficient stock for "${pName}": available ${available}, required ${item.quantity}`
      });
    }
  }

  // Deduct stock and record movements
  for (const item of items) {
    const s = db.stock.find(s => s.product_id === item.product_id && s.warehouse_id === d.warehouse_id);
    s.quantity -= item.quantity;
    s.updated_at = new Date();

    db.movements.push({
      id: db.nextId('movements'),
      product_id: item.product_id,
      warehouse_id: d.warehouse_id,
      movement_type: 'DELIVERY',
      quantity: -item.quantity,
      reference_type: 'DELIVERY',
      reference_id: d.id,
      performed_by: req.user.id,
      created_at: new Date(),
    });
  }

  d.status = 'DONE';
  d.validated_at = new Date();
  res.json({ message: 'Delivery validated successfully' });
}

module.exports = { getAll, getOne, create, update, validate };
