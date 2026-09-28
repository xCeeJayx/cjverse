import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { renderCardComposite, resolveCharacterArtworkPath } from '../src';
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

  it('renders procedural card canvas without errors when asset directory is /public/assets or missing', async () => {
    const mockCard: CardEntity = {
      seed: 99,
      race: 'elf',
      variant: 'silver',
      element: 'water',
      elementTier: 'B',
      evolutionStage: 1,
      level: 3,
      powerScore: 620,
      gender: 'female',
    };
    const publicBuffer = await renderCardComposite(mockCard, '/public/assets');
    expect(publicBuffer).toBeInstanceOf(Buffer);
    expect(publicBuffer[0]).toBe(0x89);
    expect(publicBuffer[1]).toBe(0x50);
    expect(publicBuffer[2]).toBe(0x4e);
    expect(publicBuffer[3]).toBe(0x47);

    const defaultBuffer = await renderCardComposite(mockCard);
    expect(defaultBuffer).toBeInstanceOf(Buffer);
    expect(defaultBuffer[0]).toBe(0x89);
  });

  describe('Layered Character Artwork Resolution Fallback Cascade', () => {
    const tmpDir = path.resolve(os.tmpdir(), `cjverse-test-assets-${Date.now()}`);
    const charsDir = path.resolve(tmpDir, 'characters');

    beforeAll(() => {
      fs.mkdirSync(charsDir, { recursive: true });
    });

    afterAll(() => {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup error
      }
    });

    it('falls back to procedural silhouette (null) when no images exist', async () => {
      const result = resolveCharacterArtworkPath('orc', 'female', 'fire', tmpDir);
      expect(result).toBeNull();
    });

    it('resolves Tier 3 race-neutral fallback (${race}.png)', async () => {
      const raceFile = path.resolve(charsDir, 'orc.png');
      fs.writeFileSync(raceFile, 'dummy-png-data');

      const result = resolveCharacterArtworkPath('orc', 'female', 'fire', tmpDir);
      expect(result).toBe(raceFile);
    });

    it('resolves Tier 2 element-neutral fallback (${race}_${gender}.png) over race-neutral', async () => {
      const genderFile = path.resolve(charsDir, 'orc_female.png');
      fs.writeFileSync(genderFile, 'dummy-png-data');

      const result = resolveCharacterArtworkPath('orc', 'female', 'fire', tmpDir);
      expect(result).toBe(genderFile);

      // Male still falls back to race-neutral orc.png
      const maleResult = resolveCharacterArtworkPath('orc', 'male', 'fire', tmpDir);
      expect(maleResult).toBe(path.resolve(charsDir, 'orc.png'));
    });

    it('resolves Tier 1 specific character artwork (${race}_${gender}_${element}.png) over neutral', async () => {
      const specificFile = path.resolve(charsDir, 'orc_female_fire.png');
      fs.writeFileSync(specificFile, 'dummy-png-data');

      const result = resolveCharacterArtworkPath('orc', 'female', 'fire', tmpDir);
      expect(result).toBe(specificFile);

      // Water element still falls back to Tier 2 orc_female.png
      const waterResult = resolveCharacterArtworkPath('orc', 'female', 'water', tmpDir);
      expect(waterResult).toBe(path.resolve(charsDir, 'orc_female.png'));
    });

    it('prioritizes race-specific subfolder (${race}/${race}_${gender}_${element}.png) over flat folder', async () => {
      const orcSubDir = path.resolve(charsDir, 'orc');
      fs.mkdirSync(orcSubDir, { recursive: true });

      const subfolderFile = path.resolve(orcSubDir, 'orc_female_fire.png');
      fs.writeFileSync(subfolderFile, 'subfolder-file-data');

      // Now both charsDir/orc_female_fire.png and charsDir/orc/orc_female_fire.png exist
      const result = resolveCharacterArtworkPath('orc', 'female', 'fire', tmpDir);
      expect(result).toBe(subfolderFile);

      // Subfolder neutral fallback
      const subNeutral = path.resolve(orcSubDir, 'orc_female.png');
      fs.writeFileSync(subNeutral, 'subfolder-neutral-data');
      const earthResult = resolveCharacterArtworkPath('orc', 'female', 'earth', tmpDir);
      expect(earthResult).toBe(subNeutral);
    });
  });
});

