# Requirements Document

## Introduction

StockSense is a full-stack inventory management system (IMS) for companies with multiple warehouses. It supports two user roles: Inventory Managers who have company-wide visibility and control, and Warehouse Staff who operate within their assigned warehouse. The system manages products, stock levels, receipts (inbound), deliveries (outbound), inventory adjustments, and stock movement history through a professional SaaS-style web interface.

## Glossary

- **System**: The StockSense IMS web application
- **Manager**: A user with role MANAGER who has company-wide access to all warehouses and operations
- **Staff**: A user with role STAFF who is assigned to a single warehouse and can only operate within it
- **Warehouse**: A physical storage location tracked in the system
- **Product**: An item tracked by the system with a unique SKU
- **Stock**: The quantity of a product stored at a specific warehouse
- **Receipt**: An inbound stock operation recording goods arriving from a supplier
- **Delivery**: An outbound stock operation recording goods leaving to a customer
- **Adjustment**: An inventory count operation that reconciles system quantity with actual physical quantity
- **Stock_Movement**: An immutable audit record created whenever stock quantity changes
- **SKU**: Stock Keeping Unit — a unique alphanumeric identifier for a product
- **Reorder_Level**: The stock quantity threshold below which a product is considered LOW STOCK
- **OTP**: One-Time Password used for password reset verification
- **JWT**: JSON Web Token used for session authentication
- **Validator**: The backend middleware that checks authorization before processing requests
- **Pool**: The PostgreSQL connection pool managed by the pg package

---

## Requirements

### Requirement 1: User Authentication and Registration

**User Story:** As a new user, I want to register and log in to the system, so that I can access features appropriate to my role.

#### Acceptance Criteria

1. THE System SHALL provide a signup form collecting name, email, password, role (MANAGER or STAFF), and warehouse assignment (required when role is STAFF).
2. WHEN a signup request is submitted, THE System SHALL hash the password using bcrypt before storing it in the database.
3. WHEN a signup request is submitted with an email that already exists, THE System SHALL return a 409 error with a descriptive message.
4. WHEN a login request is submitted with valid credentials, THE System SHALL return a JWT token and the user's role.
5. WHEN a login request is submitted with invalid credentials, THE System SHALL return a 401 error.
6. WHEN a Manager logs in successfully, THE System SHALL redirect the user to the Manager dashboard.
7. WHEN a Staff member logs in successfully, THE System SHALL redirect the user to the Staff dashboard.
8. THE System SHALL store passwords exclusively as bcrypt hashes and SHALL never store or return plaintext passwords.

### Requirement 2: Role-Based Authorization

**User Story:** As a system administrator, I want role-based access control enforced on the backend, so that users cannot access resources beyond their authorization level.

#### Acceptance Criteria

1. WHEN any protected API endpoint is called without a valid JWT token, THE Validator SHALL return a 401 Unauthorized response.
2. WHEN a Staff member calls a Manager-only API endpoint, THE Validator SHALL return a 403 Forbidden response.
3. WHEN a Staff member requests stock data, THE System SHALL return only data for the Staff member's assigned warehouse.
4. THE System SHALL enforce authorization based on the JWT token content and SHALL never trust role information sent from the frontend.
5. WHEN a Staff member attempts to access another warehouse's data, THE System SHALL return a 403 Forbidden response.

### Requirement 3: Product Management

**User Story:** As a Manager, I want to create and manage products, so that the system accurately reflects the company's inventory catalogue.

#### Acceptance Criteria

1. THE System SHALL provide a product creation form with fields: name, SKU, category, unit of measure, and reorder level.
2. WHEN a product is created with a SKU that already exists, THE System SHALL return a 409 error.
3. THE System SHALL allow optional initial stock quantity and warehouse to be specified when creating a product.
4. WHEN initial stock is provided during product creation, THE System SHALL create a stock record and a corresponding RECEIPT Stock_Movement in the same database transaction.
5. WHEN a product is updated, THE System SHALL update the product record and reflect changes immediately in the product list.
6. THE System SHALL allow Managers to create, edit, and delete products and categories.
7. THE System SHALL display each product's stock status as IN STOCK, LOW STOCK (quantity <= reorder_level), or OUT OF STOCK (quantity = 0).

### Requirement 4: Warehouse Management

**User Story:** As a Manager, I want to create and manage warehouses, so that the system reflects the company's physical storage locations.

#### Acceptance Criteria

1. THE System SHALL allow Managers to create warehouses with a name and location.
2. THE System SHALL display all warehouses with their name, location, and creation date.
3. WHEN a warehouse is created, THE System SHALL make it immediately available for assignment to Staff users and stock operations.
4. WHILE a warehouse has associated stock or staff assignments, THE System SHALL prevent deletion of that warehouse.

### Requirement 5: Stock Receipt Workflow

**User Story:** As a Manager or Staff member, I want to record incoming goods through a receipt workflow, so that inbound stock is tracked accurately.

#### Acceptance Criteria

1. THE System SHALL support receipt statuses: DRAFT, WAITING, READY, DONE, and CANCELED.
2. WHEN a receipt is created, THE System SHALL assign it a unique receipt number and set its status to DRAFT.
3. THE System SHALL allow receipts to transition through statuses: DRAFT → WAITING → READY → DONE and DRAFT → CANCELED.
4. WHEN a receipt is validated (status set to DONE), THE System SHALL increase the stock quantity for each receipt item at the target warehouse within a single database transaction.
5. WHEN a receipt is validated, THE System SHALL create a Stock_Movement record of type RECEIPT for each receipt item in the same transaction.
6. WHEN a receipt is validated, THE System SHALL record the validated_at timestamp.
7. IF a receipt validation transaction fails, THEN THE System SHALL rollback all changes and return a 500 error.
8. WHEN a Staff member creates a receipt, THE System SHALL automatically assign it to the Staff member's warehouse.

### Requirement 6: Stock Delivery Workflow

**User Story:** As a Manager or Staff member, I want to record outgoing goods through a delivery workflow, so that outbound stock is tracked accurately.

#### Acceptance Criteria

1. THE System SHALL support delivery statuses: DRAFT, WAITING, READY, DONE, and CANCELED.
2. WHEN a delivery is created, THE System SHALL assign it a unique delivery number and set its status to DRAFT.
3. WHEN a delivery is validated (status set to DONE), THE System SHALL check that sufficient stock exists for each delivery item at the source warehouse before committing.
4. IF stock is insufficient for a delivery item during validation, THEN THE System SHALL return a 400 error and rollback the transaction without modifying any stock.
5. WHEN a delivery is validated with sufficient stock, THE System SHALL decrease the stock quantity for each item within a single database transaction.
6. WHEN a delivery is validated, THE System SHALL create a Stock_Movement record of type DELIVERY for each delivery item in the same transaction.
7. THE System SHALL never allow stock quantity to go below zero.

### Requirement 7: Inventory Adjustment

**User Story:** As a Manager or Staff member, I want to record inventory counts and adjustments, so that the system stock reflects actual physical stock.

#### Acceptance Criteria

1. WHEN an adjustment is created, THE System SHALL record the product, warehouse, system_quantity (current stock), actual_quantity (counted quantity), and difference (actual_quantity - system_quantity).
2. WHEN an adjustment is validated, THE System SHALL update the stock quantity to the actual_quantity within a single database transaction.
3. WHEN an adjustment is validated, THE System SHALL create a Stock_Movement record of type ADJUSTMENT in the same transaction.
4. WHEN an adjustment is validated, THE System SHALL record the validated_at timestamp.
5. THE System SHALL assign a unique adjustment number to each inventory adjustment.

### Requirement 8: Stock Movement History

**User Story:** As a Manager or Staff member, I want to view a complete history of stock movements, so that I can audit all changes to inventory levels.

#### Acceptance Criteria

1. THE System SHALL display stock movements with columns: Date, Product, Warehouse, Movement Type, Quantity, Reference, and Performed By.
2. WHEN a Manager views stock movements, THE System SHALL display movements from all warehouses.
3. WHEN a Staff member views stock movements, THE System SHALL display only movements for the Staff member's assigned warehouse.
4. THE System SHALL support movement types: RECEIPT, DELIVERY, ADJUSTMENT, TRANSFER_IN, and TRANSFER_OUT.
5. THE System SHALL record stock movements as immutable audit records that cannot be edited or deleted.

### Requirement 9: Manager Dashboard and Analytics

**User Story:** As a Manager, I want a dashboard with real-time KPIs and operational summaries, so that I can monitor the health of company-wide inventory.

#### Acceptance Criteria

1. THE System SHALL display the following KPIs on the Manager dashboard: Total Stock (sum of all quantities), Low Stock Items count, Out of Stock Items count, Pending Receipts count, Pending Deliveries count.
2. WHEN a Manager views the dashboard, THE System SHALL calculate all KPIs from live database data.
3. THE System SHALL display recent receipts, deliveries, and adjustments on the Manager dashboard with their status badges.
4. THE System SHALL highlight low-stock and out-of-stock products on the dashboard.

### Requirement 10: Staff Dashboard

**User Story:** As a Warehouse Staff member, I want a dashboard showing my warehouse's KPIs and quick actions, so that I can efficiently manage my assigned warehouse.

#### Acceptance Criteria

1. THE System SHALL display warehouse-specific KPIs for the Staff member's assigned warehouse: Total Stock, Low Stock Items, Pending Receipts, and Pending Deliveries.
2. THE System SHALL provide quick action buttons on the Staff dashboard: Process Receipt, Process Delivery, Stock Count, and View Movements.
3. WHEN a Staff member views the dashboard, THE System SHALL only display data for the Staff member's assigned warehouse.

### Requirement 11: Database Integrity and Transactions

**User Story:** As a system operator, I want all stock-modifying operations to use database transactions, so that inventory data remains consistent even if a step fails.

#### Acceptance Criteria

1. WHEN a receipt, delivery, or adjustment is validated, THE System SHALL execute stock updates, stock movement inserts, and operation status updates within a single PostgreSQL transaction (BEGIN → operations → COMMIT).
2. IF any step within a validation transaction fails, THEN THE System SHALL execute ROLLBACK and return an error response without partial data changes.
3. THE System SHALL enforce a CHECK constraint on the stock table to prevent the quantity column from going below zero.
4. THE System SHALL use parameterized queries for all database operations to prevent SQL injection.

### Requirement 12: Seed Data and Demo Environment

**User Story:** As a hackathon evaluator, I want a pre-seeded database with realistic demo data, so that the application can be demonstrated immediately after setup.

#### Acceptance Criteria

1. THE System SHALL provide a seed script that creates two warehouses: Hyderabad Central Warehouse and Bangalore Warehouse.
2. THE System SHALL seed four categories: Electronics, Furniture, Construction, and Office Supplies.
3. THE System SHALL seed at least six products: Laptop, Office Chair, Steel Rod, Desk, Monitor, and Keyboard with realistic stock quantities.
4. THE System SHALL seed two demo users: manager@demo.com with password Manager@123 and role MANAGER, and staff@demo.com with password Staff@123 assigned to Hyderabad Central Warehouse.
5. WHEN the seed script is run, THE System SHALL hash all demo passwords using bcrypt before inserting them.

### Requirement 13: User Profile Management

**User Story:** As any user, I want to view and update my profile information, so that my account details remain accurate.

#### Acceptance Criteria

1. THE System SHALL display the user's name, email, role, and assigned warehouse on the profile page.
2. WHEN a user submits a profile update, THE System SHALL update the name and email fields in the database.
3. WHEN a profile update includes a new password, THE System SHALL hash the new password using bcrypt before storing it.

### Requirement 14: Password Reset via OTP

**User Story:** As a user who has forgotten their password, I want to reset it using an OTP, so that I can regain access to my account.

#### Acceptance Criteria

1. WHEN a user submits a forgot-password request with a registered email, THE System SHALL generate a 6-digit OTP and return it in the API response (dev-friendly for hackathon).
2. WHEN a user submits a valid OTP, THE System SHALL allow the user to set a new password.
3. WHEN a user submits an invalid or expired OTP, THE System SHALL return a 400 error.
4. WHEN a new password is set via OTP reset, THE System SHALL hash the password using bcrypt before storing it.
