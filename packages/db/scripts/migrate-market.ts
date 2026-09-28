import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const sql = postgres(connectionString);

async function main() {
  console.log('Running market and trades schema migration...');

  await sql`
    CREATE TABLE IF NOT EXISTS market_listings (
      id VARCHAR(16) PRIMARY KEY,
      seller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      card_id VARCHAR(16) NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      price INTEGER NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS trades (
      id VARCHAR(16) PRIMARY KEY,
      proposer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      proposer_card_id VARCHAR(16) NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      target_card_id VARCHAR(16) NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;

  console.log('Migration completed successfully.');
  await sql.end();
}

main().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
