import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RACES, GENDERS, ELEMENTS } from '../scripts/generate-characters';
import { buildRacePromptMarkdown, generateAllPromptCatalogs, STRICT_NEGATIVE_PROMPT } from '../scripts/generate-prompt-catalogs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Race-Specific Character Asset Folders & Prompt Catalogs', () => {
  const rootDir = path.resolve(__dirname, '..');
  const promptsDir = path.resolve(rootDir, 'assets/prompts');
  const charactersDir = path.resolve(rootDir, 'assets/characters');

  it('contains exactly 7 race directories under assets/prompts and assets/characters', () => {
    for (const race of RACES) {
      const racePromptDir = path.resolve(promptsDir, race);
      const raceCharDir = path.resolve(charactersDir, race);

      expect(fs.existsSync(racePromptDir)).toBe(true);
      expect(fs.statSync(racePromptDir).isDirectory()).toBe(true);

      expect(fs.existsSync(raceCharDir)).toBe(true);
      expect(fs.statSync(raceCharDir).isDirectory()).toBe(true);
    }
  });

  it('contains a valid prompts.md file for each of the 7 races with exactly 46 prompt entries', () => {
    for (const race of RACES) {
      const catalogPath = path.resolve(promptsDir, race, 'prompts.md');
      expect(fs.existsSync(catalogPath)).toBe(true);

      const content = fs.readFileSync(catalogPath, 'utf-8');
      expect(content).toContain(`# Character Art Prompts: ${race.charAt(0).toUpperCase() + race.slice(1)}`);
      expect(content).toContain('## Global Configuration');
      expect(content).toContain('- **Model Tool**: Nano Banana Pro');
      expect(content).toContain('- **Aspect Ratio**: 3:4 (Portrait)');
      expect(content).toContain(`- **Output Directory**: \`packages/asset-pipeline/assets/characters/${race}/\``);
      expect(content).toContain(`- **Negative Prompt**: \`${STRICT_NEGATIVE_PROMPT}\``);

      // Count entries matching "### <N>. <race>_<gender>_<element>"
      const entryMatches = content.match(/### \d+\. /g);
      expect(entryMatches).not.toBeNull();
      expect(entryMatches!.length).toBe(46);

      // Verify every gender & element combination is represented
      for (const gender of GENDERS) {
        for (const element of ELEMENTS) {
          const expectedKey = `${race}_${gender}_${element}`;
          expect(content).toContain(`### `);
          expect(content).toContain(expectedKey);
          expect(content).toContain(
            `- **Target File**: \`packages/asset-pipeline/assets/characters/${race}/${expectedKey}.png\``
          );
          expect(content).toContain(
            `- **Prompt**: \`Masterpiece character concept art portrait, ${gender} ${race} warrior channeling ${element} magic`
          );
        }
      }
    }
  });

  it('buildRacePromptMarkdown produces deterministic catalog with 46 entries', () => {
    const { content, count } = buildRacePromptMarkdown('elf');
    expect(count).toBe(46);
    expect(content).toContain('# Character Art Prompts: Elf');
    expect(content).toContain('elf_female_nature');
    expect(content).toContain('elf_male_arcane');
  });
});
