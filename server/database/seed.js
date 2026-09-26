require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { initDB } = require('./initDB');

async function seed() {
  const client = await pool.connect();
  try {
    await initDB();
    await client.query('BEGIN');

    // Warehouses
    const whResult = await client.query(`
      INSERT INTO warehouses (name, location)
      VALUES
        ('Hyderabad Central Warehouse', 'Hyderabad, Telangana, India'),
        ('Bangalore Warehouse', 'Bangalore, Karnataka, India')
      ON CONFLICT DO NOTHING
      RETURNING id, name
    `);
    console.log('🏭 Warehouses seeded');

    // Get warehouse IDs
    const whRows = await client.query('SELECT id, name FROM warehouses ORDER BY id LIMIT 2');
    const hydWh = whRows.rows.find(r => r.name.includes('Hyderabad'));
    const banWh = whRows.rows.find(r => r.name.includes('Bangalore'));

    // Categories
    await client.query(`
      INSERT INTO categories (name, description)
      VALUES
        ('Electronics', 'Electronic devices and components'),
        ('Furniture', 'Office and warehouse furniture'),
        ('Construction', 'Construction materials and supplies'),
        ('Office Supplies', 'General office stationery and supplies')
      ON CONFLICT (name) DO NOTHING
    `);
    console.log('📦 Categories seeded');

    const catRows = await client.query('SELECT id, name FROM categories');
    const catMap = {};
    catRows.rows.forEach(r => { catMap[r.name] = r.id; });

    // Products
    const products = [
      { name: 'Laptop', sku: 'ELEC-LAP-001', category: 'Electronics', unit: 'units', reorder: 5 },
      { name: 'Office Chair', sku: 'FURN-CHR-001', category: 'Furniture', unit: 'units', reorder: 3 },
      { name: 'Steel Rod', sku: 'CONS-ROD-001', category: 'Construction', unit: 'pcs', reorder: 50 },
      { name: 'Desk', sku: 'FURN-DSK-001', category: 'Furniture', unit: 'units', reorder: 2 },
      { name: 'Monitor', sku: 'ELEC-MON-001', category: 'Electronics', unit: 'units', reorder: 5 },
      { name: 'Keyboard', sku: 'ELEC-KBD-001', category: 'Electronics', unit: 'units', reorder: 10 },
      { name: 'A4 Paper Ream', sku: 'OFFC-PAP-001', category: 'Office Supplies', unit: 'reams', reorder: 20 },
      { name: 'Ballpoint Pen Box', sku: 'OFFC-PEN-001', category: 'Office Supplies', unit: 'boxes', reorder: 10 },
    ];

    for (const p of products) {
      await client.query(`
        INSERT INTO products (name, sku, category_id, unit, reorder_level)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (sku) DO NOTHING
      `, [p.name, p.sku, catMap[p.category], p.unit, p.reorder]);
    }
    console.log('🛒 Products seeded');

    // Stock data
    const prodRows = await client.query('SELECT id, sku FROM products');
    const prodMap = {};
    prodRows.rows.forEach(r => { prodMap[r.sku] = r.id; });

    const stockData = [
      // Hyderabad
      { sku: 'ELEC-LAP-001', wh: hydWh.id, qty: 25 },
      { sku: 'ELEC-MON-001', wh: hydWh.id, qty: 4 },
      { sku: 'ELEC-KBD-001', wh: hydWh.id, qty: 8 },
      { sku: 'FURN-CHR-001', wh: hydWh.id, qty: 15 },
      { sku: 'FURN-DSK-001', wh: hydWh.id, qty: 1 },
      { sku: 'CONS-ROD-001', wh: hydWh.id, qty: 200 },
      { sku: 'OFFC-PAP-001', wh: hydWh.id, qty: 50 },
      { sku: 'OFFC-PEN-001', wh: hydWh.id, qty: 0 },
      // Bangalore
      { sku: 'ELEC-LAP-001', wh: banWh.id, qty: 10 },
      { sku: 'ELEC-MON-001', wh: banWh.id, qty: 12 },
      { sku: 'ELEC-KBD-001', wh: banWh.id, qty: 30 },
      { sku: 'FURN-CHR-001', wh: banWh.id, qty: 0 },
      { sku: 'FURN-DSK-001', wh: banWh.id, qty: 5 },
      { sku: 'CONS-ROD-001', wh: banWh.id, qty: 80 },
      { sku: 'OFFC-PAP-001', wh: banWh.id, qty: 15 },
      { sku: 'OFFC-PEN-001', wh: banWh.id, qty: 5 },
    ];

    for (const s of stockData) {
      await client.query(`
        INSERT INTO stock (product_id, warehouse_id, quantity)
        VALUES ($1, $2, $3)
        ON CONFLICT (product_id, warehouse_id) DO NOTHING
      `, [prodMap[s.sku], s.wh, s.qty]);
    }
    console.log('📊 Stock seeded');

    // Users
    const managerHash = await bcrypt.hash('Manager@123', 12);
    const staffHash = await bcrypt.hash('Staff@123', 12);

    await client.query(`
      INSERT INTO users (name, email, password, role, warehouse_id)
      VALUES
        ('Demo Manager', 'manager@demo.com', $1, 'MANAGER', NULL),
        ('Demo Staff', 'staff@demo.com', $2, 'STAFF', $3)
      ON CONFLICT (email) DO NOTHING
    `, [managerHash, staffHash, hydWh.id]);
    console.log('👥 Demo users seeded');

    await client.query('COMMIT');
    console.log('\n✅ Seed complete!');
    console.log('   manager@demo.com / Manager@123  (MANAGER)');
    console.log('   staff@demo.com   / Staff@123    (STAFF — Hyderabad Central Warehouse)');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
