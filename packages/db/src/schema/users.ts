import { pgTable, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';

export interface UserActiveLineup {
  vanguardCardId: string | null;
  strikerCardId: string | null;
  conduitCardId: string | null;
}

export interface DailyQuestItem {
  id: string; // 'hunt_cards' | 'win_duel' | 'upgrade_card'
  title: string;
  current: number;
  target: number;
  reward: number;
  completed: boolean;
  claimed: boolean;
}

export interface UserDailyQuests {
  lastResetDate: string; // YYYY-MM-DD
  quests: DailyQuestItem[];
}

export function getDefaultDailyQuests(dateStr = new Date().toISOString().slice(0, 10)): UserDailyQuests {
  return {
    lastResetDate: dateStr,
    quests: [
      { id: 'hunt_cards', title: 'Hunt 2 Cards', current: 0, target: 2, reward: 50, completed: false, claimed: false },
      { id: 'win_duel', title: 'Win 1 Arena Duel', current: 0, target: 1, reward: 75, completed: false, claimed: false },
      { id: 'upgrade_card', title: 'Upgrade Any Card', current: 0, target: 1, reward: 60, completed: false, claimed: false },
    ],
  };
}

export const users = pgTable('users', {
  id: text('id').primaryKey(), // Discord Snowflake ID
  username: text('username').notNull(),
  avatarUrl: text('avatar_url'),
  crystals: integer('crystals').default(100).notNull(),
  arcaneDust: integer('arcane_dust').default(0).notNull(),
  rating: integer('rating').default(1000).notNull(),
  wins: integer('wins').default(0).notNull(),
  losses: integer('losses').default(0).notNull(),
  activeLineup: jsonb('active_lineup').$type<UserActiveLineup>().default({
    vanguardCardId: null,
    strikerCardId: null,
    conduitCardId: null
  }).notNull(),
  lastDailyClaim: timestamp('last_daily_claim', { withTimezone: true }),
  dailyStreak: integer('daily_streak').default(0).notNull(),
  dailyQuests: jsonb('daily_quests').$type<UserDailyQuests>().$defaultFn(() => getDefaultDailyQuests()).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});
