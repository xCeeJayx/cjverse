import { describe, it, expect } from 'vitest';
import { renderCard, renderCardComposite, CARD_WIDTH, CARD_HEIGHT } from '../src';
import { loadImage } from '@napi-rs/canvas';
import fs from 'node:fs';
import path from 'node:path';

describe('Full-Bleed Cover Scaling Verification', () => {
  it('renders elf male earth card with full-bleed dimensions (600x850)', async () => {
    const card = {
      id: 'ELF001',
      race: 'elf',
      gender: 'male',
      variant: 'gold',
      element: 'earth',
      elementTier: 'B',
      evolutionStage: 2,
      level: 12,
      powerScore: 1450,
    };

    const buffer = await renderCard(card as any);
    expect(Buffer.isBuffer(buffer)).toBe(true);

    const img = await loadImage(buffer);
    expect(img.width).toBe(CARD_WIDTH);
    expect(img.height).toBe(CARD_HEIGHT);
    expect(img.width).toBe(600);
    expect(img.height).toBe(850);

    // Save test output for verification
    const outPath = path.resolve(__dirname, '../dist/elf_earth_card_test.png');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, buffer);
    expect(fs.existsSync(outPath)).toBe(true);
  });

  it('renders dragon male fire card with full-bleed dimensions (600x850)', async () => {
    const card = {
      id: 'DRG001',
      race: 'dragon',
      gender: 'male',
      variant: 'diamond',
      element: 'fire',
      elementTier: 'S',
      evolutionStage: 3,
      level: 25,
      powerScore: 2800,
    };

    const buffer = await renderCardComposite(card as any);
    expect(Buffer.isBuffer(buffer)).toBe(true);

    const img = await loadImage(buffer);
    expect(img.width).toBe(600);
    expect(img.height).toBe(850);
  });
});
