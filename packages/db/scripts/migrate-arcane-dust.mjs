import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const sql = postgres(connectionString);

async function main() {
  console.log('Running arcane_dust migration on users table...');

  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS arcane_dust INTEGER NOT NULL DEFAULT 0;
  `;

  console.log('Arcane dust migration completed successfully.');
  await sql.end();
}

main().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
