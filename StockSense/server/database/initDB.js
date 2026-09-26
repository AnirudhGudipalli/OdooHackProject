const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

async function initDB() {
  const sql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('✅ Database tables initialized');
  } catch (err) {
    console.error('❌ Database initialization failed:', err.message);
    throw err;
  }
}

module.exports = { initDB };
