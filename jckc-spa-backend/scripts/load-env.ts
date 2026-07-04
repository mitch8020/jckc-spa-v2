import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Minimal .env loader for the standalone migration scripts (no dotenv
 * dependency). Existing process.env values win; quotes are stripped.
 */
export function loadEnv(envPath = path.join(process.cwd(), '.env')): void {
  if (!fs.existsSync(envPath)) {
    return;
  }
  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export type MigrationMode = 'dry-run' | 'write';

/** Requires exactly one of --dry-run / --write, like the legacy migration. */
export function parseMode(argv: string[]): MigrationMode {
  const dryRun = argv.includes('--dry-run');
  const write = argv.includes('--write');
  if (dryRun === write) {
    console.error('Usage: provide exactly one of --dry-run or --write');
    process.exit(1);
  }
  return write ? 'write' : 'dry-run';
}
