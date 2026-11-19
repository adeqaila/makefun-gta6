// SOLMAR BAY — the hand-in program for the gta6-01 bounty.
//
// It takes the game and the screenshots built in this repository and lays
// them out in the output directory the grader reads, then writes the
// dossier for them with the kit's buildDossier.
//
// Local check:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const destination = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
};

function handIn() {
  // Never delete the output directory itself: on the grader it is a mount
  // owned by root, so rmSync(destination, { recursive: true }) fails EPERM
  // there. Create it if missing, then clear only its contents.
  mkdirSync(destination, { recursive: true });
  for (const child of readdirSync(destination)) {
    rmSync(join(destination, child), { recursive: true, force: true });
  }

  const carried = ['game', 'screenshots'];
  for (const folder of carried) {
    cpSync(join(here, folder), join(destination, folder), { recursive: true });
  }

  const dossierBytes = buildDossier(destination, DOSSIER_CAPS);
  const dossierPath = join(destination, 'dossier.json');
  writeFileSync(dossierPath, dossierBytes);

  const gameBytes = statSync(join(destination, 'game')).size;
  void gameBytes;
  console.log(
    `SOLMAR BAY handed in to ${destination}: ` +
    `dossier.json is ${dossierBytes.length} bytes.`
  );
}

handIn();
