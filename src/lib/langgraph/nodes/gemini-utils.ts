const DEFAULT_MAX_RETRIES = 2;
const FALLBACK_RETRY_MS = 5_000;
const MAX_RETRY_MS = 60_000;

function parseRetryDelayMs(message: string): number | null {
  const seconds = message.match(/retry in (\d+(?:\.\d+)?)s/i);
  if (seconds) return Math.ceil(parseFloat(seconds[1]) * 1000);
  const retryDelay = message.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  if (retryDelay) return Math.ceil(parseFloat(retryDelay[1]) * 1000);
  return null;
}

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("429") || msg.toLowerCase().includes("too many requests");
}

export async function callGeminiWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = DEFAULT_MAX_RETRIES
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (!isRateLimitError(err) || attempt >= maxRetries) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      const suggested = parseRetryDelayMs(msg) ?? FALLBACK_RETRY_MS * (attempt + 1);
      const delayMs = Math.min(suggested + 500, MAX_RETRY_MS);
      await new Promise((r) => setTimeout(r, delayMs));
      attempt++;
    }
  }
}

export function createLimiter(maxConcurrent: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    if (active >= maxConcurrent) return;
    const run = queue.shift();
    if (!run) return;
    active++;
    run();
  };

  return async function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      });
      next();
    });
  };
}
