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
  console.log('Running world_bosses and boss_contributions schema migration...');

  await sql`
    CREATE TABLE IF NOT EXISTS world_bosses (
      id VARCHAR(16) PRIMARY KEY,
      name VARCHAR(64) NOT NULL,
      element VARCHAR(32) NOT NULL,
      total_hp INTEGER NOT NULL,
      current_hp INTEGER NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'active',
      starts_at TIMESTAMP NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMP
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS boss_contributions (
      id SERIAL PRIMARY KEY,
      boss_id VARCHAR(16) NOT NULL REFERENCES world_bosses(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      total_damage INTEGER NOT NULL DEFAULT 0,
      attempts_count INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  console.log('World Boss migration completed successfully.');
  await sql.end();
}

main().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
