import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  buildPromptEntry,
  generateAllPrompts,
  savePromptsToFile,
} from '../scripts/generate-prompts';
import {
  parseRunNanoArgs,
  runNanoBanana,
  loadPrompts,
} from '../scripts/run-nano';

describe('Nano Banana Pro Automated Runner System', () => {
  const tmpDir = path.resolve(os.tmpdir(), `cjverse-nano-test-${Date.now()}`);
  const tmpPromptsFile = path.resolve(tmpDir, 'test-prompts.json');
  const tmpOutputDir = path.resolve(tmpDir, 'output');

  beforeAll(() => {
    fs.mkdirSync(tmpOutputDir, { recursive: true });
  });

  afterAll(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup
    }
  });

  describe('Prompt Generator (scripts/generate-prompts.ts)', () => {
    it('creates structured prompt entry matching exact manhwa template', () => {
      const entry = buildPromptEntry('dragon', 'male', 'void');
      expect(entry.filename).toBe('dragon_male_void.png');
      expect(entry.prompt).toContain('Masterpiece character concept art portrait, male dragon warrior channeling void magic');
      expect(entry.prompt).toContain('borderless, frameless, edge-to-edge illustration');
      expect(entry.prompt).not.toContain('trading card');
      expect(entry.prompt).not.toContain('card');
      expect(entry.negativePrompt).toContain('card border, border, frame, ornate frame, outer box');
    });

    it('generates all 322 prompt permutations', () => {
      const all = generateAllPrompts();
      expect(all).toHaveLength(322);
      expect(all[0].filename).toBe('dragon_male_void.png');
    });

    it('saves valid JSON state file with 322 items', () => {
      const result = savePromptsToFile(tmpPromptsFile);
      expect(result.count).toBe(322);
      expect(fs.existsSync(tmpPromptsFile)).toBe(true);

      const loaded = loadPrompts(tmpPromptsFile);
      expect(loaded).toHaveLength(322);
      expect(loaded[0].filename).toBe('dragon_male_void.png');
    });
  });

  describe('Nano Banana Runner (scripts/run-nano.ts)', () => {
    it('parses CLI arguments correctly', () => {
      const args1 = ['--sample=4', '--resume'];
      expect(parseRunNanoArgs(args1)).toEqual({
        sample: 4,
        resume: true,
        force: false,
      });

      const args2 = ['--sample', '8', '--force'];
      expect(parseRunNanoArgs(args2)).toEqual({
        sample: 8,
        resume: false,
        force: true,
      });

      const args3 = ['--sample'];
      expect(parseRunNanoArgs(args3).sample).toBe(4);
    });

    it('generates specified sample batch and writes image buffers', async () => {
      const mockGenerator = vi.fn(async () => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]));

      const result = await runNanoBanana({
        sample: 2,
        promptsFile: tmpPromptsFile,
        outputDir: tmpOutputDir,
        delayMs: 0,
        generator: mockGenerator,
      });

      expect(result.processed).toBe(2);
      expect(result.generated).toBe(2);
      expect(result.skipped).toBe(0);
      expect(mockGenerator).toHaveBeenCalledTimes(2);

      const file1 = path.resolve(tmpOutputDir, 'dragon_male_void.png');
      const file2 = path.resolve(tmpOutputDir, 'dragon_male_time.png');
      expect(fs.existsSync(file1)).toBe(true);
      expect(fs.existsSync(file2)).toBe(true);
    });

    it('skips existing files when --resume is set', async () => {
      const mockGenerator = vi.fn(async () => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]));

      const result = await runNanoBanana({
        sample: 2,
        resume: true,
        promptsFile: tmpPromptsFile,
        outputDir: tmpOutputDir,
        delayMs: 0,
        generator: mockGenerator,
      });

      expect(result.processed).toBe(2);
      expect(result.generated).toBe(0);
      expect(result.skipped).toBe(2);
      expect(mockGenerator).not.toHaveBeenCalled();
    });

    it('overwrites files when --force is set along with --resume', async () => {
      const mockGenerator = vi.fn(async () => Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]));

      const result = await runNanoBanana({
        sample: 2,
        resume: true,
        force: true,
        promptsFile: tmpPromptsFile,
        outputDir: tmpOutputDir,
        delayMs: 0,
        generator: mockGenerator,
      });

      expect(result.processed).toBe(2);
      expect(result.generated).toBe(2);
      expect(result.skipped).toBe(0);
      expect(mockGenerator).toHaveBeenCalledTimes(2);
    });
  });
});
