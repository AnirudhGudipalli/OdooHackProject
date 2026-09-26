const db = require('../store');

function genReceiptNumber() {
  const n = String(db.receipts.length + 1).padStart(6, '0');
  return `RCT-${n}`;
}

function enrichReceipt(r) {
  const items = db.receipt_items.filter(i => i.receipt_id === r.id).map(i => ({
    ...i,
    product_name: db.productName(i.product_id),
    sku: db.products.find(p => p.id === i.product_id)?.sku || '',
    unit: db.products.find(p => p.id === i.product_id)?.unit || '',
  }));
  return {
    ...r,
    warehouse_name: db.warehouseName(r.warehouse_id),
    created_by_name: db.userName(r.created_by),
    item_count: items.length,
    items,
  };
}

function getAll(req, res) {
  let rows = db.receipts;
  if (req.user.role === 'STAFF') rows = rows.filter(r => r.warehouse_id === req.user.warehouse_id);
  res.json(rows.map(enrichReceipt).reverse());
}

function getOne(req, res) {
  const r = db.receipts.find(r => r.id === parseInt(req.params.id));
  if (!r) return res.status(404).json({ error: 'Receipt not found' });
  if (req.user.role === 'STAFF' && r.warehouse_id !== req.user.warehouse_id)
    return res.status(403).json({ error: 'Access denied' });
  res.json(enrichReceipt(r));
}

function create(req, res) {
  const { supplier, warehouse_id, items } = req.body;
  if (!supplier || !items || items.length === 0)
    return res.status(400).json({ error: 'supplier and items are required' });

  const wh = req.user.role === 'STAFF' ? req.user.warehouse_id : parseInt(warehouse_id);
  if (!wh) return res.status(400).json({ error: 'warehouse_id is required' });

  const receipt = {
    id: db.nextId('receipts'),
    receipt_number: genReceiptNumber(),
    supplier,
    warehouse_id: wh,
    status: 'DRAFT',
    created_by: req.user.id,
    created_at: new Date(),
    validated_at: null,
  };
  db.receipts.push(receipt);

  for (const item of items) {
    db.receipt_items.push({
      id: db.nextId('receipt_items'),
      receipt_id: receipt.id,
      product_id: parseInt(item.product_id),
      quantity: parseInt(item.quantity),
    });
  }

  res.status(201).json(enrichReceipt(receipt));
}

const VALID_TRANSITIONS = { DRAFT: ['WAITING', 'CANCELED'], WAITING: ['READY', 'CANCELED'], READY: ['DONE', 'CANCELED'] };

function update(req, res) {
  const r = db.receipts.find(r => r.id === parseInt(req.params.id));
  if (!r) return res.status(404).json({ error: 'Receipt not found' });
  if (req.user.role === 'STAFF' && r.warehouse_id !== req.user.warehouse_id)
    return res.status(403).json({ error: 'Access denied' });

  const { status, supplier } = req.body;
  if (status && status !== r.status) {
    const allowed = VALID_TRANSITIONS[r.status] || [];
    if (!allowed.includes(status))
      return res.status(400).json({ error: `Cannot transition from ${r.status} to ${status}` });
    r.status = status;
  }
  if (supplier) r.supplier = supplier;
  res.json(enrichReceipt(r));
}

function validate(req, res) {
  const r = db.receipts.find(r => r.id === parseInt(req.params.id));
  if (!r) return res.status(404).json({ error: 'Receipt not found' });
  if (req.user.role === 'STAFF' && r.warehouse_id !== req.user.warehouse_id)
    return res.status(403).json({ error: 'Access denied' });
  if (r.status !== 'READY')
    return res.status(400).json({ error: 'Receipt must be in READY status to validate' });

  const items = db.receipt_items.filter(i => i.receipt_id === r.id);
  for (const item of items) {
    const s = db.stock.find(s => s.product_id === item.product_id && s.warehouse_id === r.warehouse_id);
    if (s) {
      s.quantity += item.quantity;
      s.updated_at = new Date();
    } else {
      db.stock.push({ id: db.nextId('stock'), product_id: item.product_id, warehouse_id: r.warehouse_id, quantity: item.quantity, updated_at: new Date() });
    }
    db.movements.push({
      id: db.nextId('movements'),
      product_id: item.product_id,
      warehouse_id: r.warehouse_id,
      movement_type: 'RECEIPT',
      quantity: item.quantity,
      reference_type: 'RECEIPT',
      reference_id: r.id,
      performed_by: req.user.id,
      created_at: new Date(),
    });
  }

  r.status = 'DONE';
  r.validated_at = new Date();
  res.json({ message: 'Receipt validated successfully' });
}

module.exports = { getAll, getOne, create, update, validate };
