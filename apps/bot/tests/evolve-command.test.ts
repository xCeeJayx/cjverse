// apps/bot/tests/evolve-command.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { handleEvolveCommand } from '../src/commands/evolve';
import { db, users, cards, eq } from '@cjverse/db';

describe('Discord Bot /evolve Command Handler', () => {
  beforeEach(async () => {
    try {
      await db.delete(cards).where(eq(cards.userId, 'test-evolver-1'));
      await db.delete(users).where(eq(users.id, 'test-evolver-1'));
    } catch {}
  });

  it('rejects evolution when card level is below required threshold', async () => {
    await db.insert(users).values({
      id: 'test-evolver-1',
      username: 'TestEvolver',
      crystals: 500,
    });

    const [card] = await db
      .insert(cards)
      .values({
        userId: 'test-evolver-1',
        race: 'dragon',
        variant: 'normal',
        element: 'fire',
        elementTier: 'A',
        evolutionStage: 1,
        level: 5, // Requires 10 for Ascended
        powerScore: 200,
        seed: 11111,
      })
      .returning();

    const result = await handleEvolveCommand('test-evolver-1', card.id);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Level 10');
  });

  it('rejects evolution when user lacks 200 crystals', async () => {
    await db.insert(users).values({
      id: 'test-evolver-1',
      username: 'TestEvolver',
      crystals: 150, // needs 200
    });

    const [card] = await db
      .insert(cards)
      .values({
        userId: 'test-evolver-1',
        race: 'dragon',
        variant: 'gold',
        element: 'cosmic',
        elementTier: 'S',
        evolutionStage: 1,
        level: 10,
        powerScore: 600,
        seed: 22222,
      })
      .returning();

    const result = await handleEvolveCommand('test-evolver-1', card.id);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Insufficient crystals');
    expect(result.error).toContain('200 crystals');
  });

  it('evolves card from Base (Stage 1) to Ascended (Stage 2) at Level 10', async () => {
    await db.insert(users).values({
      id: 'test-evolver-1',
      username: 'TestEvolver',
      crystals: 300,
    });

    const [card] = await db
      .insert(cards)
      .values({
        userId: 'test-evolver-1',
        race: 'elf',
        variant: 'rainbow',
        element: 'void',
        elementTier: 'S',
        evolutionStage: 1,
        level: 10,
        powerScore: 700,
        seed: 33333,
      })
      .returning();

    expect(card.id).toHaveLength(6);
    expect(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/.test(card.id)).toBe(true);
    expect(card.id).not.toContain('#');

    // Test with hashtag prefix and lowercase
    const result = await handleEvolveCommand('test-evolver-1', `#${card.id.toLowerCase()}`);
    expect(result.success).toBe(true);
    expect(result.oldStage).toBe(1);
    expect(result.newStage).toBe(2);
    expect(result.oldStageName).toBe('Base');
    expect(result.newStageName).toBe('Ascended');
    expect(result.cost).toBe(200);
    expect(result.remainingCrystals).toBe(100);
    expect(result.newPowerScore).toBeGreaterThan(result.oldPowerScore!);
    expect(result.imageBuffer).toBeDefined();

    // Verify DB
    const [updatedUser] = await db
      .select({ crystals: users.crystals })
      .from(users)
      .where(eq(users.id, 'test-evolver-1'));
    expect(updatedUser.crystals).toBe(100);

    const [updatedCard] = await db
      .select()
      .from(cards)
      .where(eq(cards.id, card.id));
    expect(updatedCard.evolutionStage).toBe(2);
    expect(updatedCard.powerScore).toBe(result.newPowerScore);
  });

  it('evolves card from Ascended (Stage 2) to Transcendent (Stage 3) at Level 20', async () => {
    await db.insert(users).values({
      id: 'test-evolver-1',
      username: 'TestEvolver',
      crystals: 500,
    });

    const [card] = await db
      .insert(cards)
      .values({
        userId: 'test-evolver-1',
        race: 'dwarf',
        variant: 'diamond',
        element: 'metal',
        elementTier: 'B',
        evolutionStage: 2,
        level: 20,
        powerScore: 1200,
        seed: 44444,
      })
      .returning();

    const result = await handleEvolveCommand('test-evolver-1', card.id);
    expect(result.success).toBe(true);
    expect(result.oldStage).toBe(2);
    expect(result.newStage).toBe(3);
    expect(result.newStageName).toBe('Transcendent');
    expect(result.remainingCrystals).toBe(300);

    // Verify cannot evolve past Stage 3
    const maxResult = await handleEvolveCommand('test-evolver-1', card.id);
    expect(maxResult.success).toBe(false);
    expect(maxResult.error).toContain('maximum evolution');
  });

  it('rejects evolution when card is not found with standardized 6-character error', async () => {
    await db.insert(users).values({
      id: 'test-evolver-1',
      username: 'TestEvolver',
      crystals: 500,
    });
    await db.insert(cards).values({
      userId: 'test-evolver-1',
      race: 'human',
      variant: 'normal',
      element: 'earth',
      elementTier: 'C',
      evolutionStage: 1,
      level: 10,
      powerScore: 100,
      seed: 99999,
    });

    const result = await handleEvolveCommand('test-evolver-1', '#MISSING');
    expect(result.success).toBe(false);
    expect(result.error).toBe(
      'Card MISSING was not found in your inventory. Use /inventory to view your 6-character card IDs.'
    );
  });
});
