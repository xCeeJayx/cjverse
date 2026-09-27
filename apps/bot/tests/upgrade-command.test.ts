// apps/bot/tests/upgrade-command.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleUpgradeCommand } from '../src/commands/upgrade';
import { db, users, cards, eq } from '@cjverse/db';

describe('Discord Bot /upgrade Command Handler', () => {
  beforeEach(async () => {
    // Clean test users and cards
    try {
      await db.delete(cards).where(eq(cards.userId, 'test-upgrader-1'));
      await db.delete(users).where(eq(users.id, 'test-upgrader-1'));
    } catch {}
  });

  it('rejects upgrade when card is not found', async () => {
    // Create user with plenty of crystals
    await db.insert(users).values({
      id: 'test-upgrader-1',
      username: 'TestUpgrader',
      crystals: 500,
    });

    await db.insert(cards).values({
      userId: 'test-upgrader-1',
      race: 'human',
      variant: 'normal',
      element: 'earth',
      elementTier: 'C',
      evolutionStage: 1,
      level: 1,
      powerScore: 80,
      seed: 99999,
    });

    const result = await handleUpgradeCommand('test-upgrader-1', 'NONEXISTENT');
    expect(result.success).toBe(false);
    expect(result.error).toBe(
      'Card NONEXISTENT was not found in your inventory. Use /inventory to view your 6-character card IDs.'
    );
  });

  it('rejects upgrade when user has insufficient crystals', async () => {
    await db.insert(users).values({
      id: 'test-upgrader-1',
      username: 'TestUpgrader',
      crystals: 10, // not enough for level 1 (needs 25)
    });

    const [card] = await db
      .insert(cards)
      .values({
        userId: 'test-upgrader-1',
        race: 'dragon',
        variant: 'normal',
        element: 'fire',
        elementTier: 'A',
        evolutionStage: 1,
        level: 1,
        powerScore: 100,
        seed: 12345,
      })
      .returning();

    expect(card.id).toHaveLength(6);
    expect(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/.test(card.id)).toBe(true);
    expect(card.id).not.toContain('#');

    const result = await handleUpgradeCommand('test-upgrader-1', card.id);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Insufficient crystals');
    expect(result.error).toContain('25 crystals');
  });

  it('upgrades card level by 1, deducts crystals, and recalculates power score', async () => {
    await db.insert(users).values({
      id: 'test-upgrader-1',
      username: 'TestUpgrader',
      crystals: 200,
    });

    const [card] = await db
      .insert(cards)
      .values({
        userId: 'test-upgrader-1',
        race: 'elf',
        variant: 'silver',
        element: 'void',
        elementTier: 'S',
        evolutionStage: 1,
        level: 2,
        powerScore: 250,
        seed: 54321,
      })
      .returning();

    expect(card.id).toHaveLength(6);

    // Cost for level 2 = 2 * 25 = 50 crystals, test with accidental '#' prefix and lowercase
    const result = await handleUpgradeCommand('test-upgrader-1', `#${card.id.toLowerCase()}`);
    expect(result.success).toBe(true);
    expect(result.oldLevel).toBe(2);
    expect(result.newLevel).toBe(3);
    expect(result.cost).toBe(50);
    expect(result.remainingCrystals).toBe(150);
    expect(result.newPowerScore).toBeGreaterThan(result.oldPowerScore!);

    // Verify DB update
    const [updatedUser] = await db
      .select({ crystals: users.crystals })
      .from(users)
      .where(eq(users.id, 'test-upgrader-1'));
    expect(updatedUser.crystals).toBe(150);

    const [updatedCard] = await db
      .select()
      .from(cards)
      .where(eq(cards.id, card.id));
    expect(updatedCard.level).toBe(3);
    expect(updatedCard.powerScore).toBe(result.newPowerScore);
  });
});
