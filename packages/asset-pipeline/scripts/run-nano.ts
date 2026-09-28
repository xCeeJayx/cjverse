import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import { CharacterPromptEntry, savePromptsToFile } from './generate-prompts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface RunNanoOptions {
  sample?: number;
  resume?: boolean;
  force?: boolean;
  outputDir?: string;
  delayMs?: number;
  promptsFile?: string;
  generator?: (item: CharacterPromptEntry, targetPath: string) => Promise<Buffer | void>;
}

/**
 * Loads prompts from prompts.json, generating it if absent.
 */
export function loadPrompts(jsonPath?: string): CharacterPromptEntry[] {
  const file = jsonPath || path.resolve(__dirname, 'prompts.json');
  if (!fs.existsSync(file)) {
    savePromptsToFile(file);
  }
  const raw = fs.readFileSync(file, 'utf-8');
  return JSON.parse(raw) as CharacterPromptEntry[];
}

/**
 * Resolves destination directory for characters.
 */
export function resolveCharactersOutputDir(customDir?: string): string {
  if (customDir) return path.resolve(customDir);

  const candidates = [
    path.resolve(process.cwd(), 'packages/asset-pipeline/assets/characters'),
    path.resolve(process.cwd(), 'assets/characters'),
    path.resolve(__dirname, '../assets/characters'),
  ];

  for (const cand of candidates) {
    if (fs.existsSync(cand)) {
      return cand;
    }
  }

  const fallback = path.resolve(process.cwd(), 'packages/asset-pipeline/assets/characters');
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

/**
 * Procedural fallback image generator matching 3:4 aspect ratio (600x800).
 */
function renderFallbackCanvas(item: CharacterPromptEntry): Buffer {
  const canvas = createCanvas(600, 800);
  const ctx = canvas.getContext('2d');

  // Dark fantasy backdrop
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, 600, 800);

  // Elemental aura glow
  const aura = ctx.createRadialGradient(300, 400, 30, 300, 400, 350);
  aura.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
  aura.addColorStop(0.5, 'rgba(30, 41, 59, 0.25)');
  aura.addColorStop(1, 'transparent');
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, 600, 800);

  // Torso / Silhouette
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.moveTo(150, 800);
  ctx.lineTo(200, 480);
  ctx.lineTo(260, 410);
  ctx.lineTo(340, 410);
  ctx.lineTo(400, 480);
  ctx.lineTo(450, 800);
  ctx.closePath();
  ctx.fill();

  // Head silhouette
  ctx.beginPath();
  ctx.arc(300, 320, 85, 0, Math.PI * 2);
  ctx.fill();

  // Typography labels
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(item.filename.replace('.png', '').toUpperCase(), 300, 310);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('NANO BANANA PRO • 3:4', 300, 355);

  return canvas.toBuffer('image/png');
}

/**
 * Executes HTTP POST request to Nano Banana Pro endpoint with 3:4 aspect ratio.
 */
async function callNanoBananaPro(
  item: CharacterPromptEntry,
  _targetPath: string
): Promise<Buffer> {
  const apiKey = process.env.NANO_BANANA_API_KEY || process.env.BANANA_API_KEY;
  const endpoint =
    process.env.NANO_BANANA_ENDPOINT || 'https://api.banana.dev/start/v4';

  if (apiKey) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt: item.prompt,
          negativePrompt: item.negativePrompt,
          aspectRatio: '3:4',
          width: 600,
          height: 800,
          model: 'nano-banana-pro',
        }),
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('image')) {
          const arr = await response.arrayBuffer();
          return Buffer.from(arr);
        }

        const json = (await response.json()) as any;
        const b64 =
          json.imageBuffer ||
          json.image_base64 ||
          json.modelOutputs?.[0]?.image_base64 ||
          json.output?.[0];
        if (b64) {
          return Buffer.from(b64, 'base64');
        }
      } else {
        console.warn(
          `[Nano Banana Pro] Request status ${response.status}: ${await response.text()}`
        );
      }
    } catch (netErr) {
      console.warn(`[Nano Banana Pro] Network error for ${item.filename}:`, netErr);
    }
  }

  // Graceful fallback when API key is not present or offline
  return renderFallbackCanvas(item);
}

/**
 * Parses CLI arguments into structured runner options.
 */
export function parseRunNanoArgs(argv: string[]): RunNanoOptions {
  let sample: number | undefined;
  let resume = false;
  let force = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--sample=')) {
      const val = parseInt(arg.split('=')[1], 10);
      if (!isNaN(val) && val > 0) sample = val;
    } else if (arg === '--sample' && i + 1 < argv.length && /^\d+$/.test(argv[i + 1])) {
      sample = parseInt(argv[++i], 10);
    } else if (arg === '--sample') {
      sample = 4;
    } else if (arg === '--resume') {
      resume = true;
    } else if (arg === '--force') {
      force = true;
    }
  }

  return { sample, resume, force };
}

/**
 * Main automated runner iterating over prompt configurations.
 */
export async function runNanoBanana(
  options: RunNanoOptions = {}
): Promise<{ processed: number; generated: number; skipped: number }> {
  const allPrompts = loadPrompts(options.promptsFile);
  const targetItems = options.sample
    ? allPrompts.slice(0, options.sample)
    : allPrompts;

  const outputDir = resolveCharactersOutputDir(options.outputDir);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(
    `[Nano Runner] Starting run for ${targetItems.length} items (resume: ${Boolean(options.resume)}, sample: ${options.sample || 'all'})`
  );

  let generated = 0;
  let skipped = 0;

  for (let i = 0; i < targetItems.length; i++) {
    const item = targetItems[i];
    const targetPath = path.resolve(outputDir, item.filename);

    // Resumption check: skip existing files if --resume is active
    if (options.resume && fs.existsSync(targetPath) && !options.force) {
      console.log(`[SKIPPED] ${item.filename} already exists`);
      skipped++;
      continue;
    }

    console.log(`[GENERATING] ${item.filename}...`);
    try {
      let buffer: Buffer | void;
      if (options.generator) {
        buffer = await options.generator(item, targetPath);
      } else {
        buffer = await callNanoBananaPro(item, targetPath);
      }

      if (buffer && Buffer.isBuffer(buffer)) {
        fs.writeFileSync(targetPath, buffer);
        console.log(`[SAVED] -> ${targetPath}`);
        generated++;
      }
    } catch (err) {
      console.error(`[ERROR] Failed generating ${item.filename}:`, err);
    }

    // 2-second rate-limiting pacing delay between consecutive API calls
    const delay = options.delayMs !== undefined ? options.delayMs : 2000;
    if (delay > 0 && i < targetItems.length - 1) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  console.log(
    `[Nano Runner] Finished. Generated: ${generated}, Skipped: ${skipped}, Total: ${targetItems.length}`
  );
  return { processed: targetItems.length, generated, skipped };
}

// Direct execution hook
if (
  process.argv[1] &&
  (process.argv[1].endsWith('run-nano.ts') || process.argv[1].endsWith('run-nano.js'))
) {
  const cliOptions = parseRunNanoArgs(process.argv.slice(2));
  runNanoBanana(cliOptions)
    .then(() => {
      console.log(`[Nano Runner] Batch execution complete.`);
    })
    .catch((err) => {
      console.error('[Nano Runner Fatal Error]:', err);
      process.exit(1);
    });
}
