# FlowBuilder Setup Guide

## Prerequisites

- Docker Desktop installed and running
- Node.js 18+ (for local development)
- Git

## Quick Start with Docker

### 1. Start the Application

```bash
docker-compose up --build -d
```

This will:

- Build the Node.js application container
- Start MySQL 8.0 database container
- Run all database migrations automatically
- Populate seed data
- Start the application on port 3000

### 2. Access the Application

Open your browser and navigate to: **http://localhost:3000**

### 3. Login Credentials

Use these demo credentials to login:

**Construction Admin:**

- Email: `admin.construction@buildright.com`
- Password: `password123`

**Admin User:**

- Email: `admin@buildright.com`
- Password: `password123`

**Supplier User:**

- Email: `supplier@materials.com`
- Password: `password123`

## Docker Commands

### View Application Logs

```bash
docker-compose logs app
```

### View Database Logs

```bash
docker-compose logs db
```

### Stop the Application

```bash
docker-compose down
```

### Stop and Remove Volumes (Clean Database)

```bash
docker-compose down -v
```

### Rebuild Containers

```bash
docker-compose up --build -d
```

## Application Structure

```
FlowBuilder/
├── src/
│   ├── config/          # Database configuration
│   ├── middleware/      # Authentication middleware
│   ├── routes/          # Express routes
│   │   ├── auth.js      # Authentication routes
│   │   ├── dashboard.js # Dashboard routes
│   │   ├── projects.js  # Project management routes
│   │   ├── rfqs.js      # RFQ management routes
│   │   └── quotes.js    # Quote management routes
│   ├── views/           # Hogan.js templates
│   │   ├── partials/    # Reusable components
│   │   └── *.hjs        # Page templates
│   ├── utils/           # Utility functions
│   ├── app.js           # Express app configuration
│   └── server.js        # Server entry point
├── database/
│   ├── migrations/      # Database schema migrations
│   └── seeds/           # Sample data
├── public/
│   ├── css/             # Custom CSS
│   └── js/              # Client-side JavaScript
├── docker-compose.yml   # Docker orchestration
├── Dockerfile           # App container definition
└── package.json         # Node.js dependencies
```

## Technology Stack

- **Frontend**: HTMX + Bootstrap 5 + Hogan.js (HJS)
- **Backend**: Express.js (Node.js)
- **Database**: MySQL 8.0
- **Session Store**: MySQL-based sessions
- **Authentication**: Session-based with bcrypt
- **Containerization**: Docker + Docker Compose

## Troubleshooting

### Port Already in Use

If you see an error about port 3306 or 3000 being in use:

1. Check what's using the port:

```bash
# Windows
netstat -ano | findstr :3000
netstat -ano | findstr :3307
```

2. Stop the conflicting service or change the port in `docker-compose.yml`

### Database Connection Issues

If the app can't connect to the database:

1. Check database health:

```bash
docker-compose ps
```

2. Restart containers:

```bash
docker-compose restart
```

### Clear All Data and Start Fresh

```bash
docker-compose down -v
docker-compose up --build -d
```

## Development

### Local Development (without Docker)

1. Install dependencies:

```bash
npm install
```

2. Set up MySQL database locally and update connection details in `src/config/database.js`

3. Run migrations and seeds manually

4. Start development server:

```bash
npm run dev
```

### View Database

Use any MySQL client to connect:

- Host: `localhost`
- Port: `3307`
- Database: `flowbuilder`
- Username: `flowbuilder_user`
- Password: `flowbuilder_pass`

## Support

For issues or questions, refer to:

- Project README: `README.md`
- Project Proposal: [FlowBuilder Proposal](https://docs.google.com/document/d/1dcIq8v57Mj9Xqpqe_KVXfqcjYuPzLEL-bFu9XqtypC4/edit?usp=sharing)
- Data Model: [FlowBuilder Data Model](https://docs.google.com/document/d/10kxlk-s-Pgy1t9cLtLFgyy80KDP1RSMHZ_i7Q3SuRB4/edit?usp=sharing)

---

**FlowBuilder Team**

- M11405103 張梓榆 (CEO)
- M11402802 I Putu Krisna Erlangga (CTO)
- M11405507 陳宇任 (CFO)
