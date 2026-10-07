// Offline stand-in for the Anthropic Messages API used by the AirSpace verifier.
// No dependencies; runs under bun or node:  bun server.js  |  node server.js
//
//   POST /v1/messages        -> Anthropic-shaped response whose text is a
//                               deterministic JSON verdict for the audit prompt
//   GET  /api/verify/pending -> tiny stand-in for the web app's pending queue
//                               (serves ../payloads/pending.json) so the cron
//                               handler can be simulated without the web app
//   GET  /health             -> { ok: true }
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.MOCK_PORT ?? 8787)
const HERE = dirname(fileURLToPath(import.meta.url))
const PENDING_FILE = process.env.MOCK_PENDING_FILE ?? join(HERE, '..', 'payloads', 'pending.json')

const readBody = (req) =>
  new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => resolve(data))
  })

const promptText = (body) => {
  const messages = Array.isArray(body?.messages) ? body.messages : []
  return messages
    .map((m) => {
      if (typeof m?.content === 'string') return m.content
      if (Array.isArray(m?.content)) return m.content.map((c) => (typeof c?.text === 'string' ? c.text : '')).join('\n')
      return ''
    })
    .join('\n')
}

// Deterministic verdict: deny when the parcel has no unused development rights,
// otherwise allow with high confidence. Shape mirrors INTERFACES.md §8.
const verdictFor = (prompt) => {
  const noUnused = prompt.includes('"unusedSqft":0')
  return noUnused
    ? {
        recommendation: 'deny',
        confidence: 0.95,
        flags: { dataMismatch: false, ownerMismatch: false },
        valueAdjustmentPct: 0,
        reasoning: 'PLUTO shows no unused floor area: built area already meets or exceeds the maximum FAR, so there are no transferable air rights.',
      }
    : {
        recommendation: 'allow',
        confidence: 0.91,
        flags: { dataMismatch: false, ownerMismatch: false },
        valueAdjustmentPct: 5,
        reasoning: 'Submitted details are consistent with PLUTO. Unused FAR is positive and the zoning district permits transfer; applied a small upward adjustment for a prime Manhattan location.',
      }
}

const json = (res, status, obj) => {
  const text = JSON.stringify(obj)
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text) })
  res.end(text)
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

  if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true })

  if (req.method === 'GET' && url.pathname === '/api/verify/pending') {
    try {
      return json(res, 200, JSON.parse(readFileSync(PENDING_FILE, 'utf8')))
    } catch (err) {
      return json(res, 500, { error: `cannot read ${PENDING_FILE}: ${err.message}` })
    }
  }

  if (req.method === 'POST' && url.pathname === '/v1/messages') {
    if (!req.headers['x-api-key']) {
      return json(res, 401, { type: 'error', error: { type: 'authentication_error', message: 'x-api-key header is required' } })
    }
    let body = {}
    try {
      body = JSON.parse(await readBody(req))
    } catch {
      return json(res, 400, { type: 'error', error: { type: 'invalid_request_error', message: 'body must be JSON' } })
    }
    const prompt = promptText(body)
    const verdict = verdictFor(prompt)
    console.log(`[mock-llm] /v1/messages model=${body.model ?? '?'} -> ${verdict.recommendation} (${verdict.confidence})`)
    return json(res, 200, {
      id: 'msg_mock_airspace_0001',
      type: 'message',
      role: 'assistant',
      model: body.model ?? 'claude-sonnet-5',
      content: [{ type: 'text', text: JSON.stringify(verdict) }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: { input_tokens: Math.ceil(prompt.length / 4), output_tokens: 120 },
    })
  }

  json(res, 404, { error: 'not found' })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock-llm] listening on http://127.0.0.1:${PORT}  (POST /v1/messages, GET /api/verify/pending)`)
})
