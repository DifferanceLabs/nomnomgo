export function cancelledSearch() {
  const error = new Error('Search cancelled');
  error.name = 'AbortError';
  return error;
}

export function isSearchCancelled(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

export class ProviderSearchError extends Error {
  constructor(public provider: string, public status?: number) {
    super(status ? `${provider} search failed (${status})` : `${provider} search is unavailable`);
    this.name = 'ProviderSearchError';
  }
}

/** One user search owns its requests, failures, and refresh policy. */
export class SearchExecution {
  readonly controller = new AbortController();
  readonly blockedProviders = new Map<string, ProviderSearchError>();
  failures = 0;
  successes = 0;

  constructor(readonly id: number, readonly refresh = false) {}

  cancel() { this.controller.abort(); }

  check() {
    if (this.controller.signal.aborted) throw cancelledSearch();
  }

  async json<T>(provider: string, url: string, init?: RequestInit, timeoutMs = 12000): Promise<T> {
    this.check();
    const blocked = this.blockedProviders.get(provider);
    if (blocked) throw blocked;
    const controller = new AbortController();
    const cancel = () => controller.abort();
    this.controller.signal.addEventListener('abort', cancel, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abortHandler: (() => void) | undefined;
    const interrupted = new Promise<never>((_, reject) => {
      abortHandler = () => reject(cancelledSearch());
      this.controller.signal.addEventListener('abort', abortHandler, { once: true });
      timer = setTimeout(() => {
        reject(new ProviderSearchError(provider));
        controller.abort();
      }, timeoutMs);
    });
    try {
      const value = await Promise.race([
        (async () => {
          const response = await fetch(url, { ...init, signal: controller.signal });
          if (!response.ok) throw new ProviderSearchError(provider, response.status);
          return await response.json() as T;
        })(),
        interrupted,
      ]);
      this.check();
      this.successes += 1;
      return value;
    } catch (error) {
      this.check();
      this.failures += 1;
      const failure = error instanceof ProviderSearchError ? error : new ProviderSearchError(provider);
      if (failure.status === 401 || failure.status === 403 || failure.status === 429) {
        this.blockedProviders.set(provider, failure);
      }
      throw failure;
    } finally {
      clearTimeout(timer);
      this.controller.signal.removeEventListener('abort', cancel);
      if (abortHandler) this.controller.signal.removeEventListener('abort', abortHandler);
    }
  }
}

/** Preserve input order while bounding simultaneous provider calls. */
export async function mapConcurrent<T, R>(items: readonly T[], work: (item: T) => Promise<R>, limit = 3) {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index]);
    }
  }));
  return results;
}
