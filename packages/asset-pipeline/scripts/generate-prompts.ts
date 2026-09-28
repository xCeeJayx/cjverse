import fs from 'node:fs';
import path from 'node:path';
import {
  RACES,
  GENDERS,
  ELEMENTS,
  ELEMENT_VISUAL_THEMES,
  NEGATIVE_PROMPT,
} from './generate-characters';
import { ELEMENT_TIERED_CONFIGS } from './generate-prompt-catalogs';

export interface CharacterPromptEntry {
  filename: string;
  prompt: string;
  negativePrompt: string;
}

/**
 * Builds a single masterpiece prompt configuration entry.
 */
export function buildPromptEntry(race: string, gender: string, element: string): CharacterPromptEntry {
  const elemLower = element.toLowerCase();
  const elementDescription =
    ELEMENT_VISUAL_THEMES[elemLower] || `${element} magic energy aura`;
  const config = ELEMENT_TIERED_CONFIGS[elemLower];
  const armorUpgrade = config?.armorUpgrade ? `, upgraded with ${config.armorUpgrade}` : '';

  const filename = `${race}_${gender}_${element}.png`;
  const prompt = `Masterpiece character concept art portrait, ${gender} ${race} warrior channeling ${element} magic, ${elementDescription}${armorUpgrade}, dark fantasy manhwa style, sharp detailed ink linework, dynamic lighting, glowing ${element} energy particles, intense gaze, cinematic anime illustration, centered bust portrait, borderless, frameless, seamless solid dark background, edge-to-edge illustration, 8k resolution, trending on ArtStation`;

  return {
    filename,
    prompt,
    negativePrompt: NEGATIVE_PROMPT,
  };
}

/**
 * Generates all 322 character prompt permutations across 7 races, 2 genders, and 23 elements.
 */
export function generateAllPrompts(): CharacterPromptEntry[] {
  const entries: CharacterPromptEntry[] = [];

  for (const race of RACES) {
    for (const gender of GENDERS) {
      for (const element of ELEMENTS) {
        entries.push(buildPromptEntry(race, gender, element));
      }
    }
  }

  return entries;
}

/**
 * Saves generated prompts to the target JSON state file.
 */
export function savePromptsToFile(outputPath?: string): { filePath: string; count: number } {
  const targetPath = outputPath || path.resolve(__dirname, 'prompts.json');
  const prompts = generateAllPrompts();
  fs.writeFileSync(targetPath, JSON.stringify(prompts, null, 2), 'utf-8');
  return { filePath: targetPath, count: prompts.length };
}

// Direct CLI invocation hook
if (
  process.argv[1] &&
  (process.argv[1].endsWith('generate-prompts.ts') || process.argv[1].endsWith('generate-prompts.js'))
) {
  const result = savePromptsToFile();
  console.log(`[Generate Prompts] Successfully wrote ${result.count} prompt configurations to ${result.filePath}`);
}
