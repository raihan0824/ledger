# Finance Dashboard

A professional financial dashboard built with React, Express.js, and PostgreSQL. Features rolling budgets aligned with your paycheck cycle, transaction management, CSV import, and beautiful charts.

![Dashboard](https://via.placeholder.com/800x400?text=Finance+Dashboard)

## ✨ Features

- **📊 Dashboard Overview** - Income vs expenses, spending trends, category breakdown
- **💰 Budget Management** - Rolling budgets based on your paycheck day (25th-28th)
- **📝 Transaction Management** - Full CRUD with filters, pagination, and search
- **📤 CSV Import** - Bulk import transactions from bank exports
- **🌙 Dark Mode** - Professional dark/light theme support
- **🔐 Authentication** - Simple JWT-based login with auto-created admin user
- **📱 Responsive** - Works on desktop, tablet, and mobile

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, Tailwind CSS, shadcn/ui |
| Charts | Recharts |
| Backend | Express.js, Node.js |
| Database | PostgreSQL |
| Auth | JWT + bcrypt |
| Deployment | Docker, Kubernetes |

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Docker (optional)

### Local Development

1. **Clone and install dependencies:**

```bash
cd finance-dashboard
npm install
```

2. **Set up the database:**

Run the DDL from `EXTRA_TABLES.MD` to create the required tables (users, settings, budgets, import_batches).

3. **Configure environment:**

```bash
cp packages/backend/.env.example packages/backend/.env
# Edit .env with your database credentials
```

4. **Start development servers:**

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

5. **Login with default credentials:**
   - Username: `admin`
   - Password: `admin123`
   
   ⚠️ Change the password after first login!

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# Access the dashboard
open http://localhost:8080
```

### Kubernetes Deployment

```bash
# Update secrets in k8s/secret.yaml with your values

# Deploy to cluster
cd k8s
chmod +x deploy.sh
./deploy.sh

# Port forward to access locally
kubectl -n finance-dashboard port-forward svc/frontend-service 8080:8080
```

## 📁 Project Structure

```
finance-dashboard/
├── packages/
│   ├── frontend/          # React app
│   │   ├── src/
│   │   │   ├── components/  # UI components
│   │   │   ├── pages/       # Page components
│   │   │   ├── context/     # React contexts
│   │   │   └── lib/         # Utilities & API
│   │   └── Dockerfile
│   └── backend/           # Express API
│       ├── src/
│       │   ├── routes/      # API routes
│       │   ├── middleware/  # Auth middleware
│       │   └── db/          # Database setup
│       └── Dockerfile
├── k8s/                   # Kubernetes manifests
├── docker-compose.yml
└── EXTRA_TABLES.MD        # Database DDL
```

## 📋 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | User login |
| `/api/auth/logout` | POST | User logout |
| `/api/auth/me` | GET | Get current user |
| `/api/transactions` | GET/POST | List/create transactions |
| `/api/transactions/:id` | GET/PUT/DELETE | CRUD transaction |
| `/api/categories` | GET/POST | List/create categories |
| `/api/budgets` | GET/POST | List/create budgets |
| `/api/budgets/summary` | GET | Budget vs actual summary |
| `/api/settings` | GET/PUT | User settings |
| `/api/import/preview` | POST | Preview CSV import |
| `/api/import/commit` | POST | Execute CSV import |
| `/api/analytics/overview` | GET | Dashboard analytics |

## 🔧 Configuration

### Budget Cycle

Configure your paycheck day in Settings. The budget period will automatically adjust:

- **Day 25**: Budget runs 25th → 24th of next month
- **Day 28**: Budget runs 28th → 27th of next month

### CSV Import Format

Supported columns (case-insensitive):
- `date`, `datetime`, `tanggal` (required)
- `amount`, `nominal`, `jumlah` (required)
- `merchant`, `description`, `keterangan`
- `kind`, `type` (debit/credit)
- `category`, `kategori`
- `channel`, `bank`

## 🔒 Security

- Containers run as non-root user (uid 1000)
- Read-only root filesystem in Kubernetes
- Dropped Linux capabilities
- JWT stored in httpOnly cookies
- Password hashing with bcrypt (10 rounds)

## 📄 License

MIT
