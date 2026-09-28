// apps/bot/tests/deploy-commands.test.ts
import { describe, it, expect } from 'vitest';
import { commands } from '../src/deploy-commands';

describe('Discord Slash Command Deployment Definitions', () => {
  it('defines /hunt command correctly', () => {
    const hunt = commands.find((c) => c.name === 'hunt');
    expect(hunt).toBeDefined();
    expect(hunt?.description).toContain('Hunt');
  });

  it('defines /inventory command with optional page number option', () => {
    const inv = commands.find((c) => c.name === 'inventory');
    expect(inv).toBeDefined();
    expect(inv?.options?.some((opt: any) => opt.name === 'page')).toBe(true);
  });

  it('defines /duel command with required target user option', () => {
    const duel = commands.find((c) => c.name === 'duel');
    expect(duel).toBeDefined();
    const targetOpt = duel?.options?.find((opt: any) => opt.name === 'target');
    expect(targetOpt).toBeDefined();
    expect(targetOpt?.required).toBe(true);
  });

  it('defines /equip command with required slot choices and card_id', () => {
    const equip = commands.find((c) => c.name === 'equip');
    expect(equip).toBeDefined();
    const slotOpt = equip?.options?.find((opt: any) => opt.name === 'slot');
    expect(slotOpt).toBeDefined();
    expect(slotOpt?.required).toBe(true);
    expect((slotOpt as any)?.choices?.map((c: any) => c.value)).toEqual([
      'vanguard',
      'striker',
      'conduit',
    ]);

    const cardIdOpt = equip?.options?.find((opt: any) => opt.name === 'card_id');
    expect(cardIdOpt).toBeDefined();
    expect(cardIdOpt?.required).toBe(true);
  });

  it('defines /duel-bot practice command correctly', () => {
    const duelBot = commands.find((c) => c.name === 'duel-bot');
    expect(duelBot).toBeDefined();
    expect(duelBot?.description).toContain('Practice');
  });

  it('defines /leaderboard command with optional category choices', () => {
    const lb = commands.find((c) => c.name === 'leaderboard');
    expect(lb).toBeDefined();
    expect(lb?.description).toContain('duelists');
    const catOpt = lb?.options?.find((opt: any) => opt.name === 'category');
    expect(catOpt).toBeDefined();
    expect((catOpt as any)?.choices?.map((c: any) => c.value)).toEqual(['rating', 'crystals']);
  });

  it('defines /market command with subcommands list, browse, and buy', () => {
    const mkt = commands.find((c) => c.name === 'market');
    expect(mkt).toBeDefined();
    const subnames = mkt?.options?.map((s: any) => s.name);
    expect(subnames).toContain('list');
    expect(subnames).toContain('browse');
    expect(subnames).toContain('buy');
  });

  it('defines /trade command with target and card IDs', () => {
    const trade = commands.find((c) => c.name === 'trade');
    expect(trade).toBeDefined();
    const optNames = trade?.options?.map((o: any) => o.name);
    expect(optNames).toContain('target');
    expect(optNames).toContain('your_card_id');
    expect(optNames).toContain('their_card_id');
  });

  it('defines /daily and /quests commands correctly', () => {
    const daily = commands.find((c) => c.name === 'daily');
    expect(daily).toBeDefined();
    expect(daily?.description).toContain('daily');

    const quests = commands.find((c) => c.name === 'quests');
    expect(quests).toBeDefined();
    const subnames = quests?.options?.map((s: any) => s.name);
    expect(subnames).toContain('view');
    expect(subnames).toContain('claim');
  });

  it('purges global commands when DISCORD_GUILD_ID is present', async () => {
    const { vi } = await import('vitest');
    const { deployCommands } = await import('../src/deploy-commands');
    process.env.DISCORD_TOKEN = 'test-token';
    process.env.DISCORD_CLIENT_ID = 'test-client-id';
    process.env.DISCORD_GUILD_ID = 'test-guild-id';

    const { REST } = await import('@discordjs/rest');
    const putSpy = vi.spyOn(REST.prototype, 'put').mockResolvedValue([] as any);

    await deployCommands();

    expect(putSpy).toHaveBeenCalledTimes(2);
    expect(putSpy).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/applications/test-client-id/commands'),
      { body: [] }
    );
    expect(putSpy).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/guilds/test-guild-id/commands'),
      { body: expect.any(Array) }
    );
    putSpy.mockRestore();
  });
});
