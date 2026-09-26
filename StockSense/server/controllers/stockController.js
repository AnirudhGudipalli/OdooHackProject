const db = require('../store');

function getAll(req, res) {
  let rows = db.stock;
  if (req.user.role === 'STAFF') {
    rows = rows.filter(s => s.warehouse_id === req.user.warehouse_id);
  }
  const enriched = rows.map(s => {
    const p = db.products.find(p => p.id === s.product_id) || {};
    const w = db.warehouses.find(w => w.id === s.warehouse_id) || {};
    const c = db.categories.find(c => c.id === p.category_id) || {};
    return {
      ...s,
      product_name: p.name || 'Unknown',
      sku: p.sku || '',
      unit: p.unit || '',
      reorder_level: p.reorder_level || 0,
      category_name: c.name || null,
      warehouse_name: w.name || 'Unknown',
    };
  });
  res.json(enriched);
}

function getByProduct(req, res) {
  const pid = parseInt(req.params.productId);
  const rows = db.stock.filter(s => s.product_id === pid).map(s => ({
    ...s,
    warehouse_name: db.warehouseName(s.warehouse_id),
  }));
  res.json(rows);
}

module.exports = { getAll, getByProduct };
