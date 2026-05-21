# Vehicle Expense Manager

A full-stack web and PWA application for tracking employee vehicle trips, GPS routes, and expense reimbursements. Employees log trips with odometer readings, fuel costs, and receipt photos. Managers review, approve or reject claims, and download monthly PDF reports.

---

## Features

**Employee (Desktop Web)**
- Start and end trips with odometer readings, vehicle, and purpose
- Live GPS tracking on an interactive map during active trips
- Active trip banner shows live elapsed time; last used vehicle is remembered
- Log fuel expenses (type, litres, amount) when ending a trip
- Upload up to 6 receipt photos or PDFs per trip
- View trip history with status filters, search by purpose or vehicle, and CSV export
- 6-month spending trend chart (claimed vs approved) on dashboard
- Receive push notifications when claims are approved or rejected
- Self-service account setup and password reset via OTP email

**Employee (Mobile PWA — VEM Field)**
- Installable PWA served at `/m/` — add to home screen on Android/iOS
- First-time onboarding wizard (7 steps):
  - Welcome screen
  - Location permission grant
  - Battery optimization settings (bilingual: English + Hindi step-by-step instructions)
  - Upload proof screenshots of battery settings
  - Notification permission grant
  - Background tracking verification (shows what the active-trip notification should look like)
  - Setup finished confirmation screen
- Odometer scanning: full-screen live camera with corner bracket frame overlay ("Align the digits inside the frame")
- 6-digit split OTP-style odometer entry with auto-advance and paste support
- "Not travelling today?" skip modal with required reason field
- Side-by-side Punch In / Punch Out odometer photo cards in conveyance summary
- Distance travelled shown prominently with "Please update odometer reading if not correct"
- Fuel expense logging (amount, litres, fuel type) on trip end
- Trip history with status badges and detail view
- Live GPS map with blue location dot and elapsed trip timer during active trips

**Manager**
- Review all employee trips with status filters and search by employee or purpose
- Approve or reject individual trips with optional notes
- Bulk approve or reject multiple pending trips at once
- Set custom per-km reimbursement rates per employee
- Manage employees (add, edit rates) and vehicles (add, assign, delete)
- Analytics tab: monthly expense trend, top claimants bar chart, approval status breakdown, KPI cards — with 3M/6M/12M range toggle
- Export per-employee summary as CSV from the Reports tab
- Live map with employee sidebar — avatar markers, color-coded speed badges, time-ago updates, phone numbers; click to fly to marker
- Field Status tab: employee card view with monthly trip count, expense totals, last trip, and pending status
- Compliance tab: flags trips pending over 7 days, missing odometer readings, and missing trip purpose — with inline approve/reject
- Trip Timeline page: select any employee and date, view ordered trip list and GPS route on map
- Teams tab: create teams, assign employees to teams for department grouping
- Download monthly PDF expense reports

**Authentication**
- Email and password login; session token stored in httpOnly cookie (7-day expiry)
- Forgot Password: request OTP by email, verify, set new password
- Set Up Account: new employees register themselves via OTP — no admin pre-creation required

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop Frontend | React 18, Vite, React Router, Leaflet.js, Recharts, Socket.IO client |
| Mobile PWA | React 18, Vite, React Router, Leaflet.js, Vite Plugin PWA (Workbox injectManifest) |
| Backend | Node.js, Express, Socket.IO |
| Database | PostgreSQL |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Email (OTP) | Zoho Mail REST API (OAuth2 refresh token) |
| File uploads | Multer |
| PDF reports | PDFKit |
| Push notifications | Web Push (VAPID) |
| Map tiles | CartoDB Voyager (English labels, no API key) |

---

## Project Structure

```
Vehicle expense Manager/
├── client/                  # React + Vite desktop frontend
│   ├── public/              # PWA icons (icon-192.png, icon-512.png)
│   └── src/
│       ├── pages/           # Login, EmployeeDashboard, ActiveTrip, TripHistory,
│       │                    # ManagerDashboard, LiveMap, TripTimeline, Profile
│       ├── components/      # Navbar, BottomNav
│       └── sw.js            # Service worker (Workbox precaching + push notifications)
├── client-mobile/           # React + Vite mobile PWA (VEM Field) — served at /m/
│   ├── public/              # PWA icons (icon-192.png, icon-512.png)
│   └── src/
│       ├── pages/           # Login, Onboarding, Home, StartTrip, EndTrip,
│       │                    # History, TripDetail, Profile
│       ├── components/      # BottomNav, OdometerScanner
│       ├── api.js           # Typed API client (fetch + cookie auth)
│       ├── compress.js      # Client-side image compression before upload
│       ├── geolocation.js   # getCurrentPosition wrapper
│       ├── gpsQueue.js      # Offline-resilient GPS request queue
│       ├── useGpsTracking.js # Custom hook for background GPS tracking
│       └── sw.js            # Service worker (Workbox precaching + push notifications)
├── server/                  # Express backend
│   ├── routes/              # auth, trips, gps, employees, receipts, reports, push
│   ├── scripts/             # DB setup, seed, VAPID key gen, Zoho token helper
│   ├── middleware/          # JWT authentication
│   ├── mobile-dist/         # Built mobile PWA output (gitignored, served at /m/)
│   ├── uploads/             # Receipt files (gitignored)
│   ├── db.js                # PostgreSQL connection pool
│   └── index.js             # Server entry point
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

Edit `server/.env` with your values:

```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/vehicle_expense_manager
JWT_SECRET=your-random-64-char-secret
PORT=3001
CLIENT_URL=http://localhost:5173

# Email sender address (shown in From field of OTP emails)
SMTP_USER=you@yourdomain.com

# Zoho Mail REST API credentials (see section below for setup)
ZOHO_CLIENT_ID=your-self-client-id
ZOHO_CLIENT_SECRET=your-self-client-secret
ZOHO_REFRESH_TOKEN=your-refresh-token
```

### 3. Zoho Mail Setup (one-time)

The app sends OTP emails via the Zoho Mail REST API. You need a Zoho Self Client app and a refresh token.

1. Go to [https://api-console.zoho.in](https://api-console.zoho.in) and open your **Self Client** app
2. Copy the **Client ID** and **Client Secret** into `server/.env`
3. In the Self Client, click **Generate Code**:
   - Scope: `ZohoMail.messages.CREATE,ZohoMail.accounts.READ`
   - Duration: 10 minutes
   - Click **Create** and copy the code shown
4. Run the helper script immediately (the code expires in 10 minutes):
   ```bash
   cd server
   node scripts/get-zoho-token.js <paste-code-here>
   ```
5. Copy the printed `ZOHO_REFRESH_TOKEN=...` line into `server/.env`

The refresh token does not expire — this is a one-time setup.

### 4. Install dependencies

```bash
npm install
```

This installs dependencies for the root, server, and client in one step.

### 5. Seed the admin account

```bash
cd server
node scripts/seed.js
```

Creates the default admin/manager account. Check `server/scripts/seed.js` for the default credentials.

### 6. (Optional) Enable push notifications

```bash
node server/scripts/gen-vapid.js
```

Copy the two printed keys into `server/.env` as `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`.

### 7. (Optional) HTTPS for mobile PWA development

The mobile PWA requires HTTPS for camera access and GPS. Generate a local certificate with [mkcert](https://github.com/FiloSottile/mkcert):

```bash
mkcert 192.168.YOUR.IP localhost 127.0.0.1
```

Place the generated `.pem` files in the project root. The Vite dev server and Express server both detect and use them automatically.

---

## Running

### Development

```bash
npm run dev
```

Starts the backend on port `3001` and the desktop frontend on port `5173`.

To also run the mobile PWA dev server:

```bash
cd client-mobile
npm run dev
```

Mobile PWA dev server runs on port `5174` (HTTPS if certificates are present).

Open [http://localhost:5173](http://localhost:5173) for the desktop app.
Open [https://192.168.YOUR.IP:5174/m/](https://192.168.YOUR.IP:5174/m/) on your phone for the mobile PWA.

### Production

Build the mobile PWA into the server's static folder:

```bash
cd client-mobile
npm run build
```

The output goes to `server/mobile-dist/` and is served automatically at `/m/` by the Express server.

Build the desktop frontend:

```bash
cd client
npm run build
```

Then start the server:

```bash
cd server
npm start
```

---

## Mobile PWA — VEM Field

VEM Field is the mobile-first PWA for field employees. It is served at `/m/` from the same Express server.

### Installing on Android

1. Open `https://your-server/m/` in Chrome
2. Tap the browser menu > **Add to Home Screen**
3. Launch VEM Field from the home screen icon

### Battery optimization (required for GPS tracking)

For continuous GPS tracking during trips, the app must be excluded from battery optimization:

1. **Settings** > search "Battery" > **Power Saving Mode** > disable "Automatically enter power saving mode"
2. Long press the VEM Field app icon > **App Info** > **Battery Usage** > set to **Unrestricted**

The onboarding wizard guides users through these steps with bilingual (English + Hindi) instructions on first launch.

### Odometer scanning

The Start Trip and End Trip screens open a full-screen live camera with a corner bracket frame for aligning odometer digits. After capturing, readings are entered using a 6-digit split input. If the employee is not travelling, they can skip the scan and provide a reason.

---

## User Roles

| Role | Access |
|---|---|
| `employee` | Own trips, profile, push subscriptions |
| `manager` | All trips, employees, vehicles, live map, reports |
| `admin` | Same as manager (future: admin-only settings) |

Employees can self-register using "Set Up Account" on the login page. Their role is set to `employee` by default. Promote to manager via a direct DB update or the admin interface when available.

---

## Reimbursement Rates

Default rates applied when no custom rate is set for an employee:

| Vehicle Type | Rate |
|---|---|
| Two-wheeler | Rs. 6 / km |
| Four-wheeler | Rs. 12 / km |
| Other | Rs. 8 / km |

Managers can override the rate per employee from the Employees tab in the Manager Dashboard. Setting it back to blank restores the vehicle-type default.

**Distance used for calculation:** Odometer reading (end − start) is preferred. If no end odometer is entered, GPS haversine distance from tracked coordinates is used as fallback.

**Total expense formula:** `(distance km × rate per km) + fuel amount`

---

## API Reference

### Auth — `/api/auth`

| Method | Path | Description |
|---|---|---|
| POST | `/login` | Email + password login; sets `vem_token` httpOnly cookie (7 days) |
| POST | `/logout` | Clears the session cookie |
| POST | `/send-otp` | Send 6-digit OTP to email (10-min expiry, rate-limited to 5 req/15 min) |
| POST | `/verify-otp` | Verify OTP, returns short-lived reset token |
| POST | `/reset-password` | Set new password (or create account if new user) |
| GET | `/me` | Get current user profile |
| PATCH | `/profile` | Update name and phone |
| PATCH | `/password` | Change password (authenticated user, no current password required) |

### Trips — `/api/trips`

| Method | Path | Description |
|---|---|---|
| POST | `/start` | Start a new trip |
| POST | `/end/:id` | End trip and submit for approval |
| GET | `/active` | Get employee's currently active trip |
| GET | `/:id` | Get a single trip by ID (own trip for employees, any trip for managers) |
| GET | `/` | List trips (own for employees, all for managers); supports `?employee_id` and `?date` filters |
| PATCH | `/:id/approve` | Approve a trip (manager) |
| PATCH | `/:id/reject` | Reject a trip with notes (manager) |
| PATCH | `/bulk-action` | Bulk approve or reject trips (manager) |

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
| PATCH | `/:id/rate` | Set custom per-km rate (manager) |
| GET | `/vehicles` | List vehicles |
| POST | `/vehicles` | Add vehicle (manager) |
| DELETE | `/vehicles/:id` | Remove vehicle (manager) |
| GET | `/teams` | List teams with members (manager) |
| POST | `/teams` | Create a team (manager) |
| DELETE | `/teams/:id` | Delete a team (manager) |
| PATCH | `/:id/team` | Assign employee to a team, or null to remove (manager) |

### Receipts — `/api/receipts`

| Method | Path | Description |
|---|---|---|
| POST | `/:tripId` | Upload receipts (max 6, 8 MB each, images + PDF) |
| GET | `/:tripId` | Get receipts for a trip |
| DELETE | `/:tripId/:receiptId` | Delete a receipt |

### Reports — `/api/reports`

| Method | Path | Description |
|---|---|---|
| GET | `/monthly?year=YYYY&month=MM` | Download monthly PDF expense report (manager) |

### Push Notifications — `/api/push`

| Method | Path | Description |
|---|---|---|
| GET | `/vapid-public-key` | Get public VAPID key |
| POST | `/subscribe` | Subscribe device for push notifications |
| DELETE | `/subscribe` | Unsubscribe device |

---

## Real-Time Events (Socket.IO)

| Event | Direction | Description |
|---|---|---|
| `gps:update` | Client → Server | Send new GPS coordinate for active trip |
| `gps:stop` | Client → Server | Signal trip ended, remove from live map |
| `gps:locations` | Server → Clients | Broadcasts full active-locations map on connection |
