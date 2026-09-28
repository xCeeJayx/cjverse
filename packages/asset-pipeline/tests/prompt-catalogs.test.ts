import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RACES, GENDERS, ELEMENTS } from '../scripts/generate-characters';
import {
  buildRacePromptMarkdown,
  buildRaceBaseMarkdown,
  buildRaceElementsMarkdown,
  generateAllPromptCatalogs,
  GLOBAL_NEGATIVE_PROMPT,
  STRICT_NEGATIVE_PROMPT,
  POSITIVE_ARM_ANATOMY_ENFORCER,
  ELEMENT_TIERED_CONFIGS,
} from '../scripts/generate-prompt-catalogs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Race-Specific Character Asset Folders & Prompt Catalogs', () => {
  const rootDir = path.resolve(__dirname, '..');
  const normalDir = path.resolve(rootDir, 'assets/normal');
  const promptsDir = path.resolve(rootDir, 'assets/prompts');
  const charactersDir = path.resolve(rootDir, 'assets/characters');

  it('contains exactly 7 race directories under assets/normal, assets/prompts, and assets/characters', () => {
    for (const race of RACES) {
      const raceNormalDir = path.resolve(normalDir, race);
      const racePromptDir = path.resolve(promptsDir, race);
      const raceCharDir = path.resolve(charactersDir, race);

      expect(fs.existsSync(raceNormalDir)).toBe(true);
      expect(fs.statSync(raceNormalDir).isDirectory()).toBe(true);

      expect(fs.existsSync(racePromptDir)).toBe(true);
      expect(fs.statSync(racePromptDir).isDirectory()).toBe(true);

      expect(fs.existsSync(raceCharDir)).toBe(true);
      expect(fs.statSync(raceCharDir).isDirectory()).toBe(true);
    }
  });

  it('enforces arm anti-duplication negative prompt and positive enforcer', () => {
    expect(GLOBAL_NEGATIVE_PROMPT).toContain('extra arms');
    expect(GLOBAL_NEGATIVE_PROMPT).toContain('three arms');
    expect(GLOBAL_NEGATIVE_PROMPT).toContain('extra hands');
    expect(GLOBAL_NEGATIVE_PROMPT).toContain('three hands');
    expect(GLOBAL_NEGATIVE_PROMPT).toContain('duplicate arms');
    expect(GLOBAL_NEGATIVE_PROMPT).toContain('duplicate hands');
    expect(GLOBAL_NEGATIVE_PROMPT).toContain('floating limbs');
    expect(GLOBAL_NEGATIVE_PROMPT).toContain('mutated hands');
    expect(GLOBAL_NEGATIVE_PROMPT).toContain('bad anatomy');
    expect(GLOBAL_NEGATIVE_PROMPT).toContain('deformed fingers');
    expect(GLOBAL_NEGATIVE_PROMPT).toContain('extra limbs');

    expect(POSITIVE_ARM_ANATOMY_ENFORCER).toBe(
      'anatomically correct, exactly two arms, two hands only, one hand active, other hand resting at side or hip'
    );
  });

  it('defines 23 element configs across all 4 tiers with unique hand poses and tiered backgrounds', () => {
    expect(Object.keys(ELEMENT_TIERED_CONFIGS).length).toBe(23);

    for (const element of ELEMENTS) {
      const config = ELEMENT_TIERED_CONFIGS[element];
      expect(config).toBeDefined();
      expect(['S', 'A', 'B', 'C']).toContain(config.tier);

      // Verify each element specifies exact actions for both hands and armorUpgrade
      expect(config.handAction).toMatch(/right (hand|claw|palm).*left hand/);
      expect(config.armorUpgrade).toBeDefined();
      expect(config.armorUpgrade.length).toBeGreaterThan(15);

      // Verify tiered background complexity and crowns
      if (config.tier === 'S') {
        expect(config.tierCategory).toBe('Legendary');
        expect(config.bgTierPrefix).toBe('mythical background with');
        expect(config.maleCrown).toBeDefined();
        expect(config.femaleCrown).toBeDefined();
      } else if (config.tier === 'A') {
        expect(config.tierCategory).toBe('Primal');
        expect(config.bgTierPrefix).toBe('legendary background with');
      } else if (config.tier === 'B') {
        expect(config.tierCategory).toBe('Specialized');
        expect(config.bgTierPrefix).toBe('epic background with');
      } else if (config.tier === 'C') {
        expect(config.tierCategory).toBe('Composite');
        expect(config.bgTierPrefix).toBe('rare background with');
      }
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
          const config = ELEMENT_TIERED_CONFIGS[element];
          const crownPart = config.tier === 'S'
            ? `${gender.toLowerCase() === 'male' ? config.maleCrown : config.femaleCrown}, `
            : '';

          expect(content).toContain(expectedKey);
          expect(content).toContain(
            `- **Target File**: \`packages/asset-pipeline/assets/characters/${race}/${expectedKey}.png\``
          );
          expect(content).toContain(
            `- **Prompt**: \`Masterpiece character concept art portrait, ${gender} ${race} warrior channeling ${element} magic`
          );
          expect(content).toContain(config.armorUpgrade);
          expect(content).toContain(config.handAction);
          expect(content).toContain(config.bgTierPrefix);
          expect(content).toContain(config.backgroundVfx);
          expect(content).toContain(POSITIVE_ARM_ANATOMY_ENFORCER);
          if (config.tier === 'S') {
            expect(content).toContain(crownPart);
          }
        }
      }
    }
  });

  it('contains a valid base.md file for each of the 7 races defining 2 master anchor prompts', () => {
    for (const race of RACES) {
      const basePath = path.resolve(promptsDir, race, 'base.md');
      expect(fs.existsSync(basePath)).toBe(true);

      const content = fs.readFileSync(basePath, 'utf-8');
      expect(content).toContain(`# Base Character Art Prompts: ${race.charAt(0).toUpperCase() + race.slice(1)}`);
      expect(content).toContain('## Global Configuration');
      expect(content).toContain('- **Model Tool**: Nano Banana Pro');
      expect(content).toContain('- **Aspect Ratio**: 3:4 (Portrait)');
      expect(content).toContain(`- **Output Directory**: \`packages/asset-pipeline/assets/normal/${race}/\``);
      expect(content).toContain(`- **Negative Prompt**: \`${STRICT_NEGATIVE_PROMPT}\``);

      // Count entries matching "### <N>. <race>_<gender>_base"
      const entryMatches = content.match(/### \d+\. /g);
      expect(entryMatches).not.toBeNull();
      expect(entryMatches!.length).toBe(2);

      for (const gender of GENDERS) {
        const expectedKey = `${race}_${gender}_base`;
        expect(content).toContain(expectedKey);
        expect(content).toContain(
          `- **Target File**: \`packages/asset-pipeline/assets/normal/${race}/${expectedKey}.png\``
        );
        expect(content).toContain('pristine polished dark slate-iron plate armor with unlit, uncharged runic engravings');
        expect(content).toContain('neutral hands resting forward at mid-chest');
        expect(content).toContain('neutral glowing white/pale-gray eyes');
        expect(content).toContain('centered half-body waist-up portrait');
        expect(content).toContain('directly facing camera');
        expect(content).toContain('seamless pitch-black solid dark background');
        expect(content).toContain('borderless');
        expect(content).toContain('frameless');
      }
    }
  });

  it('contains a valid elements.md file for each of the 7 races with 46 modification tasks', () => {
    for (const race of RACES) {
      const elementsPath = path.resolve(promptsDir, race, 'elements.md');
      expect(fs.existsSync(elementsPath)).toBe(true);

      const content = fs.readFileSync(elementsPath, 'utf-8');
      expect(content).toContain(`# Elemental Modification Tasks: ${race.charAt(0).toUpperCase() + race.slice(1)}`);
      expect(content).toContain('## Global Configuration');
      expect(content).toContain('- **Model Tool**: Nano Banana Pro');
      expect(content).toContain('- **Aspect Ratio**: 3:4 (Portrait)');
      expect(content).toContain(`- **Base References Directory**: \`packages/asset-pipeline/assets/normal/${race}/\``);
      expect(content).toContain(`- **Output Directory**: \`packages/asset-pipeline/assets/characters/${race}/\``);
      expect(content).toContain(`- **Negative Prompt**: \`${STRICT_NEGATIVE_PROMPT}\``);

      // Count entries matching "### <N>. <race>_<gender>_<element>"
      const entryMatches = content.match(/### \d+\. /g);
      expect(entryMatches).not.toBeNull();
      expect(entryMatches!.length).toBe(46);

      // Verify elemental prompts remove seamless pitch-black background tokens
      expect(content).not.toContain('seamless pitch-black solid dark background');
      expect(content).not.toContain('seamless pitch-black background');

      // Verify every gender & element combination has Reference Image, Modification Task, and Destination
      for (const gender of GENDERS) {
        for (const element of ELEMENTS) {
          const expectedKey = `${race}_${gender}_${element}`;
          const expectedRef = `packages/asset-pipeline/assets/normal/${race}/${race}_${gender}_base.png`;
          const expectedDest = `packages/asset-pipeline/assets/characters/${race}/${expectedKey}.png`;
          const config = ELEMENT_TIERED_CONFIGS[element];
          const crownPart = config.tier === 'S'
            ? `${gender.toLowerCase() === 'male' ? config.maleCrown : config.femaleCrown}, `
            : '';

          expect(content).toContain(expectedKey);
          expect(content).toContain(`- **Reference Image**: \`${expectedRef}\``);
          expect(content).toContain(`- **Destination**: \`${expectedDest}\``);
          expect(content).toContain(
            `- **Modification Task**: Keep the exact facial features, horns, hair, skin/scale texture, framing, and armor silhouette of the reference image. Ignite the dark slate iron armor runes with ${element} energy, ${crownPart}upgraded with ${config.armorUpgrade}. Display a ${config.facialExpression}. Pose with ${config.handAction}, channeling ${element} magic (${config.bgTierPrefix} ${config.backgroundVfx}).`
          );
          expect(content).toContain(config.armorUpgrade);
          expect(content).toContain(config.facialExpression);
          expect(content).toContain(config.handAction);
          expect(content).toContain(config.bgTierPrefix);
          expect(content).toContain(config.backgroundVfx);
          expect(content).toContain(POSITIVE_ARM_ANATOMY_ENFORCER);
          if (config.tier === 'S') {
            expect(content).toContain(crownPart);
          }
        }
      }
    }
  });

  it('buildRaceBaseMarkdown produces deterministic catalog with 2 entries', () => {
    const { content, count } = buildRaceBaseMarkdown('dragon');
    expect(count).toBe(2);
    expect(content).toContain('# Base Character Art Prompts: Dragon');
    expect(content).toContain('dragon_male_base');
    expect(content).toContain('dragon_female_base');
    expect(content).toContain('packages/asset-pipeline/assets/normal/dragon/dragon_male_base.png');
  });

  it('buildRaceElementsMarkdown produces deterministic catalog with 46 entries', () => {
    const { content, count } = buildRaceElementsMarkdown('dragon');
    expect(count).toBe(46);
    expect(content).toContain('# Elemental Modification Tasks: Dragon');
    expect(content).toContain('dragon_male_void');
    expect(content).toContain('dragon_female_fire');
    expect(content).toContain('packages/asset-pipeline/assets/normal/dragon/dragon_male_base.png');
    expect(content).toContain('packages/asset-pipeline/assets/characters/dragon/dragon_female_fire.png');
    expect(content).toContain(POSITIVE_ARM_ANATOMY_ENFORCER);
  });

  it('buildRacePromptMarkdown produces deterministic catalog with 46 entries', () => {
    const { content, count } = buildRacePromptMarkdown('elf');
    expect(count).toBe(46);
    expect(content).toContain('# Character Art Prompts: Elf');
    expect(content).toContain('elf_female_nature');
    expect(content).toContain('elf_male_arcane');
    expect(content).toContain(POSITIVE_ARM_ANATOMY_ENFORCER);
  });
});


