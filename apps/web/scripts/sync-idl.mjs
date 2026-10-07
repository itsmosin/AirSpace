// Copies the real Anchor IDL (packages/shared/idl/airspace.json) into src/idl/airspace.json when it exists,
// otherwise falls back to the provisional IDL. Runs before `dev` and `build`.
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const shared = resolve(here, '..', '..', '..', 'packages', 'shared', 'idl', 'airspace.json');
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

const source = usable(shared) ? shared : provisional;
copyFileSync(source, target);
console.log(`[idl] using ${source === shared ? 'shared Anchor IDL' : 'provisional IDL'} -> src/idl/airspace.json`);
