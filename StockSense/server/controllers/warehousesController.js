const db = require('../store');

function getAll(req, res) {
  res.json(db.warehouses);
}

function create(req, res) {
  const { name, location } = req.body;
  if (!name || !location) return res.status(400).json({ error: 'name and location are required' });
  const wh = { id: db.nextId('warehouses'), name, location, created_at: new Date() };
  db.warehouses.push(wh);
  res.status(201).json(wh);
}

function update(req, res) {
  const { id } = req.params;
  const wh = db.warehouses.find(w => w.id === parseInt(id));
  if (!wh) return res.status(404).json({ error: 'Warehouse not found' });
  if (req.body.name) wh.name = req.body.name;
  if (req.body.location) wh.location = req.body.location;
  res.json(wh);
}

module.exports = { getAll, create, update };
