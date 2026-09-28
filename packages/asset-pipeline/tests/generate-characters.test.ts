import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  ELEMENT_VISUAL_THEMES,
  RACES,
  GENDERS,
  ELEMENTS,
  NEGATIVE_PROMPT,
  buildCharacterPrompt,
  buildArtMatrix,
  generateArtMatrix,
  parseCliArgs,
} from '../scripts/generate-characters';

describe('Batch Art Generation Script (packages/asset-pipeline/scripts/generate-characters.ts)', () => {
  it('defines rich atmospheric descriptors for all 23 elements', () => {
    const expectedElements = [
      'void', 'time', 'cosmic', 'arcane', 'chaos',
      'fire', 'ice', 'lightning', 'shadow', 'light', 'nature', 'blood',
      'water', 'wind', 'earth', 'poison', 'sound', 'metal',
      'sand', 'mist', 'smoke', 'crystal', 'acid'
    ];

    expect(Object.keys(ELEMENT_VISUAL_THEMES)).toHaveLength(23);
    for (const elem of expectedElements) {
      expect(ELEMENT_VISUAL_THEMES).toHaveProperty(elem);
      expect(ELEMENT_VISUAL_THEMES[elem].length).toBeGreaterThan(10);
    }

    // Specific descriptor checks
    expect(ELEMENT_VISUAL_THEMES.void).toBe('Abyssal black holes, cosmic gravity distortion, deep purple event horizons');
    expect(ELEMENT_VISUAL_THEMES.fire).toBe('Molten magma cracks, blazing ember halos, raging crimson inferno tendrils');
    expect(ELEMENT_VISUAL_THEMES.ice).toBe('Diamond frost fractures, glacial mist plumes, sharp crystalline ice shards');
    expect(ELEMENT_VISUAL_THEMES.acid).toBe('Corrosive fluorescent green slime drips, bubbling acidic puddle mist, dissolving chemical vapors');
  });

  it('builds character prompt following the exact masterpiece template and negative prompt', () => {
    const { prompt, negativePrompt } = buildCharacterPrompt('dragon', 'female', 'fire');

    expect(prompt).toContain('Masterpiece character concept art portrait');
    expect(prompt).toContain('female dragon warrior channeling fire magic');
    expect(prompt).toContain('Molten magma cracks, blazing ember halos, raging crimson inferno tendrils');
    expect(prompt).toContain('dark fantasy manhwa style, sharp detailed ink linework, dynamic lighting');
    expect(prompt).toContain('borderless, frameless, seamless solid dark background, edge-to-edge illustration');
    expect(prompt).not.toContain('trading card');
    expect(prompt).not.toContain('card');

    expect(negativePrompt).toBe(NEGATIVE_PROMPT);
    expect(negativePrompt).toContain('card border, border, frame, ornate frame, outer box');
  });

  it('parses CLI arguments accurately', () => {
    const args1 = ['--sample', '--dry-run', '--force'];
    expect(parseCliArgs(args1)).toEqual({
      dryRun: true,
      sample: true,
      force: true,
      race: undefined,
      element: undefined,
      filterTier: undefined,
    });

    const args2 = ['--race=dragon', '--element=fire', '--tier=S'];
    expect(parseCliArgs(args2)).toEqual({
      dryRun: false,
      sample: false,
      force: false,
      race: 'dragon',
      element: 'fire',
      filterTier: 'S',
    });

    const args3 = ['--race', 'orc', '--element', 'water', '--tier', 'B'];
    expect(parseCliArgs(args3)).toEqual({
      dryRun: false,
      sample: false,
      force: false,
      race: 'orc',
      element: 'water',
      filterTier: 'B',
    });
  });

  it('matrix engine generates all 322 race/gender/element combinations without filter', () => {
    const matrix = buildArtMatrix();
    // 7 races * 2 genders * 23 elements = 322 items
    expect(matrix).toHaveLength(7 * 2 * 23);
    expect(matrix[0].relativePath).toBe(`assets/characters/${RACES[0]}_${GENDERS[0]}_${ELEMENTS[0]}.png`);
  });

  it('matrix engine generates only 2 items in sample mode', () => {
    const sampleMatrix = buildArtMatrix({ sample: true });
    expect(sampleMatrix).toHaveLength(2);
    expect(sampleMatrix[0].fileName).toBe('dragon_male_fire.png');
    expect(sampleMatrix[1].fileName).toBe('human_female_arcane.png');
  });

  it('matrix engine filters by race and element correctly', () => {
    const dragonMatrix = buildArtMatrix({ race: 'dragon' });
    expect(dragonMatrix).toHaveLength(2 * 23); // 2 genders * 23 elements = 46
    expect(dragonMatrix.every((item) => item.race === 'dragon')).toBe(true);

    const fireMatrix = buildArtMatrix({ element: 'fire' });
    expect(fireMatrix).toHaveLength(7 * 2); // 7 races * 2 genders = 14
    expect(fireMatrix.every((item) => item.element === 'fire')).toBe(true);
  });

  it('matrix engine filters by element tier correctly', () => {
    // S-tier has 5 elements (void, time, cosmic, arcane, chaos) -> 7 * 2 * 5 = 70 items
    const sTierMatrix = buildArtMatrix({ filterTier: 'S' });
    expect(sTierMatrix).toHaveLength(70);
    expect(sTierMatrix.every((item) => item.tier === 'S')).toBe(true);

    // C-tier has 5 elements (sand, mist, smoke, crystal, acid) -> 7 * 2 * 5 = 70 items
    const cTierMatrix = buildArtMatrix({ filterTier: 'C' });
    expect(cTierMatrix).toHaveLength(70);
    expect(cTierMatrix.every((item) => item.tier === 'C')).toBe(true);
  });

  describe('generateArtMatrix Execution, Resumption, and Error Handling', () => {
    const tmpDir = path.resolve(os.tmpdir(), `cjverse-gen-art-test-${Date.now()}`);

    beforeAll(() => {
      fs.mkdirSync(tmpDir, { recursive: true });
    });

    afterAll(() => {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup error
      }
    });

    it('logs prompts and intended paths without writing files when dryRun is true', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const items = await generateArtMatrix({
        dryRun: true,
        sample: true,
        outputDir: tmpDir,
      });

      expect(items).toHaveLength(2);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DRY RUN] assets/characters/')
      );

      consoleSpy.mockRestore();
    });

    it('skips existing files when force is false, and overwrites when force is true', async () => {
      const testFile = path.resolve(tmpDir, 'dragon_male_fire.png');
      fs.writeFileSync(testFile, 'initial-content');

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const customGenerator = vi.fn(async () => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]));

      // 1. Run without force: should skip dragon_male_fire.png
      await generateArtMatrix({
        sample: true,
        dryRun: false,
        force: false,
        outputDir: tmpDir,
        pacingDelayMs: 0,
        generator: customGenerator,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SKIP] dragon_male_fire.png exists, skipping.')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Race: dragon] Progress: 1/1 completed')
      );
      // Only human_female_arcane should have called generator
      expect(customGenerator).toHaveBeenCalledTimes(1);

      // 2. Run with force: should overwrite both
      customGenerator.mockClear();
      await generateArtMatrix({
        sample: true,
        dryRun: false,
        force: true,
        outputDir: tmpDir,
        pacingDelayMs: 0,
        generator: customGenerator,
      });

      expect(customGenerator).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });

    it('catches generator errors gracefully and continues execution', async () => {
      const consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      let count = 0;
      const failingGenerator = vi.fn(async () => {
        count++;
        if (count === 1) {
          throw new Error('Simulated network failure');
        }
        return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]);
      });

      const items = await generateArtMatrix({
        sample: true,
        dryRun: false,
        force: true,
        outputDir: tmpDir,
        pacingDelayMs: 0,
        generator: failingGenerator,
      });

      expect(items).toHaveLength(2);
      expect(consoleErrSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Failed to generate'),
        expect.any(Error)
      );

      consoleErrSpy.mockRestore();
    });

    it('restricts execution to specified race and logs progress counters up to 46 items', async () => {
      const raceTmpDir = path.resolve(tmpDir, 'dragon-test');
      fs.mkdirSync(raceTmpDir, { recursive: true });

      // Pre-create 14 files to verify strict resumption skipping
      for (let i = 0; i < 14; i++) {
        fs.writeFileSync(path.resolve(raceTmpDir, `dragon_mock_${i}.png`), 'mock');
      }
      // Pre-create one actual matrix file: dragon_male_void.png
      fs.writeFileSync(path.resolve(raceTmpDir, 'dragon_male_void.png'), 'existing');

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mockGen = vi.fn(async () => Buffer.from([0x89, 0x50, 0x4e, 0x47]));

      const items = await generateArtMatrix({
        race: 'dragon',
        dryRun: false,
        force: false,
        outputDir: raceTmpDir,
        pacingDelayMs: 0,
        generator: mockGen,
      });

      expect(items).toHaveLength(46);
      expect(items.every((it) => it.race === 'dragon')).toBe(true);

      // Verifies strict [SKIP] log
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SKIP] dragon_male_void.png exists, skipping.')
      );

      // Verifies progress counter format e.g. [Race: dragon] Progress: 1/46 completed
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Race: dragon] Progress: 1/46 completed')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Race: dragon] Progress: 46/46 completed')
      );

      // 45 items generated because 1 was skipped
      expect(mockGen).toHaveBeenCalledTimes(45);

      consoleSpy.mockRestore();
    });
  });
});
