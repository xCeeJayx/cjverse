import dotenv from 'dotenv';
import path from 'node:path';
import { db, users, desc } from '@cjverse/db';
import { EmbedBuilder } from 'discord.js';

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

export function formatMedal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

export type LeaderboardEmbed = EmbedBuilder & {
  category: LeaderboardCategory;
  entries: LeaderboardEntry[];
  totalPlayers: number;
};

export async function handleLeaderboardCommand(
  category: 'rating' | 'crystals' = 'rating'
): Promise<LeaderboardEmbed> {
  const selectedCategory: LeaderboardCategory =
    category?.toLowerCase() === 'crystals' ? 'crystals' : 'rating';

  const orderByColumn =
    selectedCategory === 'crystals' ? desc(users.crystals) : desc(users.rating);

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
    crystals: u.crystals ?? 0,
  }));

  const title = `🏆 CJVerse Leaderboard - ${
    selectedCategory === 'crystals' ? 'Richest Duelists' : 'Top Rated Duelists'
  }`;

  const description =
    entries.length === 0
      ? '*No duelists found on the leaderboard yet.*'
      : entries
          .map((u) => {
            const rankEmoji = formatMedal(u.rank);
            return `**(${rankEmoji}) ${u.username}** — (${u.rating || 1000} MMR | ${u.wins || 0}W - ${u.losses || 0}L | 💎 ${u.crystals || 0})`;
          })
          .join('\n');

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(0xf59e0b);

  Object.assign(embed, {
    category: selectedCategory,
    entries,
    totalPlayers: entries.length,
  });

  return embed as LeaderboardEmbed;
}
