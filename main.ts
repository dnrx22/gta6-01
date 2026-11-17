// Vice Shores — the program the grader runs (Node 22, standard library only).
// The game itself is plain static files under game/ (index.html plus vanilla
// ES modules, no library, no network request), and this file hands it in: it
// copies game/ and screenshots/ from next to this file into the output
// directory and writes dossier.json there, the summary the judge reads,
// using the vendored make.fun library under vendor/.
//
// Run it outside the grader with MAKEFUN_OUTPUT_DIR standing in for /output:
//   MAKEFUN_OUTPUT_DIR=/tmp/gta6-out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Where this file lives, and where the finished entry goes.
const here = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The caps the scorer applies (from the competition's gate): text_max_bytes
// shapes the dossier's bytes, the rest only refuse an entry the scorer would
// refuse — more than 4 screenshots, one over 256 KiB, more than 993 files in
// game/ or 48 MiB of game files in all, or a game path over 1000 bytes.
const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// Hand the game and its screenshots over, then write the dossier last so it
// describes exactly what landed in the output directory.
mkdirSync(outDir, { recursive: true });
cpSync(join(here, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}
writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, dossierCaps));
console.log(`Vice Shores written to ${outDir}`);
