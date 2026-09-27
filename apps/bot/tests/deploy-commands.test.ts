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
});
