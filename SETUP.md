# FlowBuilder Setup Guide

## Prerequisites

- Docker Desktop installed and running
- Node.js 18+ (for local development)
- Git

---

## Quick Start with Docker

### 1. Start the Application

```bash
docker-compose up --build -d
```

This will:

- Build the Node.js application container
- Start MySQL 8.0 database container
- Run all database migrations automatically
- Populate seed data (including ETL data)
- Start the application on port 3000

### 2. Access the Application

Open your browser and navigate to: **http://localhost:3000**

### 3. Login Credentials

Use these demo credentials to login (password for all: `password123`):

| Role               | Email                                | Company                    |
| ------------------ | ------------------------------------ | -------------------------- |
| Admin              | `admin@flowbuilder.com`              | FlowBuilder Construction   |
| Construction Admin | `admin.construction@flowbuilder.com` | FlowBuilder Construction   |
| Supplier           | `supplier@materials.com`             | Taiwan Building Materials  |
| Supplier           | `admin@premiumconcrete.com`          | Premium Concrete Suppliers |
| Supplier           | `admin@steelmasters.com`             | Steel Masters Ltd.         |

---

## Docker Commands

| Command                        | Description                        |
| ------------------------------ | ---------------------------------- |
| `docker-compose logs app`      | View application logs              |
| `docker-compose logs db`       | View database logs                 |
| `docker-compose down`          | Stop the application               |
| `docker-compose down -v`       | Stop and remove volumes (clean DB) |
| `docker-compose up --build -d` | Rebuild and restart containers     |
| `docker-compose restart`       | Restart containers                 |

---

## ETL Data Processing

The ETL (Extract-Transform-Load) process transforms raw procurement data into database seed files. This populates the system with historical supplier companies, materials, and transaction records.

### ETL Source Files

Located in `database/etl/`:

| File               | Description                                  |
| ------------------ | -------------------------------------------- |
| `companies.sql`    | Raw supplier company data                    |
| `materials.sql`    | Raw material catalog with pricing statistics |
| `transactions.sql` | Historical procurement transactions          |

### Running ETL Transformation

```bash
# Step 1: Transform ETL data to seed SQL files
node database/etl/transform-etl-to-seeds.js

# Step 2: Generate user accounts for ETL suppliers
node database/etl/generate-supplier-users.js
```

### Generated Seed Files

The ETL process generates these seed files (IDs start from 1000 to avoid collisions):

| File                                 | Content                             |
| ------------------------------------ | ----------------------------------- |
| `011_seed_etl_companies.sql`         | 500 supplier companies              |
| `012_seed_etl_materials.sql`         | 458 materials with pricing stats    |
| `013_seed_etl_rfqs.sql`              | Historical RFQs grouped by supplier |
| `014_seed_etl_rfq_materials.sql`     | RFQ-Material associations           |
| `015_seed_etl_rfq_suppliers.sql`     | RFQ-Supplier associations           |
| `016_seed_etl_quotes.sql`            | Historical quotes                   |
| `017_seed_etl_quote_items.sql`       | Quote line items                    |
| `018_seed_etl_pos.sql`               | Historical purchase orders          |
| `019_seed_etl_company_materials.sql` | Supplier-Material relationships     |
| `020_seed_etl_supplier_users.sql`    | User accounts for ETL suppliers     |

### ID Mapping Files

Generated for reference and debugging:

- `company_id_map.json` - ETL company_id → new supplier_id
- `material_id_map.json` - ETL material_id → new material_id

---

## Database Connection

Use any MySQL client to connect:

| Property | Value              |
| -------- | ------------------ |
| Host     | `localhost`        |
| Port     | `3307`             |
| Database | `flowbuilder`      |
| Username | `flowbuilder_user` |
| Password | `flowbuilder_pass` |

---

## Application Structure

```
FlowBuilder/
├── src/
│   ├── config/          # Database configuration
│   ├── middleware/      # Authentication middleware
│   ├── routes/          # Express routes
│   ├── views/           # Hogan.js templates
│   ├── utils/           # Utility functions
│   ├── app.js           # Express app configuration
│   └── server.js        # Server entry point
├── database/
│   ├── etl/             # ETL transformation scripts
│   ├── migrations/      # Database schema migrations
│   └── seeds/           # Sample data (including ETL output)
├── public/
│   ├── css/             # Custom CSS
│   └── js/              # Client-side JavaScript
├── docker-compose.yml   # Docker orchestration
├── Dockerfile           # App container definition
└── package.json         # Node.js dependencies
```

---

## Technology Stack

| Layer            | Technology                    |
| ---------------- | ----------------------------- |
| Frontend         | HTMX + Bootstrap 5 + Hogan.js |
| Backend          | Express.js (Node.js)          |
| Database         | MySQL 8.0                     |
| Session Store    | MySQL-based sessions          |
| Authentication   | Session-based with bcrypt     |
| Containerization | Docker + Docker Compose       |

---

## Troubleshooting

### Port Already in Use

```bash
# Windows - Check what's using the port
netstat -ano | findstr :3000
netstat -ano | findstr :3307
```

Stop the conflicting service or change the port in `docker-compose.yml`.

### Database Connection Issues

```bash
docker-compose ps       # Check container health
docker-compose restart  # Restart containers
```

### Clear All Data and Start Fresh

```bash
docker-compose down -v
docker-compose up --build -d
```

---

## Local Development (without Docker)

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set up MySQL database locally and configure `src/config/database.js`

3. Run migrations and seeds manually

4. Start development server:
   ```bash
   npm run dev
   ```

---

## Support

- Project README: `README.md`
- Project Proposal: [FlowBuilder Proposal](https://docs.google.com/document/d/1dcIq8v57Mj9Xqpqe_KVXfqcjYuPzLEL-bFu9XqtypC4/edit?usp=sharing)
- Data Model: [FlowBuilder Data Model](https://docs.google.com/document/d/10kxlk-s-Pgy1t9cLtLFgyy80KDP1RSMHZ_i7Q3SuRB4/edit?usp=sharing)

---

**FlowBuilder Team**

- M11405103 張梓榆 (CEO)
- M11402802 I Putu Krisna Erlangga (CTO)
- M11405507 陳宇任 (CFO)
