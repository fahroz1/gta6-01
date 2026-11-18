// SOLMAR — Open Streets: competition entrypoint (Node 22).
//
// Copies game/ and screenshots/ into /output, then writes dossier.json
// with the make.fun kit helper (vendor/makefun-game.ts). The dossier is
// the entry the graders read: the game sources, the vendored three.js,
// and the four screenshots.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { buildDossier, DOSSIER_SCHEMA } from './vendor/makefun-game.ts';

const OUT_DIR = '/output';
const GAME_DIR = 'game';
const SHOTS_DIR = 'screenshots';

if (!existsSync(GAME_DIR)) {
  throw new Error('game/ directory is missing — nothing to submit');
}
if (!existsSync(`${GAME_DIR}/index.html`)) {
  throw new Error('game/index.html is missing — the entrypoint has no game');
}

mkdirSync(OUT_DIR, { recursive: true });
cpSync(GAME_DIR, `${OUT_DIR}/game`, { recursive: true });
if (existsSync(SHOTS_DIR)) {
  cpSync(SHOTS_DIR, `${OUT_DIR}/screenshots`, { recursive: true });
}

// Report what was staged, so a failed or partial copy is visible at once.
function countTree(dir) {
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      const sub = countTree(full);
      files += sub.files;
      bytes += sub.bytes;
    } else {
      files += 1;
      bytes += statSync(full).size;
    }
  }
  return { files, bytes };
}
const staged = countTree(`${OUT_DIR}/game`);
const shots = existsSync(`${OUT_DIR}/screenshots`)
  ? countTree(`${OUT_DIR}/screenshots`)
  : { files: 0, bytes: 0 };
console.log(
  `SOLMAR staged: ${staged.files} game files (${staged.bytes} bytes), ` +
  `${shots.files} screenshots (${shots.bytes} bytes)`,
);

const dossier = buildDossier(OUT_DIR, {
  text_max_bytes: 1_000_000,
  screenshots: { max: 8, max_bytes: 262144 },
  game_max_files: 1000,
  game_max_bytes: 10_000_000,
  game_path_max_bytes: 1000,
});
writeFileSync(`${OUT_DIR}/dossier.json`, dossier);
console.log(`SOLMAR dossier written: ${dossier.length} bytes -> ${OUT_DIR}/dossier.json`);

// Read the dossier back and confirm it is the schema the graders expect.
const check = JSON.parse(readFileSync(`${OUT_DIR}/dossier.json`, 'utf-8'));
if (check.schema !== DOSSIER_SCHEMA) {
  throw new Error(`dossier schema mismatch: got ${String(check.schema)}`);
}
console.log(`SOLMAR dossier verified: schema ${check.schema}`);
