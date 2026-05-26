# Employee Vehicle Manager (EVM)

A full-stack monorepo for tracking employee vehicle trips, GPS routes, and total distance traveled. Field employees log trips via an installable mobile PWA; managers view and analyze trips from an admin dashboard with live GPS tracking.

---

## Features

### Mobile PWA — EVM Field (served at `/m/`)

- Installable PWA — add to home screen on Android/iOS
- First-time onboarding wizard (7 steps):
  - Welcome screen
  - Location permission grant
  - Battery optimization settings with bilingual (English + Hindi) step-by-step instructions
  - Upload proof screenshots of battery settings
  - Notification permission grant
  - Background tracking verification screen
  - Setup complete confirmation
- Start trip: enter start odometer, select vehicle, enter purpose/destination
- End trip: enter end odometer, upload up to 6 receipt photos or PDFs
- Live GPS tracking with distance accumulation during active trips
- Real-time location broadcast to admin via Socket.IO
- Screen Wake Lock during active trips — prevents auto-lock so GPS continues while driving
- Trip history and detail view showing route, distance, and locations
- Distance traveled is the primary metric shown throughout the app
- Push notifications for manager feedback
- Offline-resilient GPS queue — breadcrumbs queued locally and flushed when network restores

### Admin Dashboard (served at `/`)

- View all employee trips with search by employee or purpose
- Manage employees (add, edit) and vehicles (add, assign, delete)
- Analytics: monthly distance trend chart, top travelers by km, KPI cards — 3M / 6M / 12M range toggle
- Export per-employee trip summary as Excel (XLSX) from the Reports tab
- Live map with employee sidebar — avatar markers, color-coded speed badges, time-ago updates, click to fly to marker
- Field Status tab: employee card view with monthly trip count, monthly km, and last trip
- Compliance tab: flags missing odometer readings and missing trip purpose
- Trip Timeline: select any employee and date, view ordered trip list and GPS route on map (OSRM road-matched)
- Teams tab: create teams, assign employees for department grouping
- Download monthly PDF trip reports

### Authentication

- Email and password login; session stored in httpOnly cookie (`evm_token`, 7-day expiry)
- Forgot Password: request OTP by email, verify, set new password
- Set Up Account: new employees self-register via OTP — no admin pre-creation required

---

## Tech Stack

| Layer | Technology |
|---|---|
| Admin Frontend | React 18, Vite, React Router 6, Leaflet.js, Recharts, Socket.IO client, Axios |
| Mobile PWA | React 18, Vite, React Router 6, Leaflet.js, Vite Plugin PWA (Workbox injectManifest) |
| Backend | Node.js, Express 4, Socket.IO 4 |
| Database | PostgreSQL |
| Auth | JWT (jsonwebtoken), bcryptjs, httpOnly cookies |
| Email (OTP) | Zoho Mail REST API (OAuth2 refresh token) |
| File uploads | Multer |
| PDF reports | PDFKit |
| Push notifications | Web Push (VAPID) |
| Map tiles | CartoDB Voyager (no API key required) |
| Route matching | OSRM public API (road-snapping GPS traces in Trip Timeline) |

---

## Project Structure

```
Vehicle expense Manager/
├── client-admin/            # React + Vite admin dashboard
│   └── src/
│       ├── pages/           # Login, ManagerDashboard, LiveMap, TripTimeline,
│       │                    # TripHistory, ActiveTrip, EmployeeDashboard, Profile
│       ├── components/      # Navbar, BottomNav
│       └── contexts/        # AuthContext
├── client-mobile/           # React + Vite mobile PWA (EVM Field) — served at /m/
│   └── src/
│       ├── pages/           # Login, Onboarding, Home, StartTrip, EndTrip,
│       │                    # History, TripDetail, Dashboard, Profile
│       ├── components/      # BottomNav, OdometerScanner, ErrorBoundary
│       ├── api.js           # Typed API client (fetch + cookie auth)
│       ├── compress.js      # Client-side image compression before upload
│       ├── geolocation.js   # getCurrentPosition wrapper
│       ├── gpsQueue.js      # Offline-resilient GPS breadcrumb queue
│       └── useGpsTracking.js # Custom hook: GPS tracking + Socket.IO emit + live km
├── server/                  # Express backend
│   ├── routes/              # auth, trips, gps, employees, receipts, reports, push
│   ├── scripts/             # init-db.sql, migrate-v2.sql, migrate-teams.sql,
│   │                        # seed.js, gen-vapid.js, get-zoho-token.js
│   ├── middleware/          # JWT auth middleware
│   ├── mobile-dist/         # Built mobile PWA output (gitignored, served at /m/)
│   ├── uploads/             # Receipt files (gitignored)
│   ├── db.js                # PostgreSQL connection pool
│   └── index.js             # Server entry point (HTTPS if .pem certs present)
├── 192.168.10.215+2.pem     # Local TLS certificate (gitignored)
├── 192.168.10.215+2-key.pem # Local TLS private key (gitignored)
├── start.bat                # One-click dev startup (all three services)
└── package.json             # Root: concurrently runs all dev servers
```

---

## Setup

### 1. Database

```bash
createdb vehicle_expense_manager
psql -U postgres -d vehicle_expense_manager -f server/scripts/init-db.sql
psql -U postgres -d vehicle_expense_manager -f server/scripts/migrate-v2.sql
psql -U postgres -d vehicle_expense_manager -f server/scripts/migrate-teams.sql
```

### 2. Environment

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/vehicle_expense_manager
JWT_SECRET=your-random-64-char-secret
PORT=3001
CLIENT_URL=https://192.168.YOUR.IP:3001,http://localhost:5173

# Push notifications — generate with: node server/scripts/gen-vapid.js
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=admin@yourdomain.com

# Zoho Mail REST API (see Zoho Mail Setup below)
SMTP_USER=you@yourdomain.com
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REFRESH_TOKEN=
```

### 3. Zoho Mail Setup (one-time)

1. Go to [https://api-console.zoho.in](https://api-console.zoho.in) and open your **Self Client** app
2. Copy **Client ID** and **Client Secret** into `server/.env`
3. In the Self Client click **Generate Code**:
   - Scope: `ZohoMail.messages.CREATE,ZohoMail.accounts.READ`
   - Duration: 10 minutes
4. Run immediately (code expires in 10 minutes):
   ```bash
   cd server
   node scripts/get-zoho-token.js <paste-code-here>
   ```
5. Copy the printed `ZOHO_REFRESH_TOKEN=...` line into `server/.env`

The refresh token does not expire — one-time setup only.

### 4. Install dependencies

```bash
npm install
```

Installs dependencies for root, server, and both clients in one step.

### 5. Seed the admin account

```bash
cd server
node scripts/seed.js
```

Creates the default admin/manager account. Check `server/scripts/seed.js` for the default credentials.

### 6. Push notifications (optional)

```bash
node server/scripts/gen-vapid.js
```

Copy the two printed keys into `server/.env` as `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`, then restart the server.

### 7. HTTPS for local network access

The mobile PWA requires HTTPS for camera and GPS. Generate a local certificate with [mkcert](https://github.com/FiloSottile/mkcert):

```bash
mkcert 192.168.YOUR.IP localhost 127.0.0.1
```

Place the generated `.pem` files in the project root. Both the Vite dev servers and the Express server detect and use them automatically.

---

## Running

### Development

```bash
npm run dev
```

Starts all three services concurrently:
- Backend on port `3001`
- Admin frontend on port `5175`
- Mobile PWA on port `5174`

Or use `start.bat` on Windows as a shortcut.

Open `http://localhost:5175` for the admin panel.
Open `https://192.168.YOUR.IP:5174/m/` on a phone for the mobile PWA.

### Production

Build both clients:

```bash
cd client-mobile && npm run build
cd ../client-admin && npm run build
```

Mobile output goes to `server/mobile-dist/` (served at `/m/`).
Admin output goes to `client-admin/dist/` (served at `/`).

Start the server:

```bash
cd server
npm start
```

---

## Mobile PWA — EVM Field

### Installing on Android

1. Open `https://your-server-ip/m/` in Chrome
2. Tap the browser menu > **Add to Home Screen**
3. Launch EVM Field from the home screen icon

### Battery optimization (required for GPS)

For continuous GPS tracking the app must be excluded from battery optimization. The onboarding wizard guides users through this with bilingual (English + Hindi) instructions:

1. Settings → search "Battery" → Power Saving Mode → disable
2. Long-press the EVM Field icon → App Info → Battery Usage → Unrestricted

---

## User Roles

| Role | Access |
|---|---|
| `employee` | Own trips, profile, push subscriptions |
| `manager` | All trips, employees, vehicles, live map, reports |
| `admin` | Same as manager |

Employees self-register via "Set Up Account" on the login page. Role defaults to `employee`. Promote to `manager` via a direct DB update or the admin interface.

---

## API Reference

### Auth — `/api/auth`

| Method | Path | Description |
|---|---|---|
| POST | `/login` | Email + password login; sets `evm_token` httpOnly cookie |
| POST | `/logout` | Clears the session cookie |
| POST | `/send-otp` | Send 6-digit OTP to email (10-min expiry, rate-limited) |
| POST | `/verify-otp` | Verify OTP, returns short-lived reset token |
| POST | `/reset-password` | Set new password or create account if new user |
| GET | `/me` | Get current user profile |
| PATCH | `/profile` | Update name and phone |
| PATCH | `/password` | Change password (no current password required) |

### Trips — `/api/trips`

| Method | Path | Description |
|---|---|---|
| POST | `/start` | Start a new trip |
| POST | `/end/:id` | End trip and submit |
| GET | `/active` | Get employee's currently active trip |
| GET | `/:id` | Get a single trip by ID |
| GET | `/` | List trips; supports `?employee_id` and `?date` filters |
| PATCH | `/:id/approve` | Approve a trip (manager) |
| PATCH | `/:id/reject` | Reject a trip with notes (manager) |
| PATCH | `/bulk-action` | Approve or reject up to 100 pending trips at once (manager) |

### GPS — `/api/gps`

| Method | Path | Description |
|---|---|---|
| POST | `/track` | Log GPS coordinate for active trip + broadcast via Socket.IO |
| GET | `/trip/:tripId` | Get all GPS points for a trip |

### Employees & Vehicles — `/api/employees`

| Method | Path | Description |
|---|---|---|
| GET | `/` | List all employees (manager) |
| POST | `/` | Create employee (manager) |
| GET | `/vehicles` | List vehicles |
| POST | `/vehicles` | Add vehicle (manager) |
| DELETE | `/vehicles/:id` | Remove vehicle (manager) |
| GET | `/teams` | List teams with members (manager) |
| POST | `/teams` | Create a team (manager) |
| DELETE | `/teams/:id` | Delete a team (manager) |
| PATCH | `/:id/team` | Assign or remove employee from a team (manager) |

### Receipts — `/api/receipts`

| Method | Path | Description |
|---|---|---|
| POST | `/:tripId` | Upload receipts (max 6, 8 MB each, images + PDF) |
| GET | `/:tripId` | Get receipts for a trip |
| DELETE | `/:tripId/:receiptId` | Delete a receipt |

### Reports — `/api/reports`

| Method | Path | Description |
|---|---|---|
| GET | `/monthly?year=YYYY&month=MM` | Download monthly PDF trip report (manager) |

### Push — `/api/push`

| Method | Path | Description |
|---|---|---|
| GET | `/vapid-public-key` | Get public VAPID key |
| POST | `/subscribe` | Subscribe device for push notifications |
| DELETE | `/subscribe` | Unsubscribe device |

---

## Real-Time Events (Socket.IO)

| Event | Direction | Description |
|---|---|---|
| `gps:update` | Mobile → Server → Admin | Mobile emits live GPS coordinate; server broadcasts to admin live map |
| `gps:stop` | Mobile → Server | Trip ended; remove employee from live map |
| `gps:locations` | Server → Admin | Full active-locations snapshot sent on admin connection |
