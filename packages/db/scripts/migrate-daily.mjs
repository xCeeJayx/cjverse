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
  console.log('Running daily rewards and quests schema migration...');

  await sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS last_daily_claim TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS daily_streak INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS daily_quests JSONB NOT NULL DEFAULT '{
      "lastResetDate": "2026-09-28",
      "quests": [
        { "id": "hunt_cards", "title": "Hunt 2 Cards", "current": 0, "target": 2, "reward": 50, "completed": false, "claimed": false },
        { "id": "win_duel", "title": "Win 1 Arena Duel", "current": 0, "target": 1, "reward": 75, "completed": false, "claimed": false },
        { "id": "upgrade_card", "title": "Upgrade Any Card", "current": 0, "target": 1, "reward": 60, "completed": false, "claimed": false }
      ]
    }'::jsonb;
  `;

  console.log('Daily rewards and quests migration completed successfully.');
  await sql.end();
}

main().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
