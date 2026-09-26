const db = require('../store');

function getAll(req, res) {
  let rows = db.movements;
  if (req.user.role === 'STAFF') rows = rows.filter(m => m.warehouse_id === req.user.warehouse_id);

  const enriched = rows.map(m => ({
    ...m,
    product_name: db.productName(m.product_id),
    sku: db.products.find(p => p.id === m.product_id)?.sku || '',
    warehouse_name: db.warehouseName(m.warehouse_id),
    performed_by_name: db.userName(m.performed_by),
  }));

  // Return newest first
  res.json(enriched.slice().reverse());
}

module.exports = { getAll };
