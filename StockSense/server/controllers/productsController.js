const db = require('../store');

function enrichProduct(p) {
  const totalStock = db.stock
    .filter(s => s.product_id === p.id)
    .reduce((sum, s) => sum + s.quantity, 0);
  return {
    ...p,
    category_name: db.categoryName(p.category_id),
    total_stock: totalStock,
  };
}

function getAll(req, res) {
  res.json(db.products.map(enrichProduct));
}

function getOne(req, res) {
  const p = db.products.find(p => p.id === parseInt(req.params.id));
  if (!p) return res.status(404).json({ error: 'Product not found' });
  res.json(enrichProduct(p));
}

function create(req, res) {
  const { name, sku, category_id, unit, reorder_level, initial_stock, warehouse_id } = req.body;
  if (!name || !sku) return res.status(400).json({ error: 'name and sku are required' });
  if (db.products.find(p => p.sku.toUpperCase() === sku.toUpperCase()))
    return res.status(409).json({ error: 'SKU already exists' });

  const product = {
    id: db.nextId('products'),
    name,
    sku: sku.toUpperCase(),
    category_id: category_id ? parseInt(category_id) : null,
    unit: unit || 'units',
    reorder_level: parseInt(reorder_level) || 0,
    created_at: new Date(),
    updated_at: new Date(),
  };
  db.products.push(product);

  if (initial_stock && parseInt(initial_stock) > 0 && warehouse_id) {
    const qty = parseInt(initial_stock);
    const whId = parseInt(warehouse_id);
    const existing = db.stock.find(s => s.product_id === product.id && s.warehouse_id === whId);
    if (existing) {
      existing.quantity += qty;
      existing.updated_at = new Date();
    } else {
      db.stock.push({ id: db.nextId('stock'), product_id: product.id, warehouse_id: whId, quantity: qty, updated_at: new Date() });
    }
    db.movements.push({
      id: db.nextId('movements'),
      product_id: product.id,
      warehouse_id: whId,
      movement_type: 'RECEIPT',
      quantity: qty,
      reference_type: 'INITIAL_STOCK',
      reference_id: null,
      performed_by: req.user.id,
      created_at: new Date(),
    });
  }

  res.status(201).json(enrichProduct(product));
}

function update(req, res) {
  const p = db.products.find(p => p.id === parseInt(req.params.id));
  if (!p) return res.status(404).json({ error: 'Product not found' });

  const { name, sku, category_id, unit, reorder_level } = req.body;
  if (sku && sku.toUpperCase() !== p.sku) {
    if (db.products.find(x => x.sku.toUpperCase() === sku.toUpperCase() && x.id !== p.id))
      return res.status(409).json({ error: 'SKU already exists' });
    p.sku = sku.toUpperCase();
  }
  if (name) p.name = name;
  if (category_id !== undefined) p.category_id = category_id ? parseInt(category_id) : null;
  if (unit) p.unit = unit;
  if (reorder_level !== undefined) p.reorder_level = parseInt(reorder_level) || 0;
  p.updated_at = new Date();

  res.json(enrichProduct(p));
}

function remove(req, res) {
  const idx = db.products.findIndex(p => p.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Product not found' });
  db.products.splice(idx, 1);
  res.json({ message: 'Product deleted' });
}

module.exports = { getAll, getOne, create, update, remove };
