/** Rate-limited fetch for Solana RPC: queues requests to stay under per-second caps and retries 429s quietly. */
export function createThrottledFetch(maxPerSecond = 8): typeof fetch {
  const stamps: number[] = [];
  let chain: Promise<void> = Promise.resolve();
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const acquire = () =>
    (chain = chain.then(async () => {
      for (;;) {
        const now = Date.now();
        while (stamps.length && now - stamps[0] > 1000) stamps.shift();
        if (stamps.length < maxPerSecond) {
          stamps.push(now);
          return;
        }
        await sleep(1000 - (now - stamps[0]) + 5);
      }
    }));
  return async (input, init) => {
    for (let attempt = 0; ; attempt++) {
      await acquire();
      const res = await fetch(input, init);
      if (res.status !== 429 || attempt >= 5) return res;
      await sleep(500 * 2 ** attempt);
    }
  };
}
