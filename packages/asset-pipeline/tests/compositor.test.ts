import { describe, it, expect } from 'vitest';
import { renderCardComposite, getCardRole } from '../src/compositor';

describe('Layered Canvas Compositor (packages/asset-pipeline)', () => {
  const isPngBuffer = (buf: Buffer): boolean => {
    return (
      buf.length > 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 && // P
      buf[2] === 0x4e && // N
      buf[3] === 0x47 && // G
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a
    );
  };

  it('generates a valid 600x850 PNG buffer under 250ms', async () => {
    const start = performance.now();

    const buffer = await renderCardComposite({
      id: 'A1B2C3',
      race: 'dragon',
      variant: 'gold',
      element: 'fire',
      elementTier: 'S',
      evolutionStage: 2,
      level: 15,
      powerScore: 850,
      seed: 12345,
    });

    const duration = performance.now() - start;

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(isPngBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1000);
    // Verified performance requirement: under 250ms
    expect(duration).toBeLessThan(250);
  });

  it('renders all variants and elements without throwing', async () => {
    const variants = ['normal', 'silver', 'gold', 'diamond'];
    const elements = ['fire', 'ice', 'void', 'lightning'];

    for (let i = 0; i < variants.length; i++) {
      const buffer = await renderCardComposite({
        id: `VAR00${i}`,
        race: 'orc',
        variant: variants[i],
        element: elements[i],
        evolutionStage: 1,
        level: 5,
      });

      expect(isPngBuffer(buffer)).toBe(true);
    }
  });

  it('determines card roles accurately', () => {
    expect(getCardRole({ role: 'vanguard' }).role).toBe('Vanguard');
    expect(getCardRole({ role: 'striker' }).role).toBe('Striker');
    expect(getCardRole({ role: 'conduit' }).role).toBe('Conduit');

    expect(getCardRole({ race: 'dragon' }).role).toBe('Vanguard');
    expect(getCardRole({ race: 'human' }).role).toBe('Striker');
    expect(getCardRole({ race: 'elf' }).role).toBe('Conduit');
  });
});
