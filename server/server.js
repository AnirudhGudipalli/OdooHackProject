const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/products',    require('./routes/products'));
app.use('/api/categories',  require('./routes/categories'));
app.use('/api/warehouses',  require('./routes/warehouses'));
app.use('/api/stock',       require('./routes/stock'));
app.use('/api/receipts',    require('./routes/receipts'));
app.use('/api/deliveries',  require('./routes/deliveries'));
app.use('/api/adjustments', require('./routes/adjustments'));
app.use('/api/movements',   require('./routes/movements'));
app.use('/api/dashboard',   require('./routes/dashboard'));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'StockSense IMS', mode: 'in-memory' }));

// ── SPA fallback ──────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  } else {
    res.status(404).json({ error: 'API route not found' });
  }
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 StockSense IMS running on http://localhost:${PORT}`);
  console.log(`   Mode: IN-MEMORY (no database required)`);
  console.log(`   Demo login: manager@demo.com / Manager@123`);
  console.log(`   Demo login: staff@demo.com   / Staff@123\n`);
});
