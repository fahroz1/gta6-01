// SOLMAR — Open Streets: competition entrypoint.
//
// Hands in the game: copies game/ and screenshots/ from beside this script
// into the output directory, then writes dossier.json there with the vendored
// make.fun library. Input paths resolve from this script file's own directory,
// never from the process working directory, so the entrypoint works no matter
// where the grader runs it from. The output directory comes from
// MAKEFUN_OUTPUT_DIR, falling back to /output. Deterministic and offline: no
// network, no randomness, no timestamps in the output.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier, DOSSIER_SCHEMA } from './vendor/makefun-game.ts';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const gameDir = join(scriptDir, 'game');
const screenshotsDir = join(scriptDir, 'screenshots');
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

// --- inputs ---------------------------------------------------------------

if (!existsSync(gameDir) || !statSync(gameDir).isDirectory()) {
  throw new Error(`game/ directory is missing: ${gameDir}`);
}
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error(`game/index.html is missing: ${join(gameDir, 'index.html')}`);
}

// --- stage ----------------------------------------------------------------

mkdirSync(outDir, { recursive: true });
cpSync(gameDir, join(outDir, 'game'), { recursive: true });
const hasScreenshots = existsSync(screenshotsDir) && statSync(screenshotsDir).isDirectory();
if (hasScreenshots) {
  cpSync(screenshotsDir, join(outDir, 'screenshots'), { recursive: true });
}

// --- count what was staged ------------------------------------------------

function countTree(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = countTree(path);
      files += sub.files;
      bytes += sub.bytes;
    } else if (entry.isFile()) {
      files += 1;
      bytes += statSync(path).size;
    }
  }
  return { files, bytes };
}

const gameStaged = countTree(join(outDir, 'game'));
console.log(`staged game: ${gameStaged.files} files, ${gameStaged.bytes} bytes`);
if (hasScreenshots) {
  const shotsStaged = countTree(join(outDir, 'screenshots'));
  console.log(`staged screenshots: ${shotsStaged.files} files, ${shotsStaged.bytes} bytes`);
} else {
  console.log('staged screenshots: none (screenshots/ folder absent)');
}

// --- dossier --------------------------------------------------------------

const dossier = buildDossier(outDir, {
  text_max_bytes: 1_000_000,
  screenshots: { max: 8, max_bytes: 262144 },
  game_max_files: 1000,
  game_max_bytes: 10_000_000,
  game_path_max_bytes: 1000,
});
const dossierPath = join(outDir, 'dossier.json');
writeFileSync(dossierPath, dossier);
const writtenBytes = statSync(dossierPath).size;
if (writtenBytes !== dossier.length) {
  throw new Error(`dossier.json: wrote ${dossier.length} bytes but the file holds ${writtenBytes}`);
}
console.log(`dossier.json: ${dossier.length} bytes (verified on disk)`);

// --- verify the dossier we just wrote -------------------------------------

const parsed = JSON.parse(readFileSync(dossierPath, 'utf8')) as { schema?: unknown };
if (parsed.schema !== DOSSIER_SCHEMA) {
  throw new Error(`dossier schema mismatch: got ${JSON.stringify(parsed.schema)}, expected ${DOSSIER_SCHEMA}`);
}
console.log(`dossier schema OK: ${DOSSIER_SCHEMA}`);
