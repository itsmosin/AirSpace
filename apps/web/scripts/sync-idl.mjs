// Copies the real Anchor IDL into src/idl/airspace.json: prefers packages/shared/idl/airspace.json, then
// programs/airspace/target/idl/airspace.json, otherwise falls back to the provisional IDL. Runs before `dev` and `build`.
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..', '..', '..');
const shared = resolve(repo, 'packages', 'shared', 'idl', 'airspace.json');
const anchorTarget = resolve(repo, 'programs', 'airspace', 'target', 'idl', 'airspace.json');
const provisional = join(here, '..', 'src', 'idl', 'airspace.provisional.json');
const target = join(here, '..', 'src', 'idl', 'airspace.json');

function usable(path) {
  if (!existsSync(path)) return false;
  try {
    const idl = JSON.parse(readFileSync(path, 'utf8'));
    return Array.isArray(idl.instructions) && idl.instructions.length > 0 && Array.isArray(idl.accounts);
  } catch {
    return false;
  }
}

const source = usable(shared) ? shared : usable(anchorTarget) ? anchorTarget : provisional;
copyFileSync(source, target);
const label = source === shared ? 'shared Anchor IDL (packages/shared/idl)' : source === anchorTarget ? 'Anchor IDL (programs/airspace/target/idl)' : 'provisional IDL';
console.log(`[idl] using ${label} -> src/idl/airspace.json`);
