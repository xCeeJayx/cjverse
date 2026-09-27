// tests/monorepo-health.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Monorepo Configuration Health', () => {
  it('defines valid pnpm workspaces configuration including apps and packages', () => {
    const workspaceYaml = fs.readFileSync(path.resolve(__dirname, '../pnpm-workspace.yaml'), 'utf-8');
    expect(workspaceYaml).toContain('packages/*');
    expect(workspaceYaml).toContain('apps/*');
  });

  it('defines valid turbo pipeline configuration', () => {
    const turboJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../turbo.json'), 'utf-8'));
    expect(turboJson.tasks).toHaveProperty('build');
    expect(turboJson.tasks).toHaveProperty('test');
  });
});
