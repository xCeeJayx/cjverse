// apps/bot/tests/equip-command.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCards, mockState } = vi.hoisted(() => {
  return {
    mockCards: [
      {
        id: 'AABB22',
        userId: 'user-equip-test',
        race: 'dragon',
        variant: 'gold',
        element: 'fire',
        elementTier: 'A',
        evolutionStage: 1,
        level: 1,
        powerScore: 850,
        seed: 1234,
      },
      {
        id: 'CCDD33',
        userId: 'user-equip-test',
        race: 'elf',
        variant: 'silver',
        element: 'water',
        elementTier: 'B',
        evolutionStage: 1,
        level: 1,
        powerScore: 650,
        seed: 5678,
      },
    ],
    mockState: {
      mockUserLineup: {
        vanguardCardId: null as string | null,
        strikerCardId: null as string | null,
        conduitCardId: null as string | null,
      },
      mockCardsList: [] as any[],
    },
  };
});

vi.mock('@cjverse/db', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    db: {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation((table) => ({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'user-equip-test',
                username: 'EquipTester',
                crystals: 100,
                activeLineup: mockState.mockUserLineup,
              },
            ]),
            then: (resolve: any) => resolve(mockState.mockCardsList),
            [Symbol.iterator]: function* () {
              yield* mockState.mockCardsList;
            },
          })),
        })),
      })),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((updates) => {
          if (updates.activeLineup) {
            mockState.mockUserLineup = { ...updates.activeLineup };
          }
          return {
            where: vi.fn().mockResolvedValue([]),
          };
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: 'user-equip-test',
              username: 'EquipTester',
              crystals: 100,
              activeLineup: mockState.mockUserLineup,
            },
          ]),
        }),
      }),
    },
  };
});

// Import after vi.mock
import { handleEquipCommand } from '../src/commands/equip';
import { db } from '@cjverse/db';

describe('Discord Bot /equip Command Handler', () => {
  beforeEach(() => {
    mockState.mockUserLineup = {
      vanguardCardId: null,
      strikerCardId: null,
      conduitCardId: null,
    };
    mockState.mockCardsList = [...mockCards];
    vi.clearAllMocks();
  });

  it('rejects invalid slot names', async () => {
    const result = await handleEquipCommand('user-equip-test', 'invalid_slot', 'aabb');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid slot');
  });

  it('rejects when user has no cards in inventory', async () => {
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([
            { id: 'user-equip-test', activeLineup: mockState.mockUserLineup },
          ]),
        }),
      }),
    }).mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce([]),
      }),
    });

    const result = await handleEquipCommand('user-equip-test', 'vanguard', 'aabb');
    expect(result.success).toBe(false);
    expect(result.error).toContain("don't own any cards");
  });

  it('rejects non-existent card prefix when card is not found', async () => {
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([
            { id: 'user-equip-test', activeLineup: mockState.mockUserLineup },
          ]),
        }),
      }),
    }).mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(mockCards),
      }),
    });

    const result = await handleEquipCommand('user-equip-test', 'vanguard', 'zzzz9999');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found in your inventory');
  });

  it('successfully equips card into vanguard slot using prefix matching', async () => {
    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([
            { id: 'user-equip-test', activeLineup: mockState.mockUserLineup },
          ]),
        }),
      }),
    }).mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(mockCards),
      }),
    });

    const result = await handleEquipCommand('user-equip-test', 'vanguard', '#aabb22');
    expect(result.success).toBe(true);
    expect(result.slot).toBe('vanguard');
    expect(result.lineup?.vanguardCardId).toBe('AABB22');
    expect(result.embedData?.vanguardCardName).toContain('DRAGON');
    expect(result.embedData?.vanguardCardName).not.toContain('#');
  });

  it('reassigns cleanly if card is already equipped in another slot', async () => {
    // Initially card is in vanguard
    mockState.mockUserLineup = {
      vanguardCardId: 'AABB22',
      strikerCardId: null,
      conduitCardId: null,
    };

    (db.select as any).mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce([
            { id: 'user-equip-test', activeLineup: mockState.mockUserLineup },
          ]),
        }),
      }),
    }).mockReturnValueOnce({
      from: vi.fn().mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce(mockCards),
      }),
    });

    // Equip the same dragon into striker slot with prefix and without hashtag
    const result = await handleEquipCommand('user-equip-test', 'striker', 'aabb22');
    expect(result.success).toBe(true);
    expect(result.slot).toBe('striker');
    // Vanguard should now be cleared, striker should have the dragon
    expect(result.lineup?.vanguardCardId).toBeNull();
    expect(result.lineup?.strikerCardId).toBe('AABB22');
  });
});
