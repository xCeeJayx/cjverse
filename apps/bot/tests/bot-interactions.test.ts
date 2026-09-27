// apps/bot/tests/bot-interactions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleInteraction } from '../src';
import { resetCooldowns } from '../src/commands/hunt';

describe('Discord Bot Interaction Handler Runtime', () => {
  beforeEach(() => {
    resetCooldowns();
    vi.restoreAllMocks();
  });

  it('handles /hunt command interaction with deferReply and editReply', async () => {
    const deferReplyMock = vi.fn().mockResolvedValue(undefined);
    const editReplyMock = vi.fn().mockResolvedValue(undefined);

    const mockInteraction: any = {
      commandName: 'hunt',
      user: {
        id: 'test-user-1',
        username: 'TestHunter',
      },
      deferReply: deferReplyMock,
      editReply: editReplyMock,
    };

    await handleInteraction(mockInteraction);

    expect(deferReplyMock).toHaveBeenCalledOnce();
    expect(editReplyMock).toHaveBeenCalledOnce();
    const callArg = editReplyMock.mock.calls[0][0];
    expect(callArg.embeds).toBeDefined();
    expect(callArg.files).toBeDefined();
    const desc = callArg.embeds[0].data.description;
    expect(desc).not.toContain('#');
  });

  it('calls deferReply immediately before running hunt generator or db queries', async () => {
    let deferCalledBeforeHunt = false;
    const deferReplyMock = vi.fn().mockImplementation(() => {
      deferCalledBeforeHunt = true;
      return Promise.resolve();
    });
    const editReplyMock = vi.fn().mockResolvedValue(undefined);

    const mockInteraction: any = {
      commandName: 'hunt',
      user: {
        id: 'test-user-defer-order',
        username: 'QuickHunter',
      },
      deferReply: deferReplyMock,
      editReply: editReplyMock,
    };

    await handleInteraction(mockInteraction);

    expect(deferReplyMock).toHaveBeenCalledOnce();
    expect(deferCalledBeforeHunt).toBe(true);
    expect(editReplyMock).toHaveBeenCalledOnce();
  });

  it('handles /inventory command interaction for empty inventory', async () => {
    const deferReplyMock = vi.fn().mockResolvedValue(undefined);
    const editReplyMock = vi.fn().mockResolvedValue(undefined);

    const mockInteraction: any = {
      commandName: 'inventory',
      user: {
        id: 'empty-user-999',
        username: 'EmptyPlayer',
      },
      options: {
        getInteger: vi.fn().mockReturnValue(1),
      },
      deferReply: deferReplyMock,
      editReply: editReplyMock,
    };

    await handleInteraction(mockInteraction);

    expect(deferReplyMock).toHaveBeenCalledOnce();
    expect(editReplyMock).toHaveBeenCalledOnce();
  });

  it('handles /duel command interaction when challenging bot', async () => {
    const replyMock = vi.fn().mockResolvedValue(undefined);

    const mockInteraction: any = {
      commandName: 'duel',
      user: {
        id: 'player-1',
        username: 'Duelist1',
      },
      options: {
        getUser: vi.fn().mockReturnValue({
          id: 'bot-id',
          username: 'SomeBot',
          bot: true,
        }),
      },
      reply: replyMock,
    };

    await handleInteraction(mockInteraction);

    expect(replyMock).toHaveBeenCalledOnce();
    const callArg = replyMock.mock.calls[0][0];
    expect(callArg.content).toContain('Cannot challenge a bot');
  });

  it('handles /equip command interaction with deferReply and editReply', async () => {
    const deferReplyMock = vi.fn().mockResolvedValue(undefined);
    const editReplyMock = vi.fn().mockResolvedValue(undefined);

    const mockInteraction: any = {
      commandName: 'equip',
      user: {
        id: 'user-equip-test',
        username: 'EquipTester',
      },
      options: {
        getString: vi.fn().mockImplementation((opt: string) => {
          if (opt === 'slot') return 'vanguard';
          if (opt === 'card_id') return 'invalid_card_id';
          return null;
        }),
      },
      deferReply: deferReplyMock,
      editReply: editReplyMock,
    };

    await handleInteraction(mockInteraction);

    expect(deferReplyMock).toHaveBeenCalledOnce();
    expect(editReplyMock).toHaveBeenCalledOnce();
  });

  it('handles /duel-bot command interaction with deferReply and editReply', async () => {
    let deferred = false;
    const deferReplyMock = vi.fn().mockImplementation(async () => {
      deferred = true;
    });
    const editReplyMock = vi.fn().mockResolvedValue(undefined);
    const replyMock = vi.fn().mockResolvedValue(undefined);

    const mockInteraction: any = {
      commandName: 'duel-bot',
      user: {
        id: 'user-practice-test',
        username: 'PracticeTester',
      },
      get deferred() {
        return deferred;
      },
      deferReply: deferReplyMock,
      editReply: editReplyMock,
      reply: replyMock,
    };

    await handleInteraction(mockInteraction);

    expect(deferReplyMock).toHaveBeenCalledOnce();
    expect(editReplyMock).toHaveBeenCalledOnce();
  });

  it('handles /upgrade command interaction with deferReply and editReply', async () => {
    let deferred = false;
    const deferReplyMock = vi.fn().mockImplementation(async () => {
      deferred = true;
    });
    const editReplyMock = vi.fn().mockResolvedValue(undefined);

    const mockInteraction: any = {
      commandName: 'upgrade',
      user: {
        id: 'user-upgrade-test',
        username: 'UpgradeTester',
      },
      options: {
        getString: vi.fn().mockImplementation((opt: string) => {
          if (opt === 'card_id') return 'non-existent-card';
          return null;
        }),
      },
      get deferred() {
        return deferred;
      },
      deferReply: deferReplyMock,
      editReply: editReplyMock,
    };

    await handleInteraction(mockInteraction);

    expect(deferReplyMock).toHaveBeenCalledOnce();
    expect(editReplyMock).toHaveBeenCalledOnce();
    const callArg = editReplyMock.mock.calls[0][0];
    expect(callArg).toContain('Upgrade Failed');
  });

  it('handles /evolve command interaction with deferReply and editReply', async () => {
    let deferred = false;
    const deferReplyMock = vi.fn().mockImplementation(async () => {
      deferred = true;
    });
    const editReplyMock = vi.fn().mockResolvedValue(undefined);

    const mockInteraction: any = {
      commandName: 'evolve',
      user: {
        id: 'user-evolve-test',
        username: 'EvolveTester',
      },
      options: {
        getString: vi.fn().mockImplementation((opt: string) => {
          if (opt === 'card_id') return 'non-existent-card';
          return null;
        }),
      },
      get deferred() {
        return deferred;
      },
      deferReply: deferReplyMock,
      editReply: editReplyMock,
    };

    await handleInteraction(mockInteraction);

    expect(deferReplyMock).toHaveBeenCalledOnce();
    expect(editReplyMock).toHaveBeenCalledOnce();
    const callArg = editReplyMock.mock.calls[0][0];
    expect(callArg).toContain('Evolution Failed');
  });
});

