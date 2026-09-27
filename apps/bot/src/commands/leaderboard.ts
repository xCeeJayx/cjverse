import dotenv from 'dotenv';
import path from 'node:path';
import { db, users, desc } from '@cjverse/db';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export type LeaderboardCategory = 'rating' | 'crystals';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  crystals: number;
}

export interface LeaderboardResult {
  category: LeaderboardCategory;
  entries: LeaderboardEntry[];
  totalPlayers: number;
}

export function formatMedal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `**#${rank}**`;
}

export async function handleLeaderboardCommand(
  categoryParam?: string
): Promise<LeaderboardResult> {
  const category: LeaderboardCategory =
    categoryParam?.toLowerCase() === 'crystals' ? 'crystals' : 'rating';

  const orderByColumn = category === 'crystals' ? desc(users.crystals) : desc(users.rating);

  const topUsers = await db
    .select({
      id: users.id,
      username: users.username,
      rating: users.rating,
      wins: users.wins,
      losses: users.losses,
      crystals: users.crystals,
    })
    .from(users)
    .orderBy(orderByColumn)
    .limit(10);

  const entries: LeaderboardEntry[] = topUsers.map((u, idx) => ({
    rank: idx + 1,
    userId: u.id,
    username: u.username,
    rating: u.rating ?? 1000,
    wins: u.wins ?? 0,
    losses: u.losses ?? 0,
    crystals: u.crystals ?? 100,
  }));

  return {
    category,
    entries,
    totalPlayers: entries.length,
  };
}
