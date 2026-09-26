/**
 * StockSense — In-Memory Data Store
 * Replaces PostgreSQL for demo/hackathon use.
 * All data lives here and resets on server restart.
 */

const bcrypt = require('bcryptjs');

// ── Counters for auto-increment IDs ──────────────────────────────────────────
const counters = { users: 3, warehouses: 2, categories: 4, products: 6, stock: 6, receipts: 1, receipt_items: 2, deliveries: 1, delivery_items: 2, adjustments: 1, movements: 8 };
function nextId(table) { return ++counters[table]; }

// ── Seed: Warehouses ──────────────────────────────────────────────────────────
const warehouses = [
  { id: 1, name: 'Hyderabad Central Warehouse', location: 'Hyderabad, Telangana', created_at: new Date('2024-01-01') },
  { id: 2, name: 'Bangalore Warehouse', location: 'Bangalore, Karnataka', created_at: new Date('2024-01-01') },
];

// ── Seed: Categories ──────────────────────────────────────────────────────────
const categories = [
  { id: 1, name: 'Electronics', description: 'Electronic devices and accessories' },
  { id: 2, name: 'Furniture', description: 'Office and warehouse furniture' },
  { id: 3, name: 'Construction', description: 'Construction materials' },
  { id: 4, name: 'Office Supplies', description: 'Day-to-day office supplies' },
];

// ── Seed: Products ────────────────────────────────────────────────────────────
const products = [
  { id: 1, name: 'Laptop', sku: 'ELEC-001', category_id: 1, unit: 'pieces', reorder_level: 5, created_at: new Date('2024-01-05'), updated_at: new Date('2024-01-05') },
  { id: 2, name: 'Office Chair', sku: 'FURN-001', category_id: 2, unit: 'pieces', reorder_level: 10, created_at: new Date('2024-01-05'), updated_at: new Date('2024-01-05') },
  { id: 3, name: 'Steel Rod', sku: 'CONS-001', category_id: 3, unit: 'kg', reorder_level: 50, created_at: new Date('2024-01-05'), updated_at: new Date('2024-01-05') },
  { id: 4, name: 'Desk', sku: 'FURN-002', category_id: 2, unit: 'pieces', reorder_level: 5, created_at: new Date('2024-01-05'), updated_at: new Date('2024-01-05') },
  { id: 5, name: 'Monitor', sku: 'ELEC-002', category_id: 1, unit: 'pieces', reorder_level: 5, created_at: new Date('2024-01-05'), updated_at: new Date('2024-01-05') },
  { id: 6, name: 'Keyboard', sku: 'ELEC-003', category_id: 1, unit: 'pieces', reorder_level: 10, created_at: new Date('2024-01-05'), updated_at: new Date('2024-01-05') },
];

// ── Seed: Stock ───────────────────────────────────────────────────────────────
const stock = [
  { id: 1, product_id: 1, warehouse_id: 1, quantity: 25, updated_at: new Date() },
  { id: 2, product_id: 2, warehouse_id: 1, quantity: 60, updated_at: new Date() },
  { id: 3, product_id: 3, warehouse_id: 1, quantity: 200, updated_at: new Date() },
  { id: 4, product_id: 4, warehouse_id: 2, quantity: 15, updated_at: new Date() },
  { id: 5, product_id: 5, warehouse_id: 2, quantity: 30, updated_at: new Date() },
  { id: 6, product_id: 6, warehouse_id: 1, quantity: 8, updated_at: new Date() },
];

// ── Seed: Users (passwords pre-hashed) ───────────────────────────────────────
// manager@demo.com / Manager@123
// staff@demo.com   / Staff@123
const MANAGER_HASH = bcrypt.hashSync('Manager@123', 10);
const STAFF_HASH   = bcrypt.hashSync('Staff@123', 10);

const users = [
  { id: 1, name: 'Demo Manager', email: 'manager@demo.com', password: MANAGER_HASH, role: 'MANAGER', warehouse_id: null, created_at: new Date('2024-01-01') },
  { id: 2, name: 'Demo Staff',   email: 'staff@demo.com',   password: STAFF_HASH,   role: 'STAFF',   warehouse_id: 1,    created_at: new Date('2024-01-01') },
];

// ── Seed: Receipts ────────────────────────────────────────────────────────────
const receipts = [
  { id: 1, receipt_number: 'RCT-000001', supplier: 'TechPro Supplies', warehouse_id: 1, status: 'DONE', created_by: 1, created_at: new Date('2024-01-10'), validated_at: new Date('2024-01-10') },
];
const receipt_items = [
  { id: 1, receipt_id: 1, product_id: 1, quantity: 25 },
  { id: 2, receipt_id: 1, product_id: 6, quantity: 8 },
];

// ── Seed: Deliveries ──────────────────────────────────────────────────────────
const deliveries = [
  { id: 1, delivery_number: 'DLV-000001', customer: 'ABC Corporation', warehouse_id: 1, status: 'DONE', created_by: 1, created_at: new Date('2024-01-12'), validated_at: new Date('2024-01-12') },
];
const delivery_items = [
  { id: 1, delivery_id: 1, product_id: 2, quantity: 10 },
  { id: 2, delivery_id: 1, product_id: 1, quantity: 5 },
];

// ── Seed: Adjustments ─────────────────────────────────────────────────────────
const adjustments = [
  { id: 1, adjustment_number: 'ADJ-000001', warehouse_id: 1, product_id: 3, system_quantity: 203, actual_quantity: 200, difference: -3, reason: 'Physical count after annual audit', status: 'VALIDATED', created_by: 1, created_at: new Date('2024-01-15'), validated_at: new Date('2024-01-15') },
];

// ── Seed: Stock Movements ─────────────────────────────────────────────────────
const movements = [
  { id: 1, product_id: 1, warehouse_id: 1, movement_type: 'RECEIPT',    quantity:  25,  reference_type: 'INITIAL_STOCK', reference_id: null, performed_by: 1, created_at: new Date('2024-01-05') },
  { id: 2, product_id: 2, warehouse_id: 1, movement_type: 'RECEIPT',    quantity:  70,  reference_type: 'INITIAL_STOCK', reference_id: null, performed_by: 1, created_at: new Date('2024-01-05') },
  { id: 3, product_id: 3, warehouse_id: 1, movement_type: 'RECEIPT',    quantity:  203, reference_type: 'INITIAL_STOCK', reference_id: null, performed_by: 1, created_at: new Date('2024-01-05') },
  { id: 4, product_id: 6, warehouse_id: 1, movement_type: 'RECEIPT',    quantity:  8,   reference_type: 'RECEIPT',       reference_id: 1,    performed_by: 1, created_at: new Date('2024-01-10') },
  { id: 5, product_id: 2, warehouse_id: 1, movement_type: 'DELIVERY',   quantity: -10,  reference_type: 'DELIVERY',      reference_id: 1,    performed_by: 1, created_at: new Date('2024-01-12') },
  { id: 6, product_id: 1, warehouse_id: 1, movement_type: 'DELIVERY',   quantity: -5,   reference_type: 'DELIVERY',      reference_id: 1,    performed_by: 1, created_at: new Date('2024-01-12') },
  { id: 7, product_id: 3, warehouse_id: 1, movement_type: 'ADJUSTMENT', quantity: -3,   reference_type: 'ADJUSTMENT',    reference_id: 1,    performed_by: 1, created_at: new Date('2024-01-15') },
  { id: 8, product_id: 4, warehouse_id: 2, movement_type: 'RECEIPT',    quantity:  15,  reference_type: 'INITIAL_STOCK', reference_id: null, performed_by: 1, created_at: new Date('2024-01-05') },
  { id: 9, product_id: 5, warehouse_id: 2, movement_type: 'RECEIPT',    quantity:  30,  reference_type: 'INITIAL_STOCK', reference_id: null, performed_by: 1, created_at: new Date('2024-01-05') },
];

// ── OTP store ─────────────────────────────────────────────────────────────────
const otpStore = new Map();

// ── Helper: attach related names to records ───────────────────────────────────
function warehouseName(id) { return warehouses.find(w => w.id === id)?.name || 'Unknown'; }
function productName(id)   { return products.find(p => p.id === id)?.name || 'Unknown'; }
function userName(id)      { return users.find(u => u.id === id)?.name || 'Unknown'; }
function categoryName(id)  { return categories.find(c => c.id === id)?.name || null; }

module.exports = {
  warehouses, categories, products, stock,
  users, receipts, receipt_items, deliveries, delivery_items,
  adjustments, movements, otpStore,
  nextId, warehouseName, productName, userName, categoryName,
};
