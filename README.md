# Vehicle Expense Manager

A web + PWA application for tracking employee vehicle trips and expenses via odometer readings and GPS tracking.

## Features

- Live GPS tracking with real-time map view for managers
- Odometer-based distance and expense calculation
- Fuel expense logging (type, liters, amount)
- Receipt / proof photo uploads
- Trip approval workflow (approve / reject with notes)
- Bulk approve or reject trips
- Monthly expense PDF reports
- Push notifications for claim status updates
- Custom per-km reimbursement rates per employee
- Installable as a mobile PWA

## Tech Stack

- **Frontend:** React, Vite, Leaflet.js, Socket.io client
- **Backend:** Node.js, Express, Socket.io
- **Database:** PostgreSQL
- **Other:** JWT auth, Multer (file uploads), PDFKit (reports), Web Push (notifications)

## Setup

### 1. Database

```bash
createdb vehicle_expense_manager
psql -U postgres -d vehicle_expense_manager -f server/scripts/init-db.sql
psql -U postgres -d vehicle_expense_manager -f server/scripts/migrate-v2.sql
```

### 2. Environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env` and fill in:

```
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/vehicle_expense_manager
JWT_SECRET=your-random-secret
PORT=3001
CLIENT_URL=http://localhost:5173
```

### 3. Install dependencies

```bash
npm install
```

This installs root, server, and client dependencies.

### 4. Seed admin account

```bash
cd server
node scripts/seed.js
```

### 5. (Optional) Enable push notifications

```bash
node server/scripts/gen-vapid.js
```

Copy the output keys into `server/.env`.

## Running

```bash
npm run dev
```

Starts both backend (port 3001) and frontend (port 5173) in a single terminal.

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Default Reimbursement Rates

| Vehicle Type | Rate |
|---|---|
| Two-wheeler | Rs. 6 / km |
| Four-wheeler | Rs. 12 / km |
| Other | Rs. 8 / km |

Rates can be overridden per employee from the Manager dashboard.
