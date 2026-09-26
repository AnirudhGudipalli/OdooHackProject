const db = require('../store');

function genAdjNumber() {
  const n = String(db.adjustments.length + 1).padStart(6, '0');
  return `ADJ-${n}`;
}

function enrichAdj(a) {
  return {
    ...a,
    product_name: db.productName(a.product_id),
    sku: db.products.find(p => p.id === a.product_id)?.sku || '',
    warehouse_name: db.warehouseName(a.warehouse_id),
    created_by_name: db.userName(a.created_by),
  };
}

function getAll(req, res) {
  let rows = db.adjustments;
  if (req.user.role === 'STAFF') rows = rows.filter(a => a.warehouse_id === req.user.warehouse_id);
  res.json(rows.map(enrichAdj).reverse());
}

function create(req, res) {
  const { warehouse_id, product_id, actual_quantity, reason } = req.body;
  if (product_id == null || actual_quantity == null)
    return res.status(400).json({ error: 'product_id and actual_quantity are required' });

  const wh = req.user.role === 'STAFF' ? req.user.warehouse_id : parseInt(warehouse_id);
  if (!wh) return res.status(400).json({ error: 'warehouse_id is required' });

  const pid = parseInt(product_id);
  const actualQty = parseInt(actual_quantity);
  const stockRow = db.stock.find(s => s.product_id === pid && s.warehouse_id === wh);
  const system_quantity = stockRow ? stockRow.quantity : 0;
  const difference = actualQty - system_quantity;

  const adj = {
    id: db.nextId('adjustments'),
    adjustment_number: genAdjNumber(),
    warehouse_id: wh,
    product_id: pid,
    system_quantity,
    actual_quantity: actualQty,
    difference,
    reason: reason || null,
    status: 'DRAFT',
    created_by: req.user.id,
    created_at: new Date(),
    validated_at: null,
  };
  db.adjustments.push(adj);
  res.status(201).json(enrichAdj(adj));
}

function validate(req, res) {
  const adj = db.adjustments.find(a => a.id === parseInt(req.params.id));
  if (!adj) return res.status(404).json({ error: 'Adjustment not found' });
  if (req.user.role === 'STAFF' && adj.warehouse_id !== req.user.warehouse_id)
    return res.status(403).json({ error: 'Access denied' });
  if (adj.status !== 'DRAFT')
    return res.status(400).json({ error: 'Adjustment must be in DRAFT status to validate' });

  // Update stock to actual quantity
  const s = db.stock.find(s => s.product_id === adj.product_id && s.warehouse_id === adj.warehouse_id);
  if (s) {
    s.quantity = adj.actual_quantity;
    s.updated_at = new Date();
  } else {
    db.stock.push({ id: db.nextId('stock'), product_id: adj.product_id, warehouse_id: adj.warehouse_id, quantity: adj.actual_quantity, updated_at: new Date() });
  }

  db.movements.push({
    id: db.nextId('movements'),
    product_id: adj.product_id,
    warehouse_id: adj.warehouse_id,
    movement_type: 'ADJUSTMENT',
    quantity: adj.difference,
    reference_type: 'ADJUSTMENT',
    reference_id: adj.id,
    performed_by: req.user.id,
    created_at: new Date(),
  });

  adj.status = 'VALIDATED';
  adj.validated_at = new Date();
  res.json({ message: 'Adjustment validated successfully' });
}

function cancel(req, res) {
  const adj = db.adjustments.find(a => a.id === parseInt(req.params.id));
  if (!adj) return res.status(404).json({ error: 'Adjustment not found' });
  if (req.user.role === 'STAFF' && adj.warehouse_id !== req.user.warehouse_id)
    return res.status(403).json({ error: 'Access denied' });
  if (adj.status !== 'DRAFT')
    return res.status(400).json({ error: 'Only DRAFT adjustments can be canceled' });
  adj.status = 'CANCELED';
  res.json({ message: 'Adjustment canceled' });
}

module.exports = { getAll, create, validate, cancel };
