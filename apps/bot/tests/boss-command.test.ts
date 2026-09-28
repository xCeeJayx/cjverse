import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  handleBossStatusCommand,
  handleBossFightCommand,
  handleBossSpawnCommand,
} from '../src/commands/boss';
import { handleInteraction } from '../src';
import {
  ensureUser,
  spawnWorldBoss,
  db,
  users,
  cards,
  eq,
} from '@cjverse/db';

describe('Discord Bot /boss Command Handlers (apps/bot)', () => {
  const testUserId = 'test-boss-bot-user';

  beforeEach(async () => {
    await ensureUser(testUserId, 'RaidMaster');
  });

  it('renders active boss status with visual HP bar and element weakness', async () => {
    const boss = await spawnWorldBoss('Infernal Behemoth', 'fire', 500000);
    const result = await handleBossStatusCommand(boss.id);

    expect(result.success).toBe(true);
    expect(result.embed).toBeDefined();

    const data = result.embed.toJSON();
    expect(data.title).toContain('Infernal Behemoth');
    expect(data.description).toContain('FIRE');
    expect(data.description).toContain('Water, ❄️ Ice');
    expect(data.description).toContain('100.0%');
  }, 15000);

  it('rejects /boss fight if user lacks full 3-card lineup', async () => {
    const boss = await spawnWorldBoss('Abyssal Leviathan', 'void', 300000);

    // Ensure empty lineup
    await db
      .update(users)
      .set({ activeLineup: { vanguardCardId: null, strikerCardId: null, conduitCardId: null } })
      .where(eq(users.id, testUserId));

    const result = await handleBossFightCommand(testUserId, boss.id);
    expect(result.success).toBe(false);
    expect(result.message).toContain('equipped before entering');
  }, 15000);

  it('provides live raid link when user has complete lineup', async () => {
    const boss = await spawnWorldBoss('Glacial Titan', 'ice', 400000);

    // Equip 3 cards
    const [c1] = await db
      .insert(cards)
      .values({
        userId: testUserId,
        race: 'orc',
        variant: 'gold',
        element: 'fire',
        elementTier: 'A',
        powerScore: 300,
        seed: 201,
      })
      .returning();

    const [c2] = await db
      .insert(cards)
      .values({
        userId: testUserId,
        race: 'elf',
        variant: 'silver',
        element: 'lightning',
        elementTier: 'A',
        powerScore: 280,
        seed: 202,
      })
      .returning();

    const [c3] = await db
      .insert(cards)
      .values({
        userId: testUserId,
        race: 'undead',
        variant: 'normal',
        element: 'arcane',
        elementTier: 'S',
        powerScore: 260,
        seed: 203,
      })
      .returning();

    await db
      .update(users)
      .set({
        activeLineup: {
          vanguardCardId: c1.id,
          strikerCardId: c2.id,
          conduitCardId: c3.id,
        },
      })
      .where(eq(users.id, testUserId));

    const result = await handleBossFightCommand(testUserId, boss.id);
    expect(result.success).toBe(true);
    expect(result.embed).toBeDefined();
    expect(result.components).toBeDefined();

    const button = (result.components![0].toJSON() as any).components[0];
    expect(button.url).toContain(`/boss/${boss.id}`);
  }, 20000);

  it('spawns a new World Boss via /boss spawn', async () => {
    const result = await handleBossSpawnCommand(testUserId, 'Storm Tempest');
    expect(result.success).toBe(true);
    expect(result.embed).toBeDefined();

    const data = result.embed!.toJSON();
    expect(data.title).toContain('A New World Boss Has Awakened');
    expect(data.description).toContain('Storm Tempest');
    expect(data.description).toContain('LIGHTNING');
  }, 15000);

  it('routes /boss interaction via interaction gateway', async () => {
    const mockInteraction: any = {
      commandName: 'boss',
      user: { id: testUserId, username: 'RaidMaster' },
      options: {
        getSubcommand: vi.fn().mockReturnValue('status'),
        getString: vi.fn(),
      },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
    };

    await handleInteraction(mockInteraction);

    expect(mockInteraction.deferReply).toHaveBeenCalled();
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.any(Array),
      })
    );
  }, 15000);
});
