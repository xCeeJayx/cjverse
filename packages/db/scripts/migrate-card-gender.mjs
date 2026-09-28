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
  console.log('Running gender column migration on cards table...');

  await sql`
    ALTER TABLE cards
    ADD COLUMN IF NOT EXISTS gender VARCHAR(8) NOT NULL DEFAULT 'male';
  `;

  console.log('Gender column migration completed successfully.');
  await sql.end();
}

main().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
