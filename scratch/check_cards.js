const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
const postgres = require('postgres');

const url = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/postgres';
const sql = postgres(url);

async function check() {
  try {
    const rows = await sql`SELECT id, race, variant, element, level FROM cards LIMIT 10`;
    console.log('Cards:', rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sql.end();
  }
}
check();
