// packages/asset-pipeline/tests/card-composite.test.ts
import { describe, it, expect } from 'vitest';
import { renderCardComposite } from '../src';
import { CardEntity } from '@cjverse/game-logic';

describe('Canvas Card Composite Renderer with Fallback', () => {
  // Review Focus Check: Missing Asset Slices Fallback
  it('renders procedural card canvas without errors when image slices are absent', async () => {
    const mockCard: CardEntity = {
      seed: 42,
      race: 'dragon',
      variant: 'gold',
      element: 'fire',
      elementTier: 'A',
      evolutionStage: 2,
      level: 5,
      powerScore: 850
    };
    const pngBuffer = await renderCardComposite(mockCard, '/non/existent/path');
    expect(pngBuffer).toBeInstanceOf(Buffer);
    expect(pngBuffer.length).toBeGreaterThan(100);
    // Verify PNG magic bytes: 0x89 0x50 0x4E 0x47
    expect(pngBuffer[0]).toBe(0x89);
    expect(pngBuffer[1]).toBe(0x50);
    expect(pngBuffer[2]).toBe(0x4e);
    expect(pngBuffer[3]).toBe(0x47);
  });
});
