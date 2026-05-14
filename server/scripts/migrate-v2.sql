-- Migration v2: fuel expenses, receipts, push subscriptions, custom rates
-- Run: psql -U postgres -d vehicle_expense_manager -f scripts/migrate-v2.sql

ALTER TABLE trips ADD COLUMN IF NOT EXISTS fuel_expense_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS fuel_liters DECIMAL(8,2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS fuel_type VARCHAR(20);

ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_rate_inr_per_km DECIMAL(8,2);

CREATE TABLE IF NOT EXISTS trip_receipts (
  id SERIAL PRIMARY KEY,
  trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE NOT NULL,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255),
  uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  subscription JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipts_trip ON trip_receipts(trip_id);
