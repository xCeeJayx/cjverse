export * from '../scripts/generate-prompts';
import { savePromptsToFile } from '../scripts/generate-prompts';

// Direct CLI invocation hook
if (
  process.argv[1] &&
  (process.argv[1].endsWith('generate-prompts.ts') ||
    process.argv[1].endsWith('generate-prompts.js'))
) {
  const result = savePromptsToFile();
  console.log(`[Generate Prompts] Successfully wrote ${result.count} prompt configurations to ${result.filePath}`);
}
