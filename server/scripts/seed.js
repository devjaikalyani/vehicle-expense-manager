// Creates the default admin account
// Usage: node scripts/seed.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const db = require('../db');

async function seed() {
  const hash = await bcrypt.hash('Dev@2026#', 10);
  await db.query(
    `INSERT INTO users (name, email, password_hash, role, employee_code)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role`,
    ['Dev Jaikalyani', 'devjaikalyani@ritewater.in', hash, 'admin', 'RWS-ADMIN']
  );
  console.log('Done. Login: devjaikalyani@ritewater.in / Dev@2026#');
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
