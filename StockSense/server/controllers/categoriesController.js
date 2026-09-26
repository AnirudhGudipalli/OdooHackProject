const db = require('../store');

function getAll(req, res) {
  res.json(db.categories);
}

function create(req, res) {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (db.categories.find(c => c.name.toLowerCase() === name.toLowerCase()))
    return res.status(409).json({ error: 'Category name already exists' });
  const cat = { id: db.nextId('categories'), name, description: description || null };
  db.categories.push(cat);
  res.status(201).json(cat);
}

module.exports = { getAll, create };
