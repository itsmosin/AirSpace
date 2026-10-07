// Prints the base58 encoding of a Solana JSON keypair's 64-byte secret key,
// in the form `cre workflow simulate --broadcast` expects for CRE_SOLANA_PRIVATE_KEY.
//   bun run scripts/keypair-to-base58.ts ~/.config/solana/airspace-deployer.json >> .env   (then prefix the line)
// Dependency-free so it can run before `bun install`.
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function base58(bytes: Uint8Array): string {
  let zeros = 0
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++
  const digits: number[] = []
  for (const b of bytes) {
    let carry = b
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8
      digits[i] = carry % 58
      carry = (carry / 58) | 0
    }
    while (carry > 0) {
      digits.push(carry % 58)
      carry = (carry / 58) | 0
    }
  }
  let out = '1'.repeat(zeros)
  for (let i = digits.length - 1; i >= 0; i--) out += ALPHABET[digits[i]]
  return out
}

const path = process.argv[2]
if (!path) {
  console.error('usage: bun run scripts/keypair-to-base58.ts <keypair.json>')
  process.exit(1)
}
const arr = JSON.parse(await Bun.file(path).text()) as number[]
if (!Array.isArray(arr) || arr.length !== 64) throw new Error(`expected a 64-byte secret key array, got ${arr?.length}`)
console.log(base58(Uint8Array.from(arr)))
