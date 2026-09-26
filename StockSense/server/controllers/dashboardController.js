const db = require('../store');

function getDashboard(req, res) {
  if (req.user.role === 'MANAGER') return getManagerDashboard(req, res);
  return getStaffDashboard(req, res);
}

function getManagerDashboard(req, res) {
  const totalStock = db.stock.reduce((sum, s) => sum + s.quantity, 0);

  const lowStockItems = db.stock.filter(s => {
    const p = db.products.find(p => p.id === s.product_id);
    return p && s.quantity > 0 && s.quantity <= p.reorder_level;
  }).length;

  const outOfStockItems = db.stock.filter(s => s.quantity === 0).length;

  const pendingReceipts = db.receipts.filter(r => !['DONE', 'CANCELED'].includes(r.status)).length;
  const pendingDeliveries = db.deliveries.filter(d => !['DONE', 'CANCELED'].includes(d.status)).length;

  const recentMovements = db.movements.slice().reverse().slice(0, 10).map(m => ({
    ...m,
    product_name: db.productName(m.product_id),
    warehouse_name: db.warehouseName(m.warehouse_id),
    performed_by_name: db.userName(m.performed_by),
  }));

  const recentReceipts = db.receipts.slice().reverse().slice(0, 5).map(r => ({
    ...r,
    warehouse_name: db.warehouseName(r.warehouse_id),
  }));

  const recentDeliveries = db.deliveries.slice().reverse().slice(0, 5).map(d => ({
    ...d,
    warehouse_name: db.warehouseName(d.warehouse_id),
  }));

  const warehouseSummary = db.warehouses.map(w => {
    const whStock = db.stock.filter(s => s.warehouse_id === w.id);
    return {
      id: w.id,
      name: w.name,
      location: w.location,
      total_stock: whStock.reduce((sum, s) => sum + s.quantity, 0),
      out_of_stock: whStock.filter(s => s.quantity === 0).length,
    };
  });

  res.json({
    kpis: { total_stock: totalStock, low_stock_items: lowStockItems, out_of_stock_items: outOfStockItems, pending_receipts: pendingReceipts, pending_deliveries: pendingDeliveries },
    recent_movements: recentMovements,
    recent_receipts: recentReceipts,
    recent_deliveries: recentDeliveries,
    warehouse_summary: warehouseSummary,
  });
}

function getStaffDashboard(req, res) {
  const whId = req.user.warehouse_id;
  if (!whId) return res.status(400).json({ error: 'No warehouse assigned' });

  const wh = db.warehouses.find(w => w.id === whId);
  const whStock = db.stock.filter(s => s.warehouse_id === whId);

  const totalStock = whStock.reduce((sum, s) => sum + s.quantity, 0);
  const lowStockItems = whStock.filter(s => {
    const p = db.products.find(p => p.id === s.product_id);
    return p && s.quantity > 0 && s.quantity <= p.reorder_level;
  }).length;
  const outOfStockItems = whStock.filter(s => s.quantity === 0).length;
  const pendingReceipts = db.receipts.filter(r => r.warehouse_id === whId && !['DONE', 'CANCELED'].includes(r.status)).length;
  const pendingDeliveries = db.deliveries.filter(d => d.warehouse_id === whId && !['DONE', 'CANCELED'].includes(d.status)).length;

  const recentMovements = db.movements.filter(m => m.warehouse_id === whId).slice().reverse().slice(0, 8).map(m => ({
    ...m,
    product_name: db.productName(m.product_id),
    performed_by_name: db.userName(m.performed_by),
  }));

  res.json({
    warehouse: wh,
    kpis: { total_stock: totalStock, low_stock_items: lowStockItems, out_of_stock_items: outOfStockItems, pending_receipts: pendingReceipts, pending_deliveries: pendingDeliveries },
    recent_movements: recentMovements,
  });
}

function getProfile(req, res) {
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const wh = db.warehouses.find(w => w.id === user.warehouse_id);
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, warehouse_id: user.warehouse_id, warehouse_name: wh ? wh.name : null, created_at: user.created_at });
}

async function updateProfile(req, res) {
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { name, email, password } = req.body;
  if (email && email.toLowerCase() !== user.email) {
    if (db.users.find(u => u.email === email.toLowerCase() && u.id !== user.id))
      return res.status(409).json({ error: 'Email already in use' });
    user.email = email.toLowerCase();
  }
  if (name) user.name = name;
  if (password) {
    const bcrypt = require('bcryptjs');
    user.password = await bcrypt.hash(password, 10);
  }
  const wh = db.warehouses.find(w => w.id === user.warehouse_id);
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, warehouse_id: user.warehouse_id, warehouse_name: wh ? wh.name : null });
}

module.exports = { getDashboard, getProfile, updateProfile };
