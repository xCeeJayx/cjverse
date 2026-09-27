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
});
