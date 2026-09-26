const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'stocksense_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Sanjay@123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

/**
 * Run a query with parameterized values (prevents SQL injection)
 */
const query = (text, params) => pool.query(text, params);

/**
 * Get a client for transaction use
 */
const getClient = () => pool.connect();

module.exports = { query, getClient, pool };
