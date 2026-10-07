/** Read-only parsers for SAS Credential / Schema accounts (for verification output). */
import { type Connection, PublicKey } from '@solana/web3.js';
import { SAS_PROGRAM_ID } from '@airspace/shared';

const SAS_PROGRAM = new PublicKey(SAS_PROGRAM_ID);

export type CredentialView = { authority: PublicKey; name: string; authorizedSigners: PublicKey[] };
export type SchemaView = {
  credential: PublicKey;
  name: string;
  description: string;
  layout: number[];
  fieldNames: string[];
  isPaused: boolean;
  version: number;
};

async function loadSasAccount(conn: Connection, address: PublicKey, discriminator: number, kind: string): Promise<Buffer> {
  const info = await conn.getAccountInfo(address, 'confirmed');
  if (!info) throw new Error(`${kind} ${address.toBase58()} does not exist`);
  if (!info.owner.equals(SAS_PROGRAM)) throw new Error(`${kind} ${address.toBase58()} is not owned by SAS`);
  if (info.data[0] !== discriminator) throw new Error(`${kind} ${address.toBase58()}: unexpected discriminator ${info.data[0]}`);
  return info.data;
}

const readVec = (buf: Buffer, o: number): [Buffer, number] => {
  const len = buf.readUInt32LE(o);
  return [buf.subarray(o + 4, o + 4 + len), o + 4 + len];
};

export async function fetchCredential(conn: Connection, address: PublicKey): Promise<CredentialView> {
  const buf = await loadSasAccount(conn, address, 0, 'Credential');
  let o = 1;
  const authority = new PublicKey(buf.subarray(o, (o += 32)));
  const [name, o2] = readVec(buf, o);
  o = o2;
  const n = buf.readUInt32LE(o);
  o += 4;
  const authorizedSigners: PublicKey[] = [];
  for (let i = 0; i < n; i++) authorizedSigners.push(new PublicKey(buf.subarray(o, (o += 32))));
  return { authority, name: name.toString('utf8'), authorizedSigners };
}

export async function fetchSchema(conn: Connection, address: PublicKey): Promise<SchemaView> {
  const buf = await loadSasAccount(conn, address, 1, 'Schema');
  let o = 1;
  const credential = new PublicKey(buf.subarray(o, (o += 32)));
  const [name, o1] = readVec(buf, o);
  const [description, o2] = readVec(buf, o1);
  const [layout, o3] = readVec(buf, o2);
  const [names, o4] = readVec(buf, o3);
  const fieldNames: string[] = [];
  for (let p = 0; p < names.length; ) {
    const [fname, next] = readVec(names, p);
    fieldNames.push(fname.toString('utf8'));
    p = next;
  }
  return {
    credential,
    name: name.toString('utf8'),
    description: description.toString('utf8'),
    layout: Array.from(layout),
    fieldNames,
    isPaused: buf[o4] === 1,
    version: buf[o4 + 1],
  };
}
