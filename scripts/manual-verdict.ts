/**
 * Registrar fallback path: open a verdict for a BBL and record it manually from PLUTO data.
 *
 *   bun scripts/manual-verdict.ts --bbl 1008350041 --status allow|deny|review [--dry-run]
 */
import { PATHS, explorerAddress, explorerTx, fail, loadKeypair, parseArgs } from './lib/env';
import { airspaceProgram } from './lib/program';
import { STATUS_NAME, computeVerdict, describeVerdict, fetchPlutoRow, fetchVerdict, recordManualVerdict, type VerdictOverride } from './lib/verdict';

const args = parseArgs();
const bbl = String(args.bbl ?? '');
const status = String(args.status ?? '') as VerdictOverride;
if (!/^\d{10}$/.test(bbl)) fail('usage: --bbl <10 digits> --status allow|deny|review [--dry-run]');
if (!['allow', 'deny', 'review'].includes(status)) fail('--status must be allow, deny or review');

console.log(`PLUTO lookup for ${bbl}`);
const v = computeVerdict(await fetchPlutoRow(bbl), status);
console.log(describeVerdict(v));
if (args['dry-run']) {
  console.log('\ndry run: nothing sent');
  process.exit(0);
}

const registrar = loadKeypair(PATHS.registrarKeypair);
const program = airspaceProgram(registrar);
const existing = await fetchVerdict(program, bbl);
if (existing) console.log(`\nexisting verdict: ${STATUS_NAME[existing.status]} (source ${existing.source === 0 ? 'manual' : 'CRE'})`);

const r = await recordManualVerdict(program, registrar, v);
if (r.openSig) console.log(`open_verdict           ${explorerTx(r.openSig)}`);
console.log(`record_verdict_manual  ${explorerTx(r.recordSig)}`);
const after = await fetchVerdict(program, bbl);
console.log(`verdict ${r.verdict.toBase58()} → ${STATUS_NAME[after?.status ?? 0]}  ${explorerAddress(r.verdict)}`);
