# 📦 StockSense — Inventory Management System

A complete full-stack inventory management system built for multi-warehouse companies. StockSense supports two user roles — **Inventory Managers** and **Warehouse Staff** — with role-based access to receipts, deliveries, inventory adjustments, stock movements, and analytics dashboards.

---

## ✨ Features

- **Role-based access control** — Manager (company-wide) vs Staff (single warehouse)
- **Product catalogue** with categories, SKUs, units, and reorder levels
- **Receipt workflow** — DRAFT → WAITING → READY → DONE (increases stock on validate)
- **Delivery workflow** — DRAFT → WAITING → READY → DONE (decreases stock on validate, checks availability)
- **Inventory Adjustments** — reconcile physical counts with system quantities
- **Stock Movement History** — immutable audit trail of all stock changes
- **Manager Dashboard** — company-wide KPIs, warehouse overview, recent operations
- **Staff Dashboard** — warehouse-specific KPIs and quick actions
- **PostgreSQL transactions** — all stock changes use BEGIN/COMMIT for data integrity
- **Password reset via OTP** (dev-friendly: OTP returned in API response)
- **JWT authentication** with bcrypt password hashing
- **Modern SaaS UI** — sidebar, KPI cards, modals, badges, toast notifications

---

## 🛠 Tech Stack

| Layer     | Technology                              |
|-----------|----------------------------------------|
| Backend   | Node.js, Express.js                    |
| Database  | PostgreSQL (pg package, connection pool)|
| Frontend  | HTML5, CSS3, Vanilla JavaScript (no framework) |
| Auth      | JWT (jsonwebtoken), bcrypt (bcryptjs)  |
| Dev Tools | nodemon, dotenv                        |

---

## 📁 Project Structure

```
StockSense/
├── server/
│   ├── server.js              # Express app entry point
│   ├── db.js                  # PostgreSQL Pool
│   ├── middleware/
│   │   └── auth.js            # JWT authenticate + requireManager
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── productsController.js
│   │   ├── categoriesController.js
│   │   ├── warehousesController.js
│   │   ├── stockController.js
│   │   ├── receiptsController.js
│   │   ├── deliveriesController.js
│   │   ├── adjustmentsController.js
│   │   ├── movementsController.js
│   │   └── dashboardController.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── products.js
│   │   ├── categories.js
│   │   ├── warehouses.js
│   │   ├── stock.js
│   │   ├── receipts.js
│   │   ├── deliveries.js
│   │   ├── adjustments.js
│   │   ├── movements.js
│   │   └── dashboard.js
│   └── database/
│       ├── init.sql           # CREATE TABLE IF NOT EXISTS statements
│       ├── initDB.js          # Runs init.sql on server startup
│       └── seed.js            # Demo data seed script
├── public/
│   ├── index.html             # Redirects to login or dashboard
│   ├── login.html
│   ├── signup.html
│   ├── dashboard.html
│   ├── products.html
│   ├── receipts.html
│   ├── deliveries.html
│   ├── adjustments.html
│   ├── movements.html
│   ├── warehouses.html
│   ├── profile.html
│   ├── css/
│   │   └── main.css
│   └── js/
│       ├── api.js             # Fetch wrapper with JWT header injection
│       ├── nav.js             # Sidebar navigation renderer
│       └── utils.js           # Toast, modal, formatting helpers
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## 🐘 PostgreSQL Setup

1. Ensure PostgreSQL is running on `localhost:5432`
2. Create the database:
   ```sql
   CREATE DATABASE stocksense_db;
   ```
3. The application creates all tables automatically on first startup.

---

## ⚙️ Installation & Running

### 1. Install Node.js dependencies
```bash
npm install
```

### 2. Configure environment (optional)
```bash
cp .env.example .env
# Edit .env with your DB credentials if different from defaults
```

Default DB credentials (set in `server/db.js` as fallback):
- host: `localhost`
- port: `5432`
- database: `stocksense_db`
- user: `postgres`
- password: `Sanjay@123`

### 3. Start the server
```bash
npm start
# or for development with auto-reload:
npm run dev
```

The server starts at **http://localhost:3000**

### 4. Seed demo data
```bash
npm run seed
```

---

## 👤 Demo Users

| Email             | Password     | Role    | Warehouse                  |
|-------------------|-------------|---------|----------------------------|
| manager@demo.com  | Manager@123  | MANAGER | All warehouses             |
| staff@demo.com    | Staff@123    | STAFF   | Hyderabad Central Warehouse|

---

## 🔌 API Overview

### Authentication
| Method | Path                        | Description            |
|--------|-----------------------------|------------------------|
| POST   | /api/auth/signup            | Register new user      |
| POST   | /api/auth/login             | Login, returns JWT     |
| POST   | /api/auth/forgot-password   | Request OTP            |
| POST   | /api/auth/verify-otp        | Verify OTP             |
| POST   | /api/auth/reset-password    | Reset password         |

### Products & Categories
| Method | Path                  | Access   |
|--------|-----------------------|----------|
| GET    | /api/products         | All      |
| POST   | /api/products         | Manager  |
| PUT    | /api/products/:id     | Manager  |
| DELETE | /api/products/:id     | Manager  |
| GET    | /api/categories       | All      |
| POST   | /api/categories       | Manager  |

### Warehouses
| Method | Path               | Access  |
|--------|--------------------|---------|
| GET    | /api/warehouses    | All     |
| POST   | /api/warehouses    | Manager |
| PUT    | /api/warehouses/:id| Manager |

### Operations
| Method | Path                          | Description                          |
|--------|-------------------------------|--------------------------------------|
| GET    | /api/receipts                 | List receipts                        |
| POST   | /api/receipts                 | Create receipt (DRAFT)               |
| PUT    | /api/receipts/:id             | Update status/details                |
| POST   | /api/receipts/:id/validate    | Validate → increase stock            |
| GET    | /api/deliveries               | List deliveries                      |
| POST   | /api/deliveries               | Create delivery (DRAFT)              |
| PUT    | /api/deliveries/:id           | Update status/details                |
| POST   | /api/deliveries/:id/validate  | Validate → decrease stock (checks avail)|
| GET    | /api/adjustments              | List adjustments                     |
| POST   | /api/adjustments              | Create adjustment                    |
| POST   | /api/adjustments/:id/validate | Validate → set stock to actual qty   |

### Stock & Movements
| Method | Path                | Description                    |
|--------|---------------------|--------------------------------|
| GET    | /api/stock          | Stock levels (role-filtered)   |
| GET    | /api/movements      | Stock movement history         |
| GET    | /api/dashboard      | Dashboard KPIs                 |

---

## 📊 Stock Flow Explanation

### Receipt (inbound)
```
Create (DRAFT) → WAITING → READY → VALIDATE (DONE)
                                        ↓
                           stock.quantity += item.quantity
                           stock_movements INSERT (RECEIPT)
                           [All in one transaction]
```

### Delivery (outbound)
```
Create (DRAFT) → WAITING → READY → VALIDATE (DONE)
                                        ↓
                          Check: stock.quantity >= item.quantity
                                        ↓
                          stock.quantity -= item.quantity
                          stock_movements INSERT (DELIVERY)
                          [All in one transaction, rollback if insufficient]
```

### Inventory Adjustment
```
Create (records system_qty and actual_qty) → VALIDATE
                                                 ↓
                              stock.quantity = actual_quantity
                              stock_movements INSERT (ADJUSTMENT)
                              [All in one transaction]
```

---

## 🔒 Security

- Passwords hashed with **bcrypt** (12 rounds)
- **JWT** tokens verified on every protected endpoint
- **Parameterized queries** prevent SQL injection
- **Role-based authorization** enforced server-side (never trust frontend)
- Staff cannot access other warehouses' data
- `quantity >= 0` CHECK constraint in database

---

## 🏆 Built for Hackathon

This is a polished prototype demonstrating a complete inventory workflow. The OTP for password reset is returned directly in the API response for easy demo purposes (in production, this would be sent via email).
