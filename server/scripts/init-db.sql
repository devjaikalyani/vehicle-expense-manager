-- Run once to initialize the Vehicle Expense Manager database
-- psql -U postgres -d vehicle_expense_manager -f scripts/init-db.sql

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'employee' CHECK (role IN ('employee', 'manager', 'admin')),
  employee_code VARCHAR(50),
  phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  registration_number VARCHAR(50) UNIQUE NOT NULL,
  type VARCHAR(20) DEFAULT 'two_wheeler' CHECK (type IN ('two_wheeler', 'four_wheeler', 'other')),
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trips (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES users(id) NOT NULL,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  purpose VARCHAR(255),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  start_odometer DECIMAL(10,2),
  end_odometer DECIMAL(10,2),
  start_lat DECIMAL(10,8),
  start_lng DECIMAL(11,8),
  end_lat DECIMAL(10,8),
  end_lng DECIMAL(11,8),
  start_address VARCHAR(255),
  end_address VARCHAR(255),
  manual_distance_km DECIMAL(10,2),
  gps_distance_km DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'pending', 'approved', 'rejected')),
  expense_amount DECIMAL(10,2),
  manager_notes VARCHAR(500),
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gps_tracks (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  speed DECIMAL(6,2) DEFAULT 0,
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trips_employee ON trips(employee_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_gps_tracks_trip ON gps_tracks(trip_id);
