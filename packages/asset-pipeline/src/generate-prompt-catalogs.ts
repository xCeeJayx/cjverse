export * from '../scripts/generate-prompt-catalogs';
import { generateAllPromptCatalogs } from '../scripts/generate-prompt-catalogs';

// Direct CLI invocation hook
if (
  process.argv[1] &&
  (process.argv[1].endsWith('generate-prompt-catalogs.ts') ||
    process.argv[1].endsWith('generate-prompt-catalogs.js'))
) {
  const catalogs = generateAllPromptCatalogs();
  console.log(`[Generate Catalogs] Successfully generated catalogs across ${catalogs.length} races.`);
}
